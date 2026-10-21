from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from pgvector.django import CosineDistance
from documents.models import DocumentChunk
from documents.services.embeddings import embed_query


class Command(BaseCommand):
    help = "Search document chunks using semantic cosine similarity."

    def add_arguments(self, parser):
        parser.add_argument("query", type=str, help="Search query string")
        parser.add_argument(
            "--user",
            type=str,
            required=True,
            help="Username to filter documents for",
        )
        parser.add_argument(
            "--top",
            type=int,
            default=3,
            help="Number of nearest chunks to return",
        )

    def handle(self, *args, **options):
        query = options["query"]
        username = options["user"]
        top_k = options["top"]

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist.")

        # Compute embedding for query
        query_embedding = embed_query(query)

        # Retrieve nearest chunks using pgvector CosineDistance
        chunks = (
            DocumentChunk.objects.filter(document__user=user)
            .annotate(distance=CosineDistance("embedding", query_embedding))
            .order_by("distance")[:top_k]
        )

        if not chunks:
            self.stdout.write(
                self.style.WARNING(f"No document chunks found for user '{username}'.")
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Top {len(chunks)} matching chunks for query '{query}' (user: {username}):\n"
            )
        )
        for i, chunk in enumerate(chunks, start=1):
            title = chunk.document.title
            idx = chunk.chunk_index
            dist = chunk.distance
            preview = chunk.content[:150].replace("\n", " ")
            self.stdout.write(
                f"[{i}] Title: {title} | Chunk: {idx} | Cosine Distance: {dist:.4f}\n"
                f"    Content: {preview}...\n"
            )
