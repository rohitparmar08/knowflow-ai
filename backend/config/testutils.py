"""Shared helpers for the test-suite.

The real embedding model (sentence-transformers) is large and needs a network
download, so tests replace it with a deterministic bag-of-words hashing
embedder. Texts that share words end up close in cosine distance, which is all
the retrieval logic needs to be exercised for real against PostgreSQL+pgvector.
"""
import hashlib
import math
import re
import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings

DIMENSIONS = 384


def fake_embed(text: str) -> list[float]:
    vec = [0.0] * DIMENSIONS
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIMENSIONS
        vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def fake_embed_texts(texts):
    return [fake_embed(t) for t in texts]


def patch_embeddings():
    """Patch every place the real embedder is imported. Returns a list of patchers."""
    return [
        mock.patch("documents.services.processing.embed_texts", side_effect=fake_embed_texts),
        mock.patch("chat.services.retrieval.embed_query", side_effect=fake_embed),
    ]


class TempMediaMixin:
    """Redirect uploads to a throw-away directory."""

    @classmethod
    def setUpClass(cls):
        cls._media_dir = tempfile.mkdtemp(prefix="knowflow-test-media-")
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_dir)
        cls._media_override.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._media_override.disable()
        shutil.rmtree(cls._media_dir, ignore_errors=True)


class EmbeddingPatchMixin:
    def setUp(self):
        super().setUp()
        for p in patch_embeddings():
            p.start()
            self.addCleanup(p.stop)


def txt_file(name="notes.txt", body="hello world"):
    return SimpleUploadedFile(name, body.encode(), content_type="text/plain")
