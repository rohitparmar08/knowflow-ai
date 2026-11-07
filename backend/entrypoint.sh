#!/bin/sh
set -e

# Apply migrations (also enables the pgvector extension) before serving traffic.
python manage.py migrate --noinput

# Embeddings are computed by the Gemini API, so memory use is small; threads handle concurrency.
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-1}" \
    --threads "${GUNICORN_THREADS:-4}" \
    --timeout "${GUNICORN_TIMEOUT:-180}" \
    --access-logfile -
