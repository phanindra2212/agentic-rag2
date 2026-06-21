# Production-Grade Agentic Multi-Document RAG SaaS Platform

This is a production-ready, secure multi-tenant AI knowledge assistant platform. It is engineered with a **Next.js 15+ frontend**, a **FastAPI backend**, **PostgreSQL database schema**, and an agentic self-correcting RAG loop using **LangGraph**, **Gemini 2.5 Flash**, **ChromaDB**, **BAAI/bge-m3 embeddings**, and **BAAI/bge-reranker-v2-m3**.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[Next.js 15 Frontend] <-->|JWT Auth / Streams / JSON| API[FastAPI Backend]
    API <-->|SQL Data / Analytics| DB[(PostgreSQL / SQLite)]
    
    subgraph Multi-Tenant RAG Pipeline
        API -->|Sandboxed Paths| Storage[storage/users/{user_id}/]
        Storage -->|Raw Uploads| Uploads[uploads/]
        Storage -->|User Collection| VectorDB[(Chroma Persistent DB)]
        
        API -->|User Prompt & Context| Graph[LangGraph Agent Loop]
        Graph -->|Query Intent| QueryAgent[Query Agent]
        Graph -->|Vector Search| RetrievalAgent[Retrieval Agent]
        Graph -->|BGE Cross-Encoder Reranker| ContextAgent[Context Agent]
        Graph -->|Grounded Gemini Generation| ResponseAgent[Response Agent]
        Graph -->|Hallucination Filter| ValidationAgent[Validation Agent]
        
        ValidationAgent -->|Approved| API
        ValidationAgent -->|Hallucination Detected - Retry| ResponseAgent
    end
```

---

## 🔒 Document & Vector Isolation (Multi-Tenancy)
Security and tenant sandboxing are enforced at the filesystem level.
Every registered user has an isolated partition:
```text
storage/
   users/
      {user_id}/
          uploads/     <-- Raw PDF, DOCX, PPTX, TXT files
          chroma/      <-- Isolated Chroma vector db folder
```
ChromaDB utilizes dedicated user collections named `user_{user_id}`. Cross-tenant reads/writes/searches are programmatically impossible.

---

## ⚡ Key Features

* **Multi-Format Uploads**: Supports PDF, DOCX, PPTX, and TXT files simultaneously (validating sizes up to 50MB).
* **Multi-Stage Agentic Workflow**:
  - **Query Agent**: Intent detection, complexity classification, and query expansion (3 variations).
  - **Retrieval Agent**: Fetching candidates from user collection.
  - **Context Agent**: De-duplication and BGE-Reranker-v2-m3 Cross-Encoder filtering (Top-20 down to Top-5).
  - **Response Agent**: Grounded response generation with inline citation placeholders.
  - **Validation Agent**: Groundedness checks to eliminate hallucinations.
* **ChatGPT-Style Streaming UI**: Implements smooth server-sent event (SSE) streaming client.
* **Per-User Telemetry & Cost Projection**: Tracks query count, tokens consumed, latency trend (Recharts), storage size, and cost estimates.
* **Google AdSense Integration**: Responsive, mobile-friendly ad slot components (`<BannerAd />`, `<SidebarAd />`, `<ContentAd />`) with error safety.

---

## 🛠️ Local Development & Quickstart

### Prerequisites
* Node.js 20+
* Python 3.11+
* Gemini API Key

### Option A: Standard Manual Run

#### 1. Setup Backend
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///./rag_saas.db
JWT_SECRET=super_secret_jwt_signing_key_here
```

Initialize environment and run:
```bash
# Enter project root
cd agentic-ai-rag

# Create virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
source .venv/bin/activate    # Linux/Mac

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

### Option B: Docker Compose (PostgreSQL Production Simulation)
To run the complete PostgreSQL stack, backend API, and frontend client concurrently:

```bash
docker-compose up --build
```
This maps:
* **Frontend Client**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:8000](http://localhost:8000)
* **PostgreSQL DB**: Port `5432`

---

## 🚀 Production Deployment Guidelines

### 1. Database (Neon PostgreSQL)
* Provision a serverless PostgreSQL instance on **Neon.tech**.
* Copy the connection string and inject it as `DATABASE_URL` in your backend environment variables (FastAPI will automatically utilize `postgresql+psycopg` dialect).

### 2. Backend (Render / Railway)
* Build the backend using `backend/Dockerfile`.
* Mount a persistent disk volume mapping `/backend/storage` to preserve uploaded documents and Chroma DB index files.
* Inject environment variables: `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`.

### 3. Frontend (Vercel)
* Link the `frontend/` directory to **Vercel**.
* Configure the build output framework as Next.js.
* Add Environment Variable `NEXT_PUBLIC_API_URL` pointing to your deployed backend URL (e.g. `https://api.yourdomain.com`).
