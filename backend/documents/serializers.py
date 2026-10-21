import os
from rest_framework import serializers
from .models import Document, DocumentChunk, Folder


class FolderSerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(source="documents.count", read_only=True)

    class Meta:
        model = Folder
        fields = ("id", "name", "document_count", "created_at")
        read_only_fields = ("id", "created_at", "document_count")

    def validate_name(self, value):
        user = self.context["request"].user
        qs = Folder.objects.filter(user=user, name__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A folder with this name already exists.")
        return value.strip()


class DocumentSerializer(serializers.ModelSerializer):
    folder_name = serializers.CharField(source="folder.name", read_only=True)
    chunk_count = serializers.IntegerField(source="chunks.count", read_only=True)

    class Meta:
        model = Document
        fields = (
            "id",
            "title",
            "file",
            "file_type",
            "file_size",
            "status",
            "error_message",
            "chunk_count",
            "folder",
            "folder_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "file_type",
            "file_size",
            "status",
            "error_message",
            "chunk_count",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            self.fields["folder"].queryset = Folder.objects.filter(user=request.user)

        if self.instance:
            # Update mode: file is read-only (title/folder only can be updated)
            self.fields["file"].read_only = True
            self.fields["title"].required = False
        else:
            # Create mode: file is required
            self.fields["file"].required = True
            self.fields["title"].required = False

    def validate_file(self, file_obj):
        allowed_extensions = {"pdf", "docx", "txt"}
        ext = os.path.splitext(file_obj.name)[1].lower().lstrip(".")
        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Unsupported file type (.{ext}). Only .pdf, .docx, and .txt files are allowed."
            )

        max_size = 10 * 1024 * 1024  # 10 MB
        if file_obj.size > max_size:
            raise serializers.ValidationError("File size exceeds the 10 MB limit.")

        return file_obj

    def validate_folder(self, folder):
        if folder is not None:
            request = self.context.get("request")
            if request and folder.user != request.user:
                raise serializers.ValidationError("Folder does not belong to the current user.")
        return folder

    def create(self, validated_data):
        file_obj = validated_data["file"]
        ext = os.path.splitext(file_obj.name)[1].lower().lstrip(".")
        if not validated_data.get("title"):
            validated_data["title"] = os.path.splitext(file_obj.name)[0]
        validated_data["file_type"] = ext
        validated_data["file_size"] = file_obj.size
        return super().create(validated_data)
