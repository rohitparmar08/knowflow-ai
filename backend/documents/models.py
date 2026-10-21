from django.contrib.auth.models import User
from django.db import models
from pgvector.django import VectorField


class Folder(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="folders")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "name")

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class Document(models.Model):
    STATUS_CHOICES = (
        ("uploaded", "Uploaded"),
        ("processing", "Processing"),
        ("ready", "Ready"),
        ("failed", "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    folder = models.ForeignKey(
        Folder,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="documents/%Y/%m/")
    file_type = models.CharField(max_length=10)
    file_size = models.PositiveBigIntegerField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="uploaded",
    )
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        # Remove file from disk upon deletion
        if self.file and self.file.storage.exists(self.file.name):
            self.file.delete(save=False)
        super().delete(*args, **kwargs)


class DocumentChunk(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = models.PositiveIntegerField()
    content = models.TextField()
    embedding = VectorField(dimensions=384)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["chunk_index"]
        unique_together = ("document", "chunk_index")

    def __str__(self):
        return f"{self.document.title} [Chunk {self.chunk_index}]"
