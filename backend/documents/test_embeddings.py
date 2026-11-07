import math
import sys
import types as pytypes
from unittest import mock

from django.test import SimpleTestCase, override_settings

from documents.constants import EMBEDDING_DIMENSIONS
from documents.services import embeddings
from documents.services.embeddings import EmbeddingError, embed_query, embed_texts


def make_response(count, dims=EMBEDDING_DIMENSIONS, value=3.0):
    items = [mock.Mock(values=[value] * dims) for _ in range(count)]
    return mock.Mock(embeddings=items)


def gemini_client(side_effect):
    client = mock.Mock()
    client.models.embed_content.side_effect = side_effect
    return client


@override_settings(EMBEDDING_PROVIDER="gemini", EMBEDDING_MODEL="gemini-embedding-001", LLM_API_KEY="key", EMBEDDING_API_KEY="")
class GeminiProviderTests(SimpleTestCase):
    def patch_client(self, client):
        return mock.patch("documents.services.embeddings.genai.Client", return_value=client)

    def test_empty_input_makes_no_api_call(self):
        with self.patch_client(gemini_client(None)) as cls:
            self.assertEqual(embed_texts([]), [])
        cls.assert_not_called()

    def test_documents_use_document_task_type_dimensions_and_are_normalised(self):
        client = gemini_client(lambda **kw: make_response(len(kw["contents"])))
        with self.patch_client(client):
            vectors = embed_texts(["a", "b"])
        kwargs = client.models.embed_content.call_args.kwargs
        self.assertEqual(kwargs["model"], "gemini-embedding-001")
        self.assertEqual(kwargs["contents"], ["a", "b"])
        self.assertEqual(kwargs["config"].task_type, "RETRIEVAL_DOCUMENT")
        self.assertEqual(kwargs["config"].output_dimensionality, EMBEDDING_DIMENSIONS)
        self.assertEqual(len(vectors), 2)
        self.assertAlmostEqual(math.sqrt(sum(v * v for v in vectors[0])), 1.0, places=6)

    def test_query_uses_query_task_type(self):
        client = gemini_client(lambda **kw: make_response(len(kw["contents"])))
        with self.patch_client(client):
            vector = embed_query("what is this?")
        self.assertEqual(client.models.embed_content.call_args.kwargs["config"].task_type, "RETRIEVAL_QUERY")
        self.assertEqual(len(vector), EMBEDDING_DIMENSIONS)

    def test_large_inputs_are_split_into_batches_and_keep_their_order(self):
        client = gemini_client(lambda **kw: mock.Mock(embeddings=[mock.Mock(values=[float(int(t))] + [0.0] * (EMBEDDING_DIMENSIONS - 1)) for t in kw["contents"]]))
        texts = [str(i + 1) for i in range(120)]
        with self.patch_client(client):
            vectors = embed_texts(texts)
        sizes = [len(c.kwargs["contents"]) for c in client.models.embed_content.call_args_list]
        self.assertEqual(sizes, [50, 50, 20])
        # each vector is normalised to [1, 0, 0...], so order can only be checked through the call args
        self.assertEqual(len(vectors), 120)
        sent = [t for c in client.models.embed_content.call_args_list for t in c.kwargs["contents"]]
        self.assertEqual(sent, texts)

    @mock.patch("documents.services.embeddings.time.sleep")
    def test_transient_error_is_retried_then_succeeds(self, sleep):
        calls = iter([Exception("503 UNAVAILABLE"), Exception("429 RESOURCE_EXHAUSTED"), None])

        def side_effect(**kw):
            result = next(calls)
            if result is not None:
                raise result
            return make_response(len(kw["contents"]))

        client = gemini_client(side_effect)
        with self.patch_client(client):
            self.assertEqual(len(embed_texts(["x"])), 1)
        self.assertEqual(client.models.embed_content.call_count, 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [2, 5])

    @mock.patch("documents.services.embeddings.time.sleep")
    def test_gives_up_after_retries_with_quota_message(self, sleep):
        client = gemini_client(Exception("429 RESOURCE_EXHAUSTED quota"))
        with self.patch_client(client):
            with self.assertRaisesRegex(EmbeddingError, "quota or rate limit"):
                embed_texts(["x"])
        self.assertEqual(client.models.embed_content.call_count, 4)  # first try + 3 retries

    @mock.patch("documents.services.embeddings.time.sleep")
    def test_permanent_errors_are_not_retried(self, sleep):
        client = gemini_client(Exception("403 PERMISSION_DENIED api key invalid"))
        with self.patch_client(client):
            with self.assertRaisesRegex(EmbeddingError, "authentication"):
                embed_query("x")
        self.assertEqual(client.models.embed_content.call_count, 1)
        sleep.assert_not_called()

    def test_wrong_dimension_from_the_api_is_rejected(self):
        client = gemini_client(lambda **kw: make_response(len(kw["contents"]), dims=10))
        with self.patch_client(client):
            with self.assertRaisesRegex(EmbeddingError, "dimensions"):
                embed_texts(["x"])

    def test_missing_embedding_for_a_text_is_rejected(self):
        client = gemini_client(lambda **kw: make_response(1))
        with self.patch_client(client):
            with self.assertRaisesRegex(EmbeddingError, "Expected 2"):
                embed_texts(["a", "b"])

    @override_settings(EMBEDDING_MODEL="paraphrase-multilingual-MiniLM-L12-v2")
    def test_non_gemini_model_name_gives_a_clear_error(self):
        with self.assertRaisesRegex(EmbeddingError, "not a Gemini embedding model"):
            embed_texts(["x"])

    @override_settings(LLM_API_KEY="", EMBEDDING_API_KEY="")
    def test_missing_api_key_is_reported(self):
        with self.assertRaisesRegex(EmbeddingError, "not configured"):
            embed_texts(["x"])

    @override_settings(LLM_API_KEY="llm-key", EMBEDDING_API_KEY="embed-key")
    def test_dedicated_embedding_key_takes_priority(self):
        client = gemini_client(lambda **kw: make_response(len(kw["contents"])))
        with self.patch_client(client) as cls:
            embed_texts(["x"])
        cls.assert_called_once_with(api_key="embed-key")


