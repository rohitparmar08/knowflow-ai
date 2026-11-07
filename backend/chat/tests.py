from unittest import mock

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from chat.models import Conversation, Message
from chat.services import llm
from chat.services.rag import FALLBACK_ANSWER, answer_question
from config.testutils import EmbeddingPatchMixin, fake_embed_texts
from documents.models import Document, DocumentChunk, Folder


def make_doc(user, title, texts, folder=None, status="ready"):
    doc = Document.objects.create(
        user=user, title=title, folder=folder, file=f"{title}.txt",
        file_type="txt", file_size=1, status=status,
    )
    for i, (text, emb) in enumerate(zip(texts, fake_embed_texts(texts))):
        DocumentChunk.objects.create(document=doc, chunk_index=i, content=text, embedding=emb)
    return doc


class RagServiceTests(EmbeddingPatchMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.alice = User.objects.create_user("alice", "a@x.com", "S3cretPass!")
        self.bob = User.objects.create_user("bob", "b@x.com", "S3cretPass!")
        self.doc = make_doc(self.alice, "django", [
            "django rest framework builds web apis quickly",
            "postgres stores relational data with pgvector embeddings",
        ])

    @mock.patch("chat.services.rag.generate_answer")
    def test_irrelevant_question_skips_the_llm(self, gen):
        answer, sources = answer_question(self.alice, "banana smoothie recipe zzz")
        self.assertEqual(answer, FALLBACK_ANSWER)
        self.assertEqual(sources, [])
        gen.assert_not_called()

    @mock.patch("chat.services.rag.generate_answer", return_value="DRF builds APIs [1].")
    def test_relevant_question_calls_llm_and_returns_only_cited_sources(self, gen):
        answer, sources = answer_question(self.alice, "django rest framework web apis")
        self.assertEqual(answer, "DRF builds APIs [1].")
        gen.assert_called_once()
        self.assertEqual([s["index"] for s in sources], [1])
        self.assertEqual(sources[0]["document_title"], "django")
        self.assertIn("django rest framework", sources[0]["snippet"])

    @mock.patch("chat.services.rag.generate_answer", return_value="No citations here.")
    def test_uncited_answer_has_no_sources(self, _):
        _, sources = answer_question(self.alice, "django rest framework web apis")
        self.assertEqual(sources, [])

    @mock.patch("chat.services.rag.generate_answer", return_value="x [1]")
    def test_other_users_documents_are_never_retrieved(self, gen):
        answer, _ = answer_question(self.bob, "django rest framework web apis")
        self.assertEqual(answer, FALLBACK_ANSWER)
        gen.assert_not_called()

    @mock.patch("chat.services.rag.generate_answer")
    def test_documents_that_are_not_ready_are_ignored(self, gen):
        make_doc(self.bob, "draft", ["kubernetes cluster autoscaling"], status="processing")
        answer, _ = answer_question(self.bob, "kubernetes cluster autoscaling")
        self.assertEqual(answer, FALLBACK_ANSWER)
        gen.assert_not_called()

    @mock.patch("chat.services.rag.generate_answer", return_value="ok [1]")
    def test_document_and_folder_filters(self, gen):
        folder = Folder.objects.create(user=self.alice, name="f")
        other = make_doc(self.alice, "k8s", ["kubernetes cluster autoscaling guide"], folder=folder)
        # restrict to the k8s doc: a django question finds nothing
        a, _ = answer_question(self.alice, "django rest framework web apis", document_ids=[other.id])
        self.assertEqual(a, FALLBACK_ANSWER)
        # folder filter finds the doc inside the folder only
        a, s = answer_question(self.alice, "kubernetes cluster autoscaling", folder_id=folder.id)
        self.assertEqual(a, "ok [1]")
        self.assertEqual(s[0]["document_title"], "k8s")

    @mock.patch("chat.services.rag.generate_answer", return_value="ok [1]")
    def test_follow_up_uses_previous_question_for_retrieval(self, gen):
        conv = Conversation.objects.create(user=self.alice, title="t")
        Message.objects.create(conversation=conv, role="user", content="django rest framework web apis")
        Message.objects.create(conversation=conv, role="assistant", content="Sure.")
        # "what else?" alone matches nothing, but combined with the previous question it does
        answer, _ = answer_question(self.alice, "what else", conversation=conv)
        self.assertEqual(answer, "ok [1]")
        history = gen.call_args.kwargs["history"]
        self.assertEqual([m["role"] for m in history], ["user", "assistant"])

    @override_settings(RAG_TOP_K=1)
    @mock.patch("chat.services.rag.generate_answer", return_value="a [1] [2]")
    def test_top_k_limits_chunks(self, gen):
        answer_question(self.alice, "django rest framework web apis postgres pgvector")
        self.assertEqual(len(gen.call_args.kwargs["chunks"]), 1)


class LlmServiceTests(TestCase):
    chunks = [{"document_title": "d", "chunk_index": 0, "content": "ctx"}]

    @override_settings(LLM_API_KEY="")
    def test_missing_api_key_raises_runtime_error(self):
        with self.assertRaises(RuntimeError):
            llm.generate_answer("q", self.chunks)

    @override_settings(LLM_API_KEY="k", LLM_MODEL="m1", LLM_FALLBACK_MODEL="")
    @mock.patch("chat.services.llm.genai.Client")
    def test_prompt_contains_context_history_and_question(self, client_cls):
        client_cls.return_value.models.generate_content.return_value = mock.Mock(text=" answer [1] ")
        out = llm.generate_answer("why?", self.chunks, history=[{"role": "user", "content": "hi"}])
        self.assertEqual(out, "answer [1]")
        prompt = client_cls.return_value.models.generate_content.call_args.kwargs["contents"]
        self.assertIn("[1] (d, chunk 0): ctx", prompt)
        self.assertIn("User: hi", prompt)
        self.assertTrue(prompt.endswith("Question: why?"))

    @override_settings(LLM_API_KEY="k", LLM_MODEL="m1", LLM_FALLBACK_MODEL="")
    @mock.patch("chat.services.llm.time.sleep")
    @mock.patch("chat.services.llm.genai.Client")
    def test_transient_error_is_retried_then_succeeds(self, client_cls, sleep):
        gen = client_cls.return_value.models.generate_content
        gen.side_effect = [Exception("503 UNAVAILABLE"), mock.Mock(text="ok")]
        self.assertEqual(llm.generate_answer("q", self.chunks), "ok")
        self.assertEqual(gen.call_count, 2)
        sleep.assert_called_once()

    @override_settings(LLM_API_KEY="k", LLM_MODEL="m1", LLM_FALLBACK_MODEL="m2")
    @mock.patch("chat.services.llm.genai.Client")
    def test_fallback_model_used_when_primary_fails_permanently(self, client_cls):
        gen = client_cls.return_value.models.generate_content
        gen.side_effect = [Exception("404 model not found"), mock.Mock(text="from fallback")]
        self.assertEqual(llm.generate_answer("q", self.chunks), "from fallback")
        self.assertEqual(gen.call_args.kwargs["model"], "m2")

    @override_settings(LLM_API_KEY="k", LLM_MODEL="m1", LLM_FALLBACK_MODEL="")
    @mock.patch("chat.services.llm.genai.Client")
    def test_permanent_failure_becomes_classified_runtime_error(self, client_cls):
        client_cls.return_value.models.generate_content.side_effect = Exception("403 permission_denied")
        with self.assertRaisesRegex(RuntimeError, "authentication"):
            llm.generate_answer("q", self.chunks)

    def test_error_classification(self):
        self.assertIn("quota", llm._classify_error("429 RESOURCE_EXHAUSTED").lower())
        self.assertIn("not found", llm._classify_error("404 not found").lower())


class ChatApiTests(EmbeddingPatchMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.alice = User.objects.create_user("alice", "a@x.com", "S3cretPass!")
        self.bob = User.objects.create_user("bob", "b@x.com", "S3cretPass!")
        self.doc = make_doc(self.alice, "django", ["django rest framework builds web apis"])
        cache.clear()  # throttle counters live in the cache
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def ask(self, **body):
        return self.client.post("/api/chat/ask/", body, format="json")

    def test_ask_requires_authentication(self):
        self.assertEqual(APIClient().post("/api/chat/ask/", {"question": "hi"}, format="json").status_code, 401)

    def test_empty_or_too_long_question_is_rejected(self):
        self.assertEqual(self.ask(question="   ").status_code, 400)
        self.assertEqual(self.ask(question="x" * 2001).status_code, 400)
        self.assertEqual(Conversation.objects.count(), 0)

    @mock.patch("chat.services.rag.generate_answer", return_value="DRF builds APIs [1].")
    def test_ask_creates_conversation_with_both_messages_and_sources(self, _):
        res = self.ask(question="django rest framework web apis")
        self.assertEqual(res.status_code, 200, res.data)
        conv = Conversation.objects.get(id=res.data["conversation_id"])
        self.assertEqual(conv.user, self.alice)
        self.assertEqual(conv.messages.count(), 2)
        self.assertEqual(res.data["assistant_message"]["sources"][0]["document_id"], self.doc.id)

    @mock.patch("chat.services.rag.generate_answer", return_value="more [1]")
    def test_follow_up_appends_to_existing_conversation(self, _):
        first = self.ask(question="django rest framework web apis").data["conversation_id"]
        res = self.ask(question="tell me more django", conversation_id=first)
        self.assertEqual(res.data["conversation_id"], first)
        self.assertEqual(Conversation.objects.get(id=first).messages.count(), 4)

    def test_irrelevant_question_returns_fallback_without_llm(self):
        with mock.patch("chat.services.rag.generate_answer") as gen:
            res = self.ask(question="banana smoothie zzz")
        gen.assert_not_called()
        self.assertEqual(res.data["assistant_message"]["content"], FALLBACK_ANSWER)

    @mock.patch("chat.services.rag.generate_answer", side_effect=RuntimeError("LLM quota exceeded"))
    def test_llm_failure_returns_502_and_persists_nothing(self, _):
        res = self.ask(question="django rest framework web apis")
        self.assertEqual(res.status_code, 502)
        self.assertEqual(Conversation.objects.count(), 0)
        self.assertEqual(Message.objects.count(), 0)

    def test_cannot_use_another_users_conversation_folder_or_documents(self):
        conv = Conversation.objects.create(user=self.bob, title="bob")
        bob_folder = Folder.objects.create(user=self.bob, name="f")
        bob_doc = make_doc(self.bob, "bobdoc", ["secret"])
        self.assertEqual(self.ask(question="hi", conversation_id=conv.id).status_code, 404)
        self.assertEqual(self.ask(question="hi", folder_id=bob_folder.id).status_code, 400)
        self.assertEqual(self.ask(question="hi", document_ids=[bob_doc.id]).status_code, 400)
        self.assertEqual(self.ask(question="hi", document_ids=[self.doc.id, 99999]).status_code, 400)

    @mock.patch("chat.services.rag.generate_answer", return_value="ok [1]")
    def test_ask_is_rate_limited_per_user(self, _):
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"ask": "2/min"}):
            codes = [self.ask(question="django rest framework").status_code for _ in range(3)]
            other = APIClient()
            other.force_authenticate(self.bob)
            bob_code = other.post("/api/chat/ask/", {"question": "hi"}, format="json").status_code
        self.assertEqual(codes, [200, 200, 429])
        self.assertNotEqual(bob_code, 429)  # limit is per user, not global

    def test_conversation_list_detail_rename_delete_and_isolation(self):
        mine = Conversation.objects.create(user=self.alice, title="mine")
        Message.objects.create(conversation=mine, role="user", content="q")
        theirs = Conversation.objects.create(user=self.bob, title="theirs")

        listing = self.client.get("/api/chat/conversations/")
        rows = listing.data["results"] if isinstance(listing.data, dict) and "results" in listing.data else listing.data
        self.assertEqual([r["title"] for r in rows], ["mine"])
        self.assertEqual(rows[0]["message_count"], 1)

        self.assertEqual(len(self.client.get(f"/api/chat/conversations/{mine.id}/").data["messages"]), 1)
        self.assertEqual(self.client.get(f"/api/chat/conversations/{theirs.id}/").status_code, 404)

        res = self.client.patch(f"/api/chat/conversations/{mine.id}/", {"title": "  New  "}, format="json")
        self.assertEqual(res.data["title"], "New")
        self.assertEqual(self.client.patch(f"/api/chat/conversations/{mine.id}/", {"title": " "}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(f"/api/chat/conversations/{theirs.id}/", {"title": "x"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/chat/conversations/{theirs.id}/").status_code, 404)

        self.assertEqual(self.client.delete(f"/api/chat/conversations/{mine.id}/").status_code, 204)
        self.assertEqual(Message.objects.filter(conversation_id=mine.id).count(), 0)
        # PUT/POST are not allowed on conversations
        self.assertEqual(self.client.post("/api/chat/conversations/", {"title": "x"}, format="json").status_code, 405)
