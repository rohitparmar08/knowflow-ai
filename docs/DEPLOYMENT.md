# Deployment guide

KnowFlow AI has three pieces: **Postgres with pgvector**, the **Django API**, and a **static React build**.

## 0. Run everything locally with Docker

```bash
cp .env.example .env        # fill SECRET_KEY, DB_PASSWORD, LLM_API_KEY
docker compose up --build   # first build downloads PyTorch + the embedding model (several minutes)
```
Frontend: http://localhost:3000 · API health: http://localhost:8000/api/health/

## 1. Hosting options (pick one for the API)

The API loads a sentence-transformers model, so **RAM is the deciding factor** (plan on roughly 1.5–2 GB; a 512 MB free tier will be killed).

| Option | Notes |
|---|---|
| Hugging Face Spaces (Docker SDK) | Free CPU tier has enough RAM. Disk is ephemeral, so uploaded files vanish on restart (chunks stay in the DB; "reprocess" will fail for old files). Set `app_port` to 8000 in the Space README header. |
| Fly.io / Railway / Render (paid, ≥2 GB) | Attach a persistent volume and set `MEDIA_ROOT` to it. |
| Your own VM (Oracle Cloud free ARM, a small VPS) | `docker compose up -d` behind Caddy/nginx for HTTPS. |

**Database:** any Postgres with pgvector. Neon and Supabase both offer it on a free tier (the first migration runs `CREATE EXTENSION vector`; if your provider needs it enabled manually, do that in its dashboard first). Use the pooled/standard connection string as `DATABASE_URL`.

**Frontend:** deploy `frontend/` as a static site (Vercel, Netlify, Cloudflare Pages) with build command `npm run build`, output `dist`, and the env var `VITE_API_URL=https://<your-api-host>/api`. Add a rewrite of all paths to `/index.html` (React Router).

## 2. Required environment variables (API)

| Variable | Example | Why |
|---|---|---|
| `SECRET_KEY` | long random string | App refuses to start without it when `DEBUG` is off |
| `DEBUG` | `False` | Default is already False |
| `ALLOWED_HOSTS` | `api.example.com` | Host header allow-list |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` | Your frontend origin(s), comma separated |
| `CSRF_TRUSTED_ORIGINS` | `https://app.example.com` | Same |
| `DATABASE_URL` | `postgres://user:pass@host/db` | Or use the `DB_*` variables |
| `LLM_API_KEY` / `LLM_MODEL` | Gemini key / model name | Check the model name exists for your key in Google AI Studio |
| `TRUST_PROXY_SSL_HEADER` | `True` | When the host terminates TLS for you |
| `SECURE_SSL_REDIRECT` | `True` | Optional, after HTTPS works |
| `MEDIA_ROOT` | `/data/media` | Point at a persistent disk |
| `THROTTLE_ASK`, `THROTTLE_AUTH` | `20/min`, `10/min` | Rate limits |

## 3. Release checklist

1. `python manage.py check --deploy` shows no issues with your production env vars.
2. `GET /api/health/` returns `{"status": "ok"}`.
3. Register → upload a small PDF → wait for status `ready` → ask a question → answer has `[1]` citations.
4. Frontend loads, login works, no CORS errors in the browser console.

## Known limitations

- Documents are processed synchronously inside the upload request. Large PDFs can take a while; the Gunicorn timeout is 180 s.
- Uploaded files are served only by the API (not via `/media/` in production), so the `file` URL in API responses is not a public download link.
- Retrieval is vector-only (no keyword/hybrid search yet).
