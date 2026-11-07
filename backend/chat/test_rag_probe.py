from io import StringIO
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from chat.tests import make_doc
from config.testutils import fake_embed
from documents.services.embeddings import EmbeddingError


def run(*args):
    out = StringIO()
    call_command("rag_probe", *args, stdout=out)
    return out.getvalue()


class RagProbeTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", "a@x.com", "S3cretPass!")
        self.bob = User.objects.create_user("bob", "b@x.com", "S3cretPass!")
        make_doc(self.alice, "django-notes", ["django rest framework builds web apis", "banana smoothie recipe"])
        make_doc(self.bob, "bobs-notes", ["django rest framework for bob"])

    def test_smoke_test_reports_vector_sizes(self):
        with mock.patch("chat.management.commands.rag_probe.embed_texts", return_value=[fake_embed("a")]), \
             mock.patch("chat.management.commands.rag_probe.embed_query", side_effect=fake_embed):
            output = run()
        self.assertIn("OK: document vector has 768 values, query vector has 768 values", output)

    def test_question_lists_nearest_chunks_closest_first_with_kept_flag(self):
        with mock.patch("chat.management.commands.rag_probe.embed_query", side_effect=fake_embed):
            output = run("django rest framework web apis", "--user", "alice")
        lines = [l for l in output.splitlines() if "django-notes" in l]
        self.assertEqual(len(lines), 2)
        self.assertIn("web apis", lines[0])  # closest chunk first
        self.assertIn("yes", lines[0])
        self.assertIn("no", lines[1])
        self.assertNotIn("bobs-notes", output)  # --user filter

    def test_without_user_filter_all_ready_documents_are_searched(self):
        with mock.patch("chat.management.commands.rag_probe.embed_query", side_effect=fake_embed):
            output = run("django rest framework", "--top", "1")
        self.assertEqual(sum("notes" in l for l in output.splitlines() if "#" in l), 1)

    def test_embedding_failure_becomes_a_command_error(self):
        with mock.patch("chat.management.commands.rag_probe.embed_texts", side_effect=EmbeddingError("no key")):
            with self.assertRaisesMessage(CommandError, "no key"):
                run()
