import os
from pathlib import Path
from dotenv import load_dotenv

# Base Paths (monorepo structure)
APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
BASE_DIR = BACKEND_DIR.parent  # Workspace root: c:\Users\phani\Desktop\googlebootcamp\agentic-ai-rag

# Load environment variables
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

# Storage Directory for user isolation
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Cache downloaded models under the project storage folder to persist across Docker rebuilds
os.environ["HF_HOME"] = str(STORAGE_DIR / "hf_cache")


def get_user_upload_dir(user_id: int) -> Path:
    """Returns the isolated upload directory for a specific user."""
    upload_dir = STORAGE_DIR / "users" / str(user_id) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir

def get_user_chroma_dir(user_id: int) -> Path:
    """Returns the isolated Chroma database directory for a specific user."""
    chroma_dir = STORAGE_DIR / "users" / str(user_id) / "chroma"
    chroma_dir.mkdir(parents=True, exist_ok=True)
    return chroma_dir

# File Settings
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_FILE_COUNT = 50

# Chunking Configuration
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100

# Vector DB Settings
CHROMA_COLLECTION_PREFIX = "user_"

# Models
GEMINI_MODEL_NAME = "gemini-2.5-flash"
EMBEDDING_MODEL_NAME = "BAAI/bge-m3"
RERANKER_MODEL_NAME = "BAAI/bge-reranker-v2-m3"

# Log File Path
LOG_FILE_PATH = BASE_DIR / "app.log"

# Retrieval Settings
RETRIEVE_TOP_K = 20
RERANK_TOP_K = 5

def get_gemini_api_key() -> str:
    """Retrieves the Gemini API Key from environment variables."""
    return os.getenv("GEMINI_API_KEY", "")
