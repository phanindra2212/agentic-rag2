import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import engine, Base
from backend.app.api import auth, docs, chat, analytics
from backend.app.utils.logger import logger

# Initialize database tables (SQLite fallback or local PostgreSQL)
try:
    logger.info("Initializing SQL database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
except Exception as db_err:
    logger.critical(f"Failed to initialize database tables: {db_err}")

app = FastAPI(
    title="Production-Grade Agentic RAG SaaS API",
    description="Multi-tenant AI RAG Assistant with vector search, cross-encoder reranking, and analytics.",
    version="1.0.0"
)

# CORS Setup (Allow frontend access)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "*")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(docs.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

# Add exact mapping for POST /api/upload for prompt specification compliance
# (which was specified as POST /upload, separate from /documents/{id})
from backend.app.api.docs import upload_files
app.post("/api/upload", tags=["Documents"])(upload_files)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Agentic RAG SaaS Backend API",
        "version": "1.0.0"
    }
