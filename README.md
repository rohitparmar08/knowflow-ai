# KnowFlow AI

KnowFlow AI is a full-stack, retrieval-augmented generation (RAG) knowledge management application. It allows users to upload documents (PDF, DOCX, TXT), organize them into folders, extract and chunk text, compute semantic vector embeddings, and chat with their knowledge base using cited answers powered by Google Gemini.

---

## Features

- **Document Management**: Upload PDF, DOCX, and TXT files with synchronous text extraction, character chunking, and vector embedding.
- **Hierarchical Organization**: Categorize documents into custom folders with quick filtering, searching, and chunk inspection.
- **Multilingual Semantic Retrieval**: Semantic vector search using `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`) supporting English and Hinglish (Roman Hindi) text.
- **Grounded Citations**: Responses from Google Gemini cite exact chunks inline as `[1]`, `[2]`. Only cited sources are returned to the client.
- **Configurable Scope**: Direct questions across all documents, within a specific folder, or restricted to selected documents.
- **Model Fallback**: Automatic retry and failover to a fallback LLM model upon upstream unavailability or rate limits.
- **User Isolation**: Secure authentication via SimpleJWT ensuring users only ever access their own documents, chunks, and conversations.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide icons, ReactMarkdown.
- **Backend**: Django 5, Django REST Framework, SimpleJWT, WhiteNoise, Gunicorn.
- **Database**: PostgreSQL 14+ with the `pgvector` extension.
- **Embeddings**: `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, 384 dimensions).
- **LLM**: Google Gemini API via official `google-genai` SDK (`gemini-3.5-flash-lite`, with optional `gemini-3.8-flash` fallback).

---

## Screenshots

### 1. Authentication
![Login Page](docs/screenshots/login.png)

### 2. Document & Folder Management
![Documents Page](docs/screenshots/documents.png)

### 3. Knowledge Assistant with Citations & Sources
![Chat with Citations](docs/screenshots/chat.png)

---

## How the RAG Pipeline Works

```
[Document Upload] ──> [Text Extraction] ──> [Text Chunking] ──> [Vector Embedding] ──> [PostgreSQL pgvector]
(PDF / DOCX / TXT)    (pypdf / python-docx)  (1200 chars / 200 overlap)  (MiniLM-L12-v2 384d)   (Cosine distance index)
                                                                                                    │
[User Query] ───────> [Embed Query] ──> [Vector Search] ──> [Distance Cutoff (0.8)] ───────────────┘
                                                                │
                                      ┌─────────────────────────┴─────────────────────────┐
                                      ▼                                                   ▼
                         Any Chunks <= 0.8 Cutoff?                            All Chunks > 0.8 Cutoff
                                      │                                                   │
                                     YES                                                  NO
                                      │                                                   │
                                      ▼                                                   ▼
                           [LLM Call via Gemini]                              [Bypass LLM Call]
                        (Numbered Context Blocks)                           "I couldn't find anything
                                      │                                      relevant in your documents."
                                      ▼
                           [Grounded Answer]
                        (Inline Cites: [1], [2])
                                      │
                                      ▼
                        [Filter Uncited Sources]
```

1. **Upload & Ingestion**:
   - Files are validated (allowed extensions `.pdf`, `.docx`, `.txt`; max size 10 MB).
   - Text is extracted using `pypdf`, `python-docx`, or UTF-8 decoding.
   - Text is split into chunks of `1200` characters with `200` character overlap, snapping cleanly to sentence, line, or whitespace boundaries to avoid cutting words in half.
   - Chunks are vectorized using `paraphrase-multilingual-MiniLM-L12-v2` (384 dimensions, normalized) in batches of 32 and saved to PostgreSQL.
2. **Query & Retrieval**:
   - When a user asks a question, the query string is embedded with the same model.
   - PostgreSQL retrieves matching chunks ordered by `CosineDistance`.
   - Chunks with cosine distance greater than `RAG_MAX_DISTANCE` (default `0.8`) are discarded.
3. **Grounded Generation**:
   - If no chunks pass the cutoff, the backend skips calling the LLM entirely and immediately returns: *"I couldn't find anything relevant in your documents."*
   - If relevant chunks exist, they are formatted as numbered blocks `[1]`, `[2]` and sent to Gemini along with recent conversation history.
   - After generation, the backend extracts cited indices (e.g. `[1]`) from the text; only chunks actually cited by the model are included in the `sources` response.

---

## Local Setup Guide

### 1. Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ and `npm`
- **PostgreSQL**: 14+ with `pgvector` extension installed.

#### Installing pgvector
- **macOS (Homebrew)**:
  ```bash
  brew install pgvector
  ```
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt-get install postgresql-16-pgvector
  # or match your postgres version: postgresql-<version>-pgvector
  ```
