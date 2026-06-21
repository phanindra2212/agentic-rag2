import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Default to SQLite for easy local development if no connection string is provided
DATABASE_URL = os.getenv("DATABASE_URL")
is_sqlite = False

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./rag_saas.db"
    is_sqlite = True
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

engine_args = {}
if is_sqlite:
    engine_args["connect_args"] = {"check_same_thread": False}
else:
    engine_args["pool_pre_ping"] = True
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency injection helper to yield database session in API routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
