from django.conf import settings
from pgvector.django import CosineDistance
from documents.models import DocumentChunk
from documents.services.embeddings import embed_query


def retrieve_chunks(
    user,
    query: str,
    top_k: int = None,
    document_ids: list = None,
    folder_id: int = None,
) -> list[dict]:
    """
    Retrieves the most semantically relevant document chunks for a query.
    Restricted to user documents with status='ready'.
    Applies optional document_ids and folder_id filters.
    Drops any chunks with distance > RAG_MAX_DISTANCE.
    Returns ordered by distance ascending.
    """
    if top_k is None:
        top_k = getattr(settings, "RAG_TOP_K", 5)
    max_distance = float(getattr(settings, "RAG_MAX_DISTANCE", 0.8))

    query_embedding = embed_query(query)

    qs = DocumentChunk.objects.filter(
        document__user=user,
        document__status="ready",
    )

    if document_ids:
        qs = qs.filter(document_id__in=document_ids)

    if folder_id is not None:
        qs = qs.filter(document__folder_id=folder_id)

    qs = (
        qs.select_related("document")
        .annotate(distance=CosineDistance("embedding", query_embedding))
        .filter(distance__lte=max_distance)
        .order_by("distance")[:top_k]
    )

    results = []
    for chunk in qs:
        results.append({
            "document_id": chunk.document_id,
            "document_title": chunk.document.title,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "distance": float(chunk.distance),
        })

    return results
