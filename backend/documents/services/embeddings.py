_model = None


def get_model():
    """
    Lazily loads and caches the SentenceTransformer model at the module level.
    """
    global _model
    if _model is None:
        from django.conf import settings
        from sentence_transformers import SentenceTransformer

        model_name = getattr(
            settings, "EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2"
        )
        _model = SentenceTransformer(model_name)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Computes normalized embeddings for a list of text strings in batches of 32.
    """
    if not texts:
        return []
    model = get_model()
    embeddings = model.encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return embeddings.tolist()


def embed_query(query: str) -> list[float]:
    """
    Computes a normalized embedding for a single query string.
    """
    model = get_model()
    embedding = model.encode(
        query,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return embedding.tolist()
