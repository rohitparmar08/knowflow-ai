from documents.models import Document, DocumentChunk
from .chunking import chunk_text
from .embeddings import embed_texts
from .extraction import extract_text


def process_document(document: Document) -> Document:
    """
    Extracts text, chunks content, generates embeddings, and bulk creates DocumentChunks.
    Updates document status to 'ready' on success or 'failed' on error.
    """
    document.status = "processing"
    document.save(update_fields=["status"])

    try:
        text = extract_text(document)
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("No text chunks generated from document.")

        embeddings = embed_texts(chunks)

        # Remove any pre-existing chunks
        document.chunks.all().delete()

        # Bulk create new chunks
        chunk_instances = [
            DocumentChunk(
                document=document,
                chunk_index=i,
                content=chunk_content,
                embedding=embedding_vector,
            )
            for i, (chunk_content, embedding_vector) in enumerate(
                zip(chunks, embeddings)
            )
        ]
        DocumentChunk.objects.bulk_create(chunk_instances)

        document.status = "ready"
        document.error_message = ""
        document.save(update_fields=["status", "error_message"])

    except Exception as e:
        document.status = "failed"
        document.error_message = str(e)
        document.save(update_fields=["status", "error_message"])

    return document
