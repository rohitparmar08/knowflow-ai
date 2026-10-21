from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import AskView, ConversationViewSet

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("ask/", AskView.as_view(), name="chat_ask"),
    path("", include(router.urls)),
]
