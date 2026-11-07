from django.db import migrations

REPROCESS_MESSAGE = (
    "The embedding model was changed, so this document must be indexed again. "
    "Click Reprocess."
)


def clear_old_embeddings(apps, schema_editor):
    """Vectors from the previous model (384 dimensions) cannot be compared with the new ones."""
    Document = apps.get_model("documents", "Document")
    DocumentChunk = apps.get_model("documents", "DocumentChunk")
    DocumentChunk.objects.all().delete()
    Document.objects.filter(status__in=["ready", "processing"]).update(
        status="failed", error_message=REPROCESS_MESSAGE
    )


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_document_error_message_documentchunk"),
    ]

    operations = [
        migrations.RunPython(clear_old_embeddings, migrations.RunPython.noop),
    ]
