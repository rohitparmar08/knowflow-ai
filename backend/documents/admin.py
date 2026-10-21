from django.contrib import admin
from .models import Document, DocumentChunk, Folder


@admin.register(Folder)
class FolderAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "created_at")
    list_filter = ("created_at", "user")
    search_fields = ("name", "user__username")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "file_type",
        "file_size",
        "status",
        "folder",
        "user",
        "created_at",
    )
    list_filter = ("file_type", "status", "created_at", "user")
    search_fields = ("title", "user__username")


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("id", "document", "chunk_index", "created_at")
    list_filter = ("created_at",)
    search_fields = ("document__title", "content")
    readonly_fields = ("embedding",)
