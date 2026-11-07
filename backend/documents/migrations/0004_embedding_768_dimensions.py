import pgvector.django.vector
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0003_reset_embeddings"),
    ]

    operations = [
        migrations.AlterField(
            model_name="documentchunk",
            name="embedding",
            field=pgvector.django.vector.VectorField(dimensions=768),
        ),
    ]
