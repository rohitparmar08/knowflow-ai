#!/bin/sh
set -e

# Apply migrations (also enables the pgvector extension) before serving traffic.
python manage.py migrate --noinput

# Each worker loads its own copy of the embedding model (~500 MB), so keep workers low and use threads.
exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-1}" \
    --threads "${GUNICORN_THREADS:-4}" \
    --timeout "${GUNICORN_TIMEOUT:-180}" \
    --access-logfile -
