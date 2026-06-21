import os
import torch
from langchain_core.embeddings import Embeddings
from backend.app.config.settings import EMBEDDING_MODEL_NAME
from backend.app.utils.logger import logger

try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    HAS_HUGGINGFACE_EMBEDDINGS = True
except ImportError:
    HAS_HUGGINGFACE_EMBEDDINGS = False
    HuggingFaceEmbeddings = None

def get_embeddings_model() -> Embeddings:
    """Returns the primary BAAI/bge-m3 embeddings model,
    auto-configuring GPU/CPU usage and enabling normalization.
    """
    if not HAS_HUGGINGFACE_EMBEDDINGS:
        logger.error(
            "langchain-community or sentence-transformers is not installed in the current environment! "
            "Please run the backend using the virtual environment (.venv) or install "
            "dependencies using: pip install -r backend/requirements.txt"
        )
        raise RuntimeError("Missing RAG embedding dependencies. Check logs.")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Initializing Hugging Face Embeddings (Model: {EMBEDDING_MODEL_NAME}) on device: {device}...")
    
    try:
        # Standard configuration for BGE-M3
        model_kwargs = {"device": device, "trust_remote_code": True}
        encode_kwargs = {"normalize_embeddings": True}
        
        embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL_NAME,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs
        )
        logger.info("Embeddings model loaded successfully.")
        return embeddings
    except Exception as e:
        logger.warning(f"Failed to load embedding model {EMBEDDING_MODEL_NAME}: {e}. Trying fallback HF Inference API or offline model.")
        # Fallback to a lightweight model or online API
        try:
            # Fallback to miniLM
            return HuggingFaceEmbeddings(
                model_name="sentence-transformers/all-MiniLM-L6-v2",
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True}
            )
        except Exception as fe:
            logger.critical(f"Critical failure loading embeddings fallback: {fe}")
            raise fe