- **Windows**:
  - Download the precompiled binary matching your PostgreSQL version from [pgvector releases](https://github.com/pgvector/pgvector/releases), copy files into your PostgreSQL directory, or install via PostgreSQL stackbuilder/source.
- **Enable vector extension**:
  Connect to PostgreSQL with `psql` and run:
  ```sql
  CREATE DATABASE knowflow_ai;
  \c knowflow_ai;
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

---

### 2. Backend Setup

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your values (see Environment Variables section below).
5. Run migrations:
   ```bash
   python manage.py migrate
   ```
6. Start development server:
   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```

---

### 3. Frontend Setup

1. In a separate terminal, navigate to `frontend/`:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Verify `VITE_API_URL` points to `http://127.0.0.1:8000/api`.
4. Start development server:
   ```bash
   npm run dev
   ```
   The UI will be accessible at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `SECRET_KEY` | Django security secret key | `django-insecure-dev-key` |
| `DEBUG` | Enable debug mode (`True`/`False`) | `True` |
| `ALLOWED_HOSTS` | Comma-separated allowed hostnames | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated CSRF trusted origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `DB_NAME` | PostgreSQL database name | `knowflow_ai` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `your_password` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DATABASE_URL` | Optional full connection URL (takes precedence if set) | `postgres://user:pass@localhost:5432/knowflow_ai` |
| `LLM_API_KEY` | Google Gemini API key from Google AI Studio | *(Required for chat)* |
| `LLM_MODEL` | Primary Gemini model name | `gemini-3.5-flash-lite` |
| `LLM_FALLBACK_MODEL` | Optional fallback Gemini model on 503/429 | `gemini-3.8-flash` |
| `EMBEDDING_MODEL` | SentenceTransformer embedding model | `paraphrase-multilingual-MiniLM-L12-v2` |
| `RAG_TOP_K` | Number of chunks retrieved per question | `8` |
| `RAG_MAX_DISTANCE` | Maximum cosine distance threshold | `0.8` |

#### How to Obtain a Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** and create a new key.
4. Copy the key and assign it to `LLM_API_KEY` in `backend/.env`.

### Frontend (`frontend/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Root URL of backend REST API | `http://127.0.0.1:8000/api` |

---

## API Endpoints

### System
- `GET /api/health/` - Service health status.

### Authentication
- `POST /api/auth/register/` - Create a new user account (`username`, `email`, `password`).
- `POST /api/auth/login/` - Obtain JWT access and refresh tokens.
- `POST /api/auth/refresh/` - Refresh expired access token.
- `GET /api/auth/me/` - Retrieve currently authenticated user profile.

### Folders
- `GET /api/folders/` - List user folders with document counts.
- `POST /api/folders/` - Create a new folder (`name`).
- `PATCH /api/folders/<id>/` - Rename folder.
- `DELETE /api/folders/<id>/` - Delete folder (associated documents are unfiled).

### Documents
- `GET /api/documents/` - List documents (supports pagination, `search`, `folder`, `status` filters).
- `POST /api/documents/` - Upload document file (`multipart/form-data`).
- `GET /api/documents/<id>/` - Retrieve document detail.
- `PATCH /api/documents/<id>/` - Update title or assigned folder.
- `DELETE /api/documents/<id>/` - Delete document and associated chunks.
- `POST /api/documents/<id>/reprocess/` - Trigger re-chunking and re-embedding.
- `GET /api/documents/<id>/chunks/` - List extracted text chunks for a document.

### Chat & Q&A
- `GET /api/chat/conversations/` - List user conversations ordered by last update.
- `GET /api/chat/conversations/<id>/` - Conversation history with messages and sources.
- `PATCH /api/chat/conversations/<id>/` - Rename conversation title.
- `DELETE /api/chat/conversations/<id>/` - Delete conversation and its messages.
- `POST /api/chat/ask/` - Ask a question (`question`, optional `conversation_id`, optional `folder_id`, optional `document_ids`).

---

## Management Commands

### `search_chunks`
Perform a manual semantic search directly against stored vector chunks:
```bash
python manage.py search_chunks "What is the bullwhip effect?" --user <username> --top 5
```
Example output:
```text
Top 5 matching chunks for query 'What is the bullwhip effect?' (user: alice):
[1] Title: Supply_Chain_Notes | Chunk: 13 | Cosine Distance: 0.7422
    Content: Bullwhip effect: customer demand mein chhota change supply chain mein distort ho jaata hai...
```

---

## Known Limitations

- **Short Keyword Retrieval**: Short keyword-style questions (for example "4 V's of big data") can miss the right chunk, because retrieval is vector-only. Adding keyword (full-text) search alongside the vectors would address this.
- **Synchronous Ingestion**: Documents are extracted, chunked, and embedded synchronously during the upload HTTP request. Very large files or batch uploads may experience longer request response times.
- **Model Download Size & Resource Usage**: The first time the application runs, it automatically downloads `paraphrase-multilingual-MiniLM-L12-v2` (~480 MB) into the local HuggingFace cache. PyTorch and the transformer model require substantial RAM and disk, and have not been tested on minimal free hosting tiers (e.g. 512MB RAM instances).
- **Local Storage**: Uploaded files are stored on the local file system under `backend/media/` rather than cloud object storage (e.g., S3).
- **No OCR**: Only digital text from PDFs, DOCX, and text files is parsed. Scanned images or scanned PDFs without embedded text layers are not OCR-processed.
- **No Streaming Responses**: Answers from the Gemini LLM are returned as single completed JSON payloads; streaming server-sent events (SSE) are not currently implemented.
- **Distance Cutoff & Top-K Tuning**: The default cutoff threshold `RAG_MAX_DISTANCE = 0.8` was tuned against a test dataset of mixed English and Hinglish domain documents. Depending on document vocabulary and domain specificity, this value may require adjustment. RAG_TOP_K is 8 because with 5 some relevant chunks (for example the cloud service models section of the test PDF) fell just outside the results. The top-k of 8 and the distance cutoff of 0.8 were tuned on a small set of test documents.
- **Upstream Gemini Availability**: Answer generation depends on Google Gemini API availability; temporary spikes in Google's cloud service can return 503 or 429 rate limit errors (mitigated by automated exponential backoff and the optional fallback model).
