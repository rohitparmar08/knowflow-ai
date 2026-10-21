from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from .models import Document, DocumentChunk, Folder
from .serializers import DocumentSerializer, FolderSerializer
from .services.processing import process_document


class DocumentPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class FolderViewSet(viewsets.ModelViewSet):
    serializer_class = FolderSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Folder.objects.filter(user=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = (permissions.IsAuthenticated,)
    pagination_class = DocumentPagination
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        queryset = Document.objects.filter(user=self.request.user)

        folder_id = self.request.query_params.get("folder")
        if folder_id is not None:
            if folder_id.lower() in ("null", "none"):
                queryset = queryset.filter(folder__isnull=True)
            else:
                queryset = queryset.filter(folder_id=folder_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(title__icontains=search.strip())

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.strip().lower())

        return queryset.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = serializer.save(user=self.request.user)

        # Run extraction, chunking, and embedding synchronously right after upload
        process_document(document)
        document.refresh_from_db()

        headers = self.get_success_headers(serializer.data)
        return Response(
            self.get_serializer(document).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_destroy(self, instance):
        if instance.file and instance.file.storage.exists(instance.file.name):
            instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        document = self.get_object()
        process_document(document)
        document.refresh_from_db()
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["get"])
    def chunks(self, request, pk=None):
        document = self.get_object()
        chunks_qs = document.chunks.all().order_by("chunk_index")
        data = [
            {
                "chunk_index": c.chunk_index,
                "content": c.content,
                "character_count": len(c.content),
            }
            for c in chunks_qs
        ]
        return Response(data)
