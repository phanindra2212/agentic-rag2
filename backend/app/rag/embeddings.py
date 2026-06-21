import os
from langchain_core.embeddings import Embeddings
from backend.app.config.settings import EMBEDDING_MODEL_NAME
from backend.app.utils.logger import logger

try:
    import torch
    from langchain_community.embeddings import HuggingFaceEmbeddings
    HAS_HUGGINGFACE_EMBEDDINGS = True
except ImportError:
    HAS_HUGGINGFACE_EMBEDDINGS = False
    HuggingFaceEmbeddings = None
    torch = None


def get_embeddings_model() -> Embeddings:
    """Returns the primary BAAI/bge-m3 embeddings model if local libraries are installed,
    otherwise falls back to Google GenAI cloud embeddings (text-embedding-004) to save memory/resources.
    """
    if not HAS_HUGGINGFACE_EMBEDDINGS:
        from langchain_google_genai import GoogleGenAIEmbeddings
        from backend.app.config.settings import get_gemini_api_key
        api_key = get_gemini_api_key()
        logger.info("sentence-transformers not installed. Using Google GenAI cloud embeddings (text-embedding-004) to minimize memory footprint.")
        return GoogleGenAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )


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
