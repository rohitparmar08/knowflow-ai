from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, FolderViewSet

router = DefaultRouter()
router.register(r"folders", FolderViewSet, basename="folder")
router.register(r"documents", DocumentViewSet, basename="document")

urlpatterns = router.urls
