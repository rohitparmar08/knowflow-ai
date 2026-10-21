from rest_framework import serializers
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "role", "content", "sources", "created_at")
        read_only_fields = ("id", "role", "content", "sources", "created_at")


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "updated_at", "message_count")
        read_only_fields = ("id", "updated_at", "message_count")


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "created_at", "updated_at", "messages")
        read_only_fields = ("id", "created_at", "updated_at", "messages")


class ConversationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ("id", "title")

    def validate_title(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Title cannot be empty.")
        return val


class AskRequestSerializer(serializers.Serializer):
    question = serializers.CharField(required=True, allow_blank=False, max_length=2000)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
    folder_id = serializers.IntegerField(required=False, allow_null=True)
    document_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )

    def validate_question(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Question cannot be empty.")
        return val
