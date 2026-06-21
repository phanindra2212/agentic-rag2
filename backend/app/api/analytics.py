import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, Document, ChatHistory, Analytics
from backend.app.schemas import UserAnalyticsResponse
from backend.app.dependencies import get_current_user
from backend.app.config.settings import get_user_upload_dir

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("", response_model=UserAnalyticsResponse)
def get_user_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculates and retrieves per-user metrics for the frontend analytics panel."""
    # 1. Fetch running analytics counters
    analytics = db.query(Analytics).filter(Analytics.user_id == current_user.id).first()
    
    queries = analytics.query_count if analytics else 0
    tokens = analytics.tokens_used if analytics else 0
    avg_lat = analytics.average_latency if analytics else 0.0
    
    # 2. Get document listings and chunk totals
    docs_list = db.query(Document).filter(Document.user_id == current_user.id).all()
    docs_count = len(docs_list)
    chunks_count = sum(doc.chunk_count for doc in docs_list)
    
    # 3. Read filesystem uploads directory to calculate total storage usage
    upload_dir = get_user_upload_dir(current_user.id)
    total_storage = 0
    if upload_dir.exists():
        for f in upload_dir.iterdir():
            if f.is_file():
                try:
                    total_storage += f.stat().st_size
                except Exception:
                    pass
                    
    # 4. Compile recent chat latencies to build a trend chart
    recent_chats = db.query(ChatHistory).filter(
        ChatHistory.user_id == current_user.id
    ).order_by(ChatHistory.timestamp.desc()).limit(15).all()
    
    latency_trend = []
    # Reverse so the list goes chronological (left to right on the chart)
    for chat in reversed(recent_chats):
        latency_trend.append({
            "id": chat.id,
            "question": chat.question[:25] + "..." if len(chat.question) > 25 else chat.question,
            "timestamp": chat.timestamp.isoformat(),
            "retrieval_time": chat.retrieval_time,
            "response_time": chat.response_time,
            "total_time": chat.retrieval_time + chat.response_time
        })
        
    # 5. Estimate cost based on token counts
    # Gemini 2.5 Flash price rate: ~$0.075 per 1M input tokens + ~$0.30 per 1M output tokens.
    # Blended average estimation: $0.00000020 per token.
    cost_estimate = tokens * 0.00000020
    
    return UserAnalyticsResponse(
        queries_asked=queries,
        total_tokens_used=tokens,
        average_latency=avg_lat,
        documents_indexed=docs_count,
        chunks_created=chunks_count,
        total_storage_bytes=total_storage,
        estimated_cost_usd=cost_estimate,
        latency_trend=latency_trend,
        documents_list=docs_list
    )
