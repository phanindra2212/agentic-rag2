import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, Document, Analytics
from backend.app.schemas import DocumentResponse
from backend.app.dependencies import get_current_user
from backend.app.config.settings import get_user_upload_dir, SUPPORTED_EXTENSIONS, MAX_FILE_SIZE_BYTES
from backend.app.rag.ingest import process_and_index_file, remove_document_from_db

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=List[DocumentResponse])
async def upload_files(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Uploads, validates, and indexes multiple files under the user's isolated storage directory."""
    user_upload_dir = get_user_upload_dir(current_user.id)
    uploaded_docs = []
    
    for file in files:
        # Check file extension
        _, ext = os.path.splitext(file.filename.lower())
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format: {file.filename}. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
            )
            
        # Save file to user uploads path
        file_path = user_upload_dir / file.filename
        
        # Read file chunks to enforce size limit and save
        file_size = 0
        with open(file_path, "wb") as f:
            while chunk := await file.read(8192):
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE_BYTES:
                    f.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File {file.filename} exceeds the maximum size limit of 50MB."
                    )
                f.write(chunk)
                
        try:
            # Process and index file in Chroma user collection
            chunk_count, total_pages = process_and_index_file(str(file_path), current_user.id)
            
            # Check if document already exists in SQL database, delete if so to update
            existing_doc = db.query(Document).filter(
                Document.user_id == current_user.id,
                Document.file_name == file.filename
            ).first()
            
            if existing_doc:
                db.delete(existing_doc)
                db.commit()
                
            # Create Document metadata record in SQL
            new_doc = Document(
                user_id=current_user.id,
                file_name=file.filename,
                file_type=ext[1:].upper(),
                chunk_count=chunk_count
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)
            uploaded_docs.append(new_doc)
            
        except Exception as e:
            # Clean up saved file on indexing failure
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process and index {file.filename}: {str(e)}"
            )
            
    return uploaded_docs

@router.get("", response_model=List[DocumentResponse])
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all indexed documents belonging to the active user."""
    return db.query(Document).filter(Document.user_id == current_user.id).all()

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves metadata for a specific document, enforcing ownership isolation."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )
    return doc

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes a document from SQL database, deletes it from Chroma, and deletes the raw file."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied."
        )
        
    try:
        # Delete from ChromaDB
        remove_document_from_db(doc.file_name, current_user.id)
        
        # Delete raw file from local storage
        user_upload_dir = get_user_upload_dir(current_user.id)
        raw_file_path = user_upload_dir / doc.file_name
        if raw_file_path.exists():
            os.remove(raw_file_path)
            
        # Delete from SQL DB
        db.delete(doc)
        db.commit()
        
        return {"detail": f"Document '{doc.file_name}' deleted successfully."}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )
