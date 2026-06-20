import os
from pathlib import Path
from dotenv import load_dotenv

# Base Paths
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma_db"

# Create directories if they do not exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# File Settings
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt"}
MAX_FILE_COUNT = 10

# Chunking Configuration
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Vector DB Settings
CHROMA_COLLECTION_NAME = "rag_documents"

# Models
GEMINI_MODEL_NAME = "gemini-3.5-flash"
EMBEDDING_MODEL_NAME = "BAAI/bge-m3"
FALLBACK_EMBEDDING_MODEL_NAME = "models/gemini-embedding-2"

# Retrieval Settings
DEFAULT_TOP_K = 5
MAX_TOP_K = 15

# Query Expansion Setting
MULTI_QUERY_COUNT = 3

# Logging
LOG_FILE_PATH = BASE_DIR / "app.log"

def get_gemini_api_key() -> str:
    """Returns the custom API key from Streamlit session state if available,
    otherwise falls back to the system environment variable.
    """
    try:
        import streamlit as st
        # Only return custom key if it's set and not empty
        if st.runtime.exists() and st.session_state.get("custom_gemini_api_key"):
            return st.session_state["custom_gemini_api_key"].strip()
    except Exception:
        pass
    return os.getenv("GEMINI_API_KEY", "")
