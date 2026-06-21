import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple
import time

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

from backend.app.config.settings import (
    get_user_chroma_dir,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    CHROMA_COLLECTION_PREFIX
)
from backend.app.loaders.pdf_loader import load_pdf
from backend.app.loaders.docx_loader import load_docx
from backend.app.loaders.pptx_loader import load_pptx
from backend.app.loaders.txt_loader import load_txt
from backend.app.rag.embeddings import get_embeddings_model
from backend.app.utils.logger import logger
from backend.app.utils.helpers import clean_text, get_file_extension

def get_vector_store(user_id: int) -> Chroma:
    """Initializes and returns the persistent Chroma vector store for a specific user."""
    embeddings = get_embeddings_model()
    chroma_dir = get_user_chroma_dir(user_id)
    
    collection_name = f"{CHROMA_COLLECTION_PREFIX}{user_id}"
    logger.info(f"Accessing isolated Chroma collection: {collection_name} for user {user_id}")
    
    return Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=str(chroma_dir)
    )

def extract_documents(file_path: str) -> List[Document]:
    """Extracts text from a file based on its extension."""
    ext = get_file_extension(file_path)
    if ext == ".pdf":
        return load_pdf(file_path)
    elif ext == ".docx":
        return load_docx(file_path)
    elif ext == ".pptx":
        return load_pptx(file_path)
    elif ext == ".txt":
        return load_txt(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

def process_and_index_file(file_path: str, user_id: int) -> Tuple[int, int]:
    """Loads, chunks, and indexes a file into a user's isolated Chroma DB collection.
    
    Returns:
        Tuple of (number of chunks, total pages)
    """
    logger.info(f"Indexing file: {file_path} for user: {user_id}")
    try:
        path = Path(file_path)
        file_name = path.name
        ext = get_file_extension(str(path))
        
        # 1. Load document
        docs = extract_documents(str(path))
        total_pages = len(docs)
        
        # 2. Clean content
        for doc in docs:
            doc.page_content = clean_text(doc.page_content)
            
        # 3. Chunk documents
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len
        )
        chunks = text_splitter.split_documents(docs)
        
        # 4. Add unique IDs and rich metadata to each chunk
        upload_time = datetime.utcnow().isoformat()
        processed_chunks = []
        
        for idx, chunk in enumerate(chunks):
            chunk_id = f"user_{user_id}_{file_name}_chunk_{idx}"
            chunk.metadata.update({
                "file_name": file_name,
                "file_type": ext[1:].upper() if ext.startswith(".") else ext.upper(),
                "chunk_id": chunk_id,
                "source": str(path),
                "upload_time": upload_time,
                "user_id": user_id
            })
            processed_chunks.append(chunk)
            
        # 5. Connect to Chroma and delete existing chunks of the same file (for updates/replacements)
        db = get_vector_store(user_id)
        try:
            existing = db.get(where={"file_name": file_name})
            if existing and existing.get("ids"):
                logger.info(f"Removing {len(existing['ids'])} existing chunks for {file_name} from user {user_id} collection.")
                db.delete(ids=existing["ids"])
        except Exception as e:
            logger.warning(f"Could not check/delete existing entries for {file_name}: {e}")
            
        # 6. Add new chunks to database with batching and retry logic
        if processed_chunks:
            chunk_ids = [chunk.metadata["chunk_id"] for chunk in processed_chunks]
            batch_size = 40
            total_batches = (len(processed_chunks) + batch_size - 1) // batch_size
            
            for batch_idx in range(total_batches):
                start_i = batch_idx * batch_size
                end_i = min(start_i + batch_size, len(processed_chunks))
                batch_docs = processed_chunks[start_i:end_i]
                batch_ids = chunk_ids[start_i:end_i]
                
                max_retries = 5
                base_delay = 2.0
                
                for attempt in range(max_retries):
                    try:
                        db.add_documents(batch_docs, ids=batch_ids)
                        logger.info(f"Indexed batch {batch_idx + 1}/{total_batches} for {file_name} (user {user_id}).")
                        break
                    except Exception as e:
                        err_msg = str(e).upper()
                        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "QUOTA" in err_msg:
                            delay = base_delay * (2 ** attempt)
                            logger.warning(
                                f"Rate limit hit during batch {batch_idx + 1}. "
                                f"Retrying in {delay:.1f}s... (Attempt {attempt + 1}/{max_retries})"
                            )
                            time.sleep(delay)
                        else:
                            logger.error(f"Failed to add document batch {batch_idx + 1}: {e}")
                            raise e
                else:
                    raise RuntimeError("Document ingestion aborted: rate limits exceeded repeatedly.")
                    
        return len(processed_chunks), total_pages

    except Exception as e:
        logger.error(f"Error during document indexing for {file_path}: {e}", exc_info=True)
        raise e

def remove_document_from_db(file_name: str, user_id: int) -> None:
    """Removes a file and all its chunks from a user's isolated Chroma DB collection."""
    logger.info(f"Removing file: {file_name} from user {user_id} collection.")
    db = get_vector_store(user_id)
    try:
        existing = db.get(where={"file_name": file_name})
        if existing and existing.get("ids"):
            db.delete(ids=existing["ids"])
            logger.info(f"Successfully deleted {len(existing['ids'])} chunks for {file_name}.")
    except Exception as e:
        logger.error(f"Error deleting file {file_name} from database: {e}")
        raise e
