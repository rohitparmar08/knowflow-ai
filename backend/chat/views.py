from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from documents.models import Document, Folder
from .models import Conversation, Message
from .serializers import (
    AskRequestSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    ConversationUpdateSerializer,
    MessageSerializer,
)
from .services.rag import answer_question


class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user).order_by("-updated_at")

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        if self.action == "partial_update":
            return ConversationUpdateSerializer
        return ConversationDetailSerializer

    def perform_destroy(self, instance):
        instance.delete()


class AskView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = AskRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data["question"]
        conversation_id = serializer.validated_data.get("conversation_id")
        folder_id = serializer.validated_data.get("folder_id")
        document_ids = serializer.validated_data.get("document_ids")

        user = request.user

        # 1. Validate conversation_id if provided (owner only, else 404)
        conversation = None
        if conversation_id is not None:
            conversation = get_object_or_404(
                Conversation.objects.filter(user=user),
                id=conversation_id,
            )

        # 2. Validate folder_id if provided (owner only, else 400)
        if folder_id is not None:
            if not Folder.objects.filter(user=user, id=folder_id).exists():
                return Response(
                    {"detail": "Folder does not exist or does not belong to you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 3. Validate document_ids if provided (owner only, else 400)
        if document_ids:
            unique_doc_ids = set(document_ids)
            existing_count = Document.objects.filter(
                user=user,
                id__in=unique_doc_ids,
            ).count()
            if existing_count != len(unique_doc_ids):
                return Response(
                    {"detail": "One or more documents do not exist or do not belong to you."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 4. Execute RAG pipeline
        try:
            answer, sources = answer_question(
                user=user,
                question=question,
                conversation=conversation,
                document_ids=document_ids,
                folder_id=folder_id,
            )
        except RuntimeError as e:
            # LLM or configuration failure: return 502 and do not persist anything
            return Response(
                {"detail": str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # 5. Persist messages and conversation upon successful answer
        if conversation is None:
            conversation = Conversation.objects.create(
                user=user,
                title=question[:60].strip(),
            )

        user_message = Message.objects.create(
            conversation=conversation,
            role="user",
            content=question,
            sources=[],
        )

        assistant_message = Message.objects.create(
            conversation=conversation,
            role="assistant",
            content=answer,
            sources=sources,
        )

        # Bump updated_at on the conversation
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=["updated_at"])

        return Response(
            {
                "conversation_id": conversation.id,
                "user_message": MessageSerializer(user_message).data,
                "assistant_message": MessageSerializer(assistant_message).data,
            },
            status=status.HTTP_200_OK,
        )
