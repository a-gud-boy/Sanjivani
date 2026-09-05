from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy relational models."""
    pass


from sqlalchemy.pool import NullPool

# Database-specific connection arguments
connect_args = {}
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
elif "asyncpg" in settings.DATABASE_URL:
    # Disable prepared statement cache for Supabase PgBouncer pooler compatibility
    connect_args["statement_cache_size"] = 0
    # Disable client-side pooling so connections are not attached to defunct event loops
    engine_kwargs["poolclass"] = NullPool

engine_kwargs["connect_args"] = connect_args

# Async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
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
