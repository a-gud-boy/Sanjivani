from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy relational models."""
    pass


import re
from sqlalchemy.pool import NullPool

# Normalize and prepare database URL
raw_db_url = settings.DATABASE_URL.strip()
normalized_db_url = raw_db_url

if normalized_db_url.startswith("postgres://"):
    normalized_db_url = "postgresql+asyncpg://" + normalized_db_url[len("postgres://"):]
elif normalized_db_url.startswith("postgresql://"):
    normalized_db_url = "postgresql+asyncpg://" + normalized_db_url[len("postgresql://"):]

# If pointing to Supabase direct host (which is IPv6-only and fails on Render / IPv4 containers),
# automatically rewrite to the official IPv4 Supabase connection pooler
supabase_match = re.match(
    r"^postgresql\+asyncpg://([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?/(.*)$",
    normalized_db_url,
)
if supabase_match:
    user, pwd, ref, dbname = supabase_match.groups()
    pooler_user = f"postgres.{ref}" if not user.startswith(f"postgres.{ref}") else user
    normalized_db_url = f"postgresql+asyncpg://{pooler_user}:{pwd}@aws-0-ap-south-1.pooler.supabase.com:5432/{dbname}"

# Database-specific connection arguments
connect_args = {}
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}

if normalized_db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif "asyncpg" in normalized_db_url:
    # Disable prepared statement cache for Supabase PgBouncer pooler compatibility
    connect_args["statement_cache_size"] = 0
    # Disable client-side pooling so connections are not attached to defunct event loops
    engine_kwargs["poolclass"] = NullPool

engine_kwargs["connect_args"] = connect_args

# Async database engine
engine = create_async_engine(
    normalized_db_url,
    **engine_kwargs,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an active async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