class LocalProviderTests(SimpleTestCase):
    def fake_module(self, dims):
        class FakeArray(list):
            def tolist(self):
                return list(self)

        class FakeModel:
            def __init__(self, name):
                self.name = name

            def encode(self, texts, **kwargs):
                return FakeArray([[0.5] * dims for _ in texts])

        return pytypes.SimpleNamespace(SentenceTransformer=FakeModel)

    def setUp(self):
        embeddings._local_model = None
        self.addCleanup(setattr, embeddings, "_local_model", None)

    @override_settings(EMBEDDING_PROVIDER="local", EMBEDDING_MODEL="fake-model")
    def test_local_provider_uses_sentence_transformers(self):
        with mock.patch.dict(sys.modules, {"sentence_transformers": self.fake_module(EMBEDDING_DIMENSIONS)}):
            vectors = embed_texts(["a", "b"])
            query = embed_query("q")
        self.assertEqual(len(vectors), 2)
        self.assertEqual(len(query), EMBEDDING_DIMENSIONS)

    @override_settings(EMBEDDING_PROVIDER="local", EMBEDDING_MODEL="fake-model")
    def test_local_model_with_wrong_dimensions_is_rejected(self):
        with mock.patch.dict(sys.modules, {"sentence_transformers": self.fake_module(384)}):
            with self.assertRaisesRegex(EmbeddingError, "384 dimensions"):
                embed_texts(["a"])

    @override_settings(EMBEDDING_PROVIDER="local")
    def test_local_provider_without_the_package_explains_how_to_install_it(self):
        with mock.patch.dict(sys.modules, {"sentence_transformers": None}):
            with self.assertRaisesRegex(EmbeddingError, "requirements-local.txt"):
                embed_texts(["a"])

    @override_settings(EMBEDDING_PROVIDER="carrier-pigeon")
    def test_unknown_provider_is_rejected(self):
        with self.assertRaisesRegex(EmbeddingError, "Unknown EMBEDDING_PROVIDER"):
            embed_texts(["a"])
