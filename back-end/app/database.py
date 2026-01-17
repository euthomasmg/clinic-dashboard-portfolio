from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import build_database_url

# Conexao exclusiva Postgres (sem fallback para SQLite).
DATABASE_URL = build_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()
