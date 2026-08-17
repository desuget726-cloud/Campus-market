import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# Read full DATABASE_URL from env or build from components
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "campusmarket_db")

# Prefer an explicit local XAMPP connection string for development. Allow
# overriding it via the DATABASE_URL environment variable when needed.
DATABASE_URL = os.getenv("DATABASE_URL") or "mysql+pymysql://root:@127.0.0.1:3306/campusmarket_db"


# Create SQLAlchemy engine and session factory
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a SQLAlchemy DB session.

    Configure DB connection via the `DATABASE_URL` env var, or set
    `DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`/`DB_NAME` environment variables.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables for all models inheriting from `Base`.

    Call this from an application startup event or a separate setup script.
    """
    Base.metadata.create_all(bind=engine)
