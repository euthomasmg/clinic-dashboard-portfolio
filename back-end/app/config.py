import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Carrega .env.local (e .env se existir) para popular variaveis.
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")


@dataclass
class Settings:
    database_url: Optional[str] = os.getenv("DATABASE_URL")
    db_user: Optional[str] = os.getenv("DB_USER")
    db_password: Optional[str] = os.getenv("DB_PASSWORD")
    db_host: Optional[str] = os.getenv("DB_HOST")
    db_port: Optional[str] = os.getenv("DB_PORT")
    db_name: Optional[str] = os.getenv("DB_NAME")


settings = Settings()


def build_database_url() -> str:
    """
    Monta URL do Postgres. Se DATABASE_URL for informado usa direto.
    Caso contrário, exige todos os campos DB_* e lança erro se faltar algo.
    """
    if settings.database_url:
        return settings.database_url

    required_fields = {
        "DB_USER": settings.db_user,
        "DB_PASSWORD": settings.db_password,
        "DB_HOST": settings.db_host,
        "DB_PORT": settings.db_port,
        "DB_NAME": settings.db_name,
    }
    missing = [key for key, value in required_fields.items() if not value]
    if missing:
        missing_list = ", ".join(missing)
        raise RuntimeError(f"Variaveis ausentes para montar URL do Postgres: {missing_list}")

    return (
        f"postgresql+psycopg2://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    )
