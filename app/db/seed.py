import logging
from app.db.database import Base, engine

logger = logging.getLogger("sanjivani.db.init")


async def init_db() -> None:
    """Create all database tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema synchronized successfully.")
