from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- Authentication Schemas ---

class UserSignUp(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: int  # user_id
    exp: int

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Document Schemas ---

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    file_name: str
    file_type: str
    upload_date: datetime
    chunk_count: int

    class Config:
        from_attributes = True

# --- Chat Schemas ---

class ChatRequest(BaseModel):
    question: str
    file_names: Optional[List[str]] = None
    file_types: Optional[List[str]] = None

class CitationSchema(BaseModel):
    file_name: str
    page_number: int
    text_snippet: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    question: str
    response: str
    timestamp: datetime
    retrieval_time: float
    response_time: float
    tokens_used: int
    citations: List[CitationSchema] = []

    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    history: List[ChatMessageResponse]

# --- Analytics Schemas ---

class UserAnalyticsResponse(BaseModel):
    queries_asked: int
    total_tokens_used: int
    average_latency: float
    documents_indexed: int
    chunks_created: int
    total_storage_bytes: int  # Estimation of storage size
    estimated_cost_usd: float
    latency_trend: List[Dict[str, Any]]  # Latency for recent queries
    documents_list: List[DocumentResponse]

    class Config:
        from_attributes = True
