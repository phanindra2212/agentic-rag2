import json
import asyncio
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, ChatHistory, Analytics
from backend.app.schemas import ChatRequest, ChatMessageResponse, ChatHistoryResponse, CitationSchema
from backend.app.dependencies import get_current_user
from backend.app.agents.workflow import execute_agentic_rag

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_class=StreamingResponse)
async def chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Executes the agentic RAG pipeline and streams the response text and metadata back to the client."""
    
    async def event_generator():
        # Fetch the user's recent chat history from SQL DB (up to last 5 queries)
        recent_history_db = db.query(ChatHistory).filter(
            ChatHistory.user_id == current_user.id
        ).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        
        # Format history for LangGraph prompt input
        chat_history_list = []
        for h in reversed(recent_history_db):
            chat_history_list.append({"role": "user", "content": h.question})
            chat_history_list.append({"role": "assistant", "content": h.response})
            
        filters = {
            "file_names": request.file_names,
            "file_types": request.file_types
        }
        
        # Run RAG workflow synchronously in an executor to avoid blocking the async event loop
        loop = asyncio.get_event_loop()
        start_time = time.time()
        
        try:
            result = await loop.run_in_executor(
                None,
                lambda: execute_agentic_rag(
                    user_id=current_user.id,
                    question=request.question,
                    chat_history=chat_history_list,
                    filters=filters
                )
            )
        except Exception as e:
            # Yield error event
            yield f"event: error\ndata: {json.dumps({'detail': f'RAG pipeline execution failed: {str(e)}'})}\n\n"
            return
            
        total_latency = time.time() - start_time
        retrieval_time = result.get("retrieval_time", 0.0)
        response_time = result.get("response_time", 0.0)
        answer = result.get("answer", "")
        citations = result.get("citations", [])
        
        # Estimate tokens used (simple heuristic: 1 token = 4 characters)
        query_chars = len(request.question)
        answer_chars = len(answer)
        tokens_estimated = int((query_chars + answer_chars) / 4)
        
        # 1. Send metadata block first
        meta_payload = {
            "citations": citations,
            "confidence_score": result.get("confidence_score", "Low Confidence"),
            "confidence_val": result.get("confidence_val", 0.0),
            "complexity": result.get("complexity", "simple"),
            "generated_queries": result.get("generated_queries", []),
            "retrieval_time": retrieval_time,
            "response_time": response_time,
            "total_time": total_latency
        }
        yield f"event: metadata\ndata: {json.dumps(meta_payload)}\n\n"
        await asyncio.sleep(0.05)
        
        # 2. Stream the response content token-by-token (or chunk-by-chunk for smooth UI rendering)
        words = answer.split(" ")
        for i, word in enumerate(words):
            space = " " if i > 0 else ""
            yield f"event: token\ndata: {json.dumps({'text': space + word})}\n\n"
            # Fast typing simulation effect
            await asyncio.sleep(0.015)
            
        # 3. Save chat history to SQL database
        new_chat = ChatHistory(
            user_id=current_user.id,
            question=request.question,
            response=answer,
            retrieval_time=retrieval_time,
            response_time=response_time,
            tokens_used=tokens_estimated
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)
        
        # 4. Update user running analytics metrics
        analytics = db.query(Analytics).filter(Analytics.user_id == current_user.id).first()
        if not analytics:
            analytics = Analytics(user_id=current_user.id)
            db.add(analytics)
            db.commit()
            db.refresh(analytics)
            
        # Calculate new averages
        old_count = analytics.query_count
        new_count = old_count + 1
        old_latency = analytics.average_latency
        
        analytics.query_count = new_count
        analytics.tokens_used += tokens_estimated
        analytics.average_latency = ((old_latency * old_count) + total_latency) / new_count
        db.commit()
        
        # 5. Send done signal
        yield f"event: done\ndata: {json.dumps({'chat_id': new_chat.id})}\n\n"
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/history", response_model=ChatHistoryResponse)
def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves the past chat history for the authenticated user, complete with metadata and citations."""
    history_items = db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id
    ).order_by(ChatHistory.timestamp.desc()).limit(50).all()
    
    response_list = []
    for item in history_items:
        # Re-construct citations based on the document name page metadata
        # (This is static mapping from saved response text or DB. In a real-world SaaS, citations can be saved)
        # We can extract citations from the text or pass a default list.
        # Let's extract filenames mentioned in the text like [Document: sales.pdf, Page: 3]
        citations = []
        found = re.findall(r"\[Document:\s*([^,]+),\s*Page:\s*(\d+)\]", item.response)
        seen_cit = set()
        for fname, pnum in found:
            key = f"{fname}_{pnum}"
            if key not in seen_cit:
                seen_cit.add(key)
                citations.append(CitationSchema(file_name=fname, page_number=int(pnum)))
                
        response_list.append(
            ChatMessageResponse(
                id=item.id,
                question=item.question,
                response=item.response,
                timestamp=item.timestamp,
                retrieval_time=item.retrieval_time,
                response_time=item.response_time,
                tokens_used=item.tokens_used,
                citations=citations
            )
        )
        
    return ChatHistoryResponse(history=response_list)

@router.delete("/history")
def delete_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deletes all chat history rows for the authenticated user."""
    db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id).delete()
    db.commit()
    return {"detail": "Chat history cleared successfully."}

import re  # Used for regex search in citations
