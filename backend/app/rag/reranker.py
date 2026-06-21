import torch
from backend.app.config.settings import RERANKER_MODEL_NAME
from backend.app.utils.logger import logger
from typing import List, Optional
from langchain_core.documents import Document

try:
    from sentence_transformers import CrossEncoder
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    CrossEncoder = None

_reranker_instance = None

def get_reranker() -> Optional[CrossEncoder]:
    """Loads and caches the reranker cross-encoder model."""
    global _reranker_instance
    if _reranker_instance is not None:
        return _reranker_instance
        
    if not HAS_SENTENCE_TRANSFORMERS:
        logger.error(
            "sentence-transformers is not installed in the current environment! "
            "Please run the backend using the virtual environment (.venv) or install "
            "dependencies using: pip install -r backend/requirements.txt"
        )
        return None
        
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading reranker model: {RERANKER_MODEL_NAME} on device: {device}...")
    try:
        _reranker_instance = CrossEncoder(RERANKER_MODEL_NAME, device=device, trust_remote_code=True)
        logger.info("Reranker loaded successfully.")
    except Exception as e:
        logger.warning(f"Failed to load {RERANKER_MODEL_NAME} due to: {e}. Falling back to a lightweight cross-encoder.")
        try:
            # Fallback to a fast, resource-friendly model
            _reranker_instance = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", device="cpu", trust_remote_code=True)
            logger.info("Fallback lightweight reranker loaded successfully.")
        except Exception as fe:
            logger.critical(f"Failed to load fallback reranker: {fe}")
            _reranker_instance = None
            
    return _reranker_instance

def rerank_documents(query: str, documents: List[Document], top_k: int = 5) -> List[Document]:
    """Reranks a list of documents relative to the query and returns the top_k sorted documents."""
    if not documents:
        return []
    if len(documents) <= 1:
        return documents[:top_k]
        
    reranker = get_reranker()
    if not reranker:
        logger.warning("No reranker available. Returning first top_k items.")
        return documents[:top_k]
        
    try:
        # Prepare inputs
        pairs = [[query, doc.page_content] for doc in documents]
        
        # Predict relevance scores (higher is more relevant)
        scores = reranker.predict(pairs)
        
        # Combine docs and scores, then sort
        scored_docs = list(zip(documents, scores))
        scored_docs.sort(key=lambda x: x[1], reverse=True)
        
        # Extract top_k
        final_docs = [doc for doc, score in scored_docs[:top_k]]
        logger.info(f"Reranked {len(documents)} down to {len(final_docs)} chunks.")
        return final_docs
    except Exception as e:
        logger.error(f"Error during reranking: {e}", exc_info=True)
        return documents[:top_k]
