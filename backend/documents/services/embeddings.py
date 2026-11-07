"""Text embeddings for retrieval.

Two interchangeable providers, selected with EMBEDDING_PROVIDER:

* ``gemini`` (default): Google's gemini-embedding-001 through the same API key as the LLM.
  Nothing heavy is installed or loaded, so the backend fits on small free hosting tiers.
* ``local``: a sentence-transformers model that runs inside the server process. It needs
  ``pip install -r requirements-local.txt`` and roughly 2 GB of RAM.

Whichever provider is used, vectors are L2-normalised and have EMBEDDING_DIMENSIONS values,
because that is the size of the database column.
"""
import logging
import math
import time

from django.conf import settings
from google import genai
from google.genai import types

from documents.constants import EMBEDDING_DIMENSIONS

logger = logging.getLogger(__name__)

GEMINI_BATCH_SIZE = 50  # the API accepts up to 100 texts per request
RETRY_DELAYS = (2, 5, 10)  # seconds to wait before each retry of a transient failure
TRANSIENT_MARKERS = ("503", "unavailable", "429", "resource_exhausted", "quota", "temporarily", "deadline")


class EmbeddingError(RuntimeError):
    """Embeddings could not be produced (configuration, quota, network or model problem)."""


def _classify_error(err_str: str) -> str:
    lower = err_str.lower()
    if any(k in lower for k in ("quota", "429", "resource_exhausted", "rate limit")):
        return f"Embedding quota or rate limit exceeded, try again in a minute: {err_str}"
    if any(k in lower for k in ("api key", "401", "403", "unauthenticated", "permission_denied")):
        return f"Embedding authentication failure (check LLM_API_KEY / EMBEDDING_API_KEY): {err_str}"
    if any(k in lower for k in ("not found", "404")):
        return f"Embedding model not found (check EMBEDDING_MODEL): {err_str}"
    return f"Embedding request failed: {err_str}"


def _normalize(vector) -> list[float]:
    values = [float(v) for v in vector]
    norm = math.sqrt(sum(v * v for v in values))
    return [v / norm for v in values] if norm else values


def _check_dimensions(vectors: list[list[float]], expected_count: int) -> None:
    if len(vectors) != expected_count:
        raise EmbeddingError(f"Expected {expected_count} embeddings but received {len(vectors)}.")
    for vector in vectors:
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise EmbeddingError(
                f"Embedding model returned {len(vector)} dimensions but the database column "
                f"stores {EMBEDDING_DIMENSIONS}."
            )


# ---------------------------------------------------------------- Gemini


def _gemini_call_with_retry(client, texts: list[str], task_type: str):
    config = types.EmbedContentConfig(
        task_type=task_type,
        output_dimensionality=EMBEDDING_DIMENSIONS,
    )
    last_error = None
    for attempt, delay in enumerate((0, *RETRY_DELAYS)):
        if delay:
            time.sleep(delay)
        try:
            return client.models.embed_content(
                model=settings.EMBEDDING_MODEL.strip(),
                contents=texts,
                config=config,
            )
        except Exception as exc:  # the SDK raises several error types; classify by message
            last_error = exc
            transient = any(k in str(exc).lower() for k in TRANSIENT_MARKERS)
            if not transient or attempt == len(RETRY_DELAYS):
                break
            logger.warning("Embedding request failed (%s), retrying...", exc)
    message = _classify_error(str(last_error))
    logger.error(message)
    raise EmbeddingError(message) from last_error


def _gemini_embed(texts: list[str], task_type: str) -> list[list[float]]:
    api_key = (getattr(settings, "EMBEDDING_API_KEY", "") or getattr(settings, "LLM_API_KEY", "")).strip()
    if not api_key:
        raise EmbeddingError("LLM_API_KEY is not configured, so embeddings cannot be generated.")
    model = settings.EMBEDDING_MODEL.strip()
    if "embedding" not in model.lower():
        raise EmbeddingError(
            f"EMBEDDING_MODEL={model!r} is not a Gemini embedding model. Remove EMBEDDING_MODEL from your "
            "environment (the default is gemini-embedding-001) or set EMBEDDING_PROVIDER=local."
        )
    client = genai.Client(api_key=api_key)

    vectors: list[list[float]] = []
    for start in range(0, len(texts), GEMINI_BATCH_SIZE):
        batch = texts[start : start + GEMINI_BATCH_SIZE]
        response = _gemini_call_with_retry(client, batch, task_type)
        vectors.extend(_normalize(item.values) for item in (response.embeddings or []))
    _check_dimensions(vectors, len(texts))
    return vectors


# ---------------------------------------------------------------- local sentence-transformers

_local_model = None


def _get_local_model():
    global _local_model
    if _local_model is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise EmbeddingError(
                "EMBEDDING_PROVIDER=local needs sentence-transformers: pip install -r requirements-local.txt"
            ) from exc
        _local_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _local_model


def _local_embed(texts: list[str]) -> list[list[float]]:
    model = _get_local_model()
    encoded = model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    vectors = [list(map(float, row)) for row in encoded.tolist()]
    _check_dimensions(vectors, len(texts))
    return vectors


# ---------------------------------------------------------------- public API


def _embed(texts: list[str], *, is_query: bool) -> list[list[float]]:
    provider = getattr(settings, "EMBEDDING_PROVIDER", "gemini")
    if provider == "gemini":
        return _gemini_embed(texts, "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT")
    if provider == "local":
        return _local_embed(texts)
    raise EmbeddingError(f"Unknown EMBEDDING_PROVIDER '{provider}' (use 'gemini' or 'local').")


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeddings for document chunks, in the same order as ``texts``."""
    if not texts:
        return []
    return _embed(texts, is_query=False)


def embed_query(query: str) -> list[float]:
    """Embedding for a user question."""
    return _embed([query], is_query=True)[0]
