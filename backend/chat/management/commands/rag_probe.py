"""Check the embedding setup and inspect retrieval distances.

    python manage.py rag_probe                       # smoke test: one real embedding call
    python manage.py rag_probe "what is the policy?" # nearest chunks with their cosine distances
    python manage.py rag_probe "..." --user alice --top 15

Use it to pick RAG_MAX_DISTANCE: ask a few questions your documents answer and a few they do
not, then set the cut-off between the two groups of distances.
"""
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from pgvector.django import CosineDistance

from documents.constants import EMBEDDING_DIMENSIONS
from documents.models import DocumentChunk
from documents.services.embeddings import EmbeddingError, embed_query, embed_texts


class Command(BaseCommand):
    help = "Smoke-test the embedding provider and show nearest chunks with their distances."

    def add_arguments(self, parser):
        parser.add_argument("question", nargs="?", help="Question to embed and search for")
        parser.add_argument("--user", help="Only search this user's ready documents")
        parser.add_argument("--top", type=int, default=10, help="How many chunks to show (default 10)")

    def handle(self, *args, **options):
        self.stdout.write(
            f"provider={settings.EMBEDDING_PROVIDER} model={settings.EMBEDDING_MODEL} "
            f"dimensions={EMBEDDING_DIMENSIONS} RAG_MAX_DISTANCE={settings.RAG_MAX_DISTANCE}"
        )
        try:
            if not options["question"]:
                return self._smoke_test()
            return self._search(options["question"], options["user"], options["top"])
        except EmbeddingError as exc:
            raise CommandError(str(exc)) from exc

    def _smoke_test(self):
        started = time.perf_counter()
        document_vector = embed_texts(["KnowFlow smoke test sentence."])[0]
        query_vector = embed_query("smoke test")
        elapsed = time.perf_counter() - started
        self.stdout.write(
            self.style.SUCCESS(
                f"OK: document vector has {len(document_vector)} values, "
                f"query vector has {len(query_vector)} values ({elapsed:.1f}s)"
            )
        )

    def _search(self, question, username, top):
        query_vector = embed_query(question)
        chunks = DocumentChunk.objects.filter(document__status="ready")
        if username:
            chunks = chunks.filter(document__user__username=username)
        rows = (
            chunks.annotate(distance=CosineDistance("embedding", query_vector))
            .select_related("document")
            .order_by("distance")[:top]
        )
        if not rows:
            self.stdout.write("No ready chunks found.")
            return
        self.stdout.write(f"\n{'distance':>8}  {'kept?':5}  document / chunk")
        for row in rows:
            kept = "yes" if row.distance <= settings.RAG_MAX_DISTANCE else "no"
            snippet = " ".join(row.content.split())[:90]
            self.stdout.write(
                f"{row.distance:8.3f}  {kept:5}  {row.document.title} #{row.chunk_index}: {snippet}"
            )
