import io

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from config.testutils import EmbeddingPatchMixin, TempMediaMixin, fake_embed, txt_file
from documents.models import Document, DocumentChunk, Folder
from documents.services.chunking import chunk_text


class ChunkingTests(SimpleTestCase):
    def test_empty_and_whitespace_text_gives_no_chunks(self):
        self.assertEqual(chunk_text(""), [])
        self.assertEqual(chunk_text("   \n  "), [])

    def test_short_text_is_a_single_chunk(self):
        self.assertEqual(chunk_text("  hello world  "), ["hello world"])

    def test_long_text_is_split_with_overlap_and_no_content_lost(self):
        words = [f"word{i}" for i in range(1000)]
        text = " ".join(words)
        chunks = chunk_text(text, chunk_size=300, overlap=50)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= 300 for c in chunks))
        # every word of the source appears in at least one chunk
        joined = " ".join(chunks)
        for w in words:
            self.assertIn(w, joined)
        # consecutive chunks overlap
        self.assertTrue(set(chunks[0].split()[-5:]) & set(chunks[1].split()))

    def test_chunks_never_start_mid_word(self):
        text = " ".join(["abcdefghij"] * 400)
        for c in chunk_text(text, chunk_size=200, overlap=40):
            self.assertTrue(all(w == "abcdefghij" for w in c.split()))


class DocumentApiTests(TempMediaMixin, EmbeddingPatchMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.alice = User.objects.create_user("alice", "a@x.com", "S3cretPass!")
        self.bob = User.objects.create_user("bob", "b@x.com", "S3cretPass!")
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def upload(self, **extra):
        return self.client.post(
            "/api/documents/",
            {"file": txt_file(body="Django REST framework makes APIs. " * 5), **extra},
            format="multipart",
        )

    def test_upload_txt_is_processed_into_chunks(self):
        res = self.upload()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["status"], "ready")
        self.assertEqual(res.data["file_type"], "txt")
        self.assertEqual(res.data["title"], "notes")
        self.assertGreaterEqual(res.data["chunk_count"], 1)
        self.assertEqual(DocumentChunk.objects.filter(document_id=res.data["id"]).count(), res.data["chunk_count"])

    def test_upload_requires_authentication(self):
        res = APIClient().post("/api/documents/", {"file": txt_file()}, format="multipart")
        self.assertEqual(res.status_code, 401)

    def test_unsupported_extension_is_rejected(self):
        bad = SimpleUploadedFile("evil.exe", b"MZ", content_type="application/octet-stream")
        res = self.client.post("/api/documents/", {"file": bad}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("file", res.data)
        self.assertEqual(Document.objects.count(), 0)

    def test_file_over_10mb_is_rejected(self):
        big = SimpleUploadedFile("big.txt", b"a" * (10 * 1024 * 1024 + 1), content_type="text/plain")
        res = self.client.post("/api/documents/", {"file": big}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Document.objects.count(), 0)

    def test_empty_text_file_is_marked_failed_with_reason(self):
        res = self.client.post(
            "/api/documents/", {"file": txt_file("blank.txt", "   \n ")}, format="multipart"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "failed")
        self.assertTrue(res.data["error_message"])
        self.assertEqual(res.data["chunk_count"], 0)

    def test_corrupt_pdf_is_marked_failed_not_500(self):
        bad = SimpleUploadedFile("bad.pdf", b"this is not a pdf", content_type="application/pdf")
        res = self.client.post("/api/documents/", {"file": bad}, format="multipart")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "failed")

    def test_docx_upload_extracts_paragraphs_and_tables(self):
        import docx

        d = docx.Document()
        d.add_paragraph("Quarterly revenue grew strongly.")
        table = d.add_table(rows=1, cols=1)
        table.cell(0, 0).text = "TableCellMarker"
        buf = io.BytesIO()
        d.save(buf)
        f = SimpleUploadedFile("report.docx", buf.getvalue())
        res = self.client.post("/api/documents/", {"file": f}, format="multipart")
        self.assertEqual(res.data["status"], "ready", res.data)
        content = " ".join(DocumentChunk.objects.filter(document_id=res.data["id"]).values_list("content", flat=True))
        self.assertIn("Quarterly revenue", content)
        self.assertIn("TableCellMarker", content)

    def test_users_only_see_their_own_documents(self):
        doc_id = self.upload().data["id"]
        other = APIClient()
        other.force_authenticate(self.bob)
        self.assertEqual(other.get("/api/documents/").data["count"], 0)
        self.assertEqual(other.get(f"/api/documents/{doc_id}/").status_code, 404)
        self.assertEqual(other.get(f"/api/documents/{doc_id}/chunks/").status_code, 404)
        self.assertEqual(other.post(f"/api/documents/{doc_id}/reprocess/").status_code, 404)
        self.assertEqual(other.delete(f"/api/documents/{doc_id}/").status_code, 404)
        self.assertTrue(Document.objects.filter(id=doc_id).exists())

    def test_cannot_upload_into_another_users_folder(self):
        bobs_folder = Folder.objects.create(user=self.bob, name="private")
        res = self.upload(folder=bobs_folder.id)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Document.objects.count(), 0)

    def test_list_filters_by_folder_search_and_status(self):
        folder = Folder.objects.create(user=self.alice, name="work")
        self.upload(folder=folder.id)
        self.client.post("/api/documents/", {"file": txt_file("other.txt", "unrelated text")}, format="multipart")
        self.assertEqual(self.client.get("/api/documents/").data["count"], 2)
        self.assertEqual(self.client.get(f"/api/documents/?folder={folder.id}").data["count"], 1)
        self.assertEqual(self.client.get("/api/documents/?folder=null").data["count"], 1)
        self.assertEqual(self.client.get("/api/documents/?search=OTHER").data["count"], 1)
        self.assertEqual(self.client.get("/api/documents/?status=failed").data["count"], 0)

    def test_chunks_endpoint_and_reprocess_replace_chunks(self):
        doc_id = self.upload().data["id"]
        chunks = self.client.get(f"/api/documents/{doc_id}/chunks/").data
        self.assertEqual(chunks[0]["chunk_index"], 0)
        self.assertEqual(chunks[0]["character_count"], len(chunks[0]["content"]))
        before = DocumentChunk.objects.filter(document_id=doc_id).count()
        res = self.client.post(f"/api/documents/{doc_id}/reprocess/")
        self.assertEqual(res.data["status"], "ready")
        self.assertEqual(DocumentChunk.objects.filter(document_id=doc_id).count(), before)  # not duplicated

    def test_delete_removes_document_chunks_and_file(self):
        doc_id = self.upload().data["id"]
        doc = Document.objects.get(id=doc_id)
        storage, name = doc.file.storage, doc.file.name
        self.assertTrue(storage.exists(name))
        self.assertEqual(self.client.delete(f"/api/documents/{doc_id}/").status_code, 204)
        self.assertFalse(Document.objects.filter(id=doc_id).exists())
        self.assertEqual(DocumentChunk.objects.filter(document_id=doc_id).count(), 0)
        self.assertFalse(storage.exists(name))


class FolderApiTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user("alice", "a@x.com", "S3cretPass!")
        self.bob = User.objects.create_user("bob", "b@x.com", "S3cretPass!")
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def test_create_list_and_duplicate_names(self):
        self.assertEqual(self.client.post("/api/folders/", {"name": " Notes "}, format="json").data["name"], "Notes")
        self.assertEqual(self.client.post("/api/folders/", {"name": "notes"}, format="json").status_code, 400)
        listing = self.client.get("/api/folders/").data
        rows = listing["results"] if isinstance(listing, dict) else listing
        self.assertEqual(len(rows), 1)

    def test_same_folder_name_allowed_for_different_users(self):
        Folder.objects.create(user=self.bob, name="Notes")
        self.assertEqual(self.client.post("/api/folders/", {"name": "Notes"}, format="json").status_code, 201)

    def test_folders_are_isolated_per_user(self):
        f = Folder.objects.create(user=self.bob, name="secret")
        self.assertEqual(self.client.get(f"/api/folders/{f.id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/folders/{f.id}/").status_code, 404)

    def test_deleting_folder_keeps_documents(self):
        f = Folder.objects.create(user=self.alice, name="tmp")
        d = Document.objects.create(user=self.alice, folder=f, title="t", file="x.txt", file_type="txt", file_size=1)
        self.assertEqual(self.client.delete(f"/api/folders/{f.id}/").status_code, 204)
        d.refresh_from_db()
        self.assertIsNone(d.folder)


class EmbeddingFakeSanityTests(SimpleTestCase):
    def test_fake_embedder_is_normalised_and_similarity_aware(self):
        a, b, c = fake_embed("django rest api"), fake_embed("django rest framework"), fake_embed("banana smoothie recipe")
        dot = lambda x, y: sum(i * j for i, j in zip(x, y))
        self.assertAlmostEqual(dot(a, a), 1.0, places=5)
        self.assertGreater(dot(a, b), dot(a, c))
