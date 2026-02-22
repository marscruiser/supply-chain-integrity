"""
MongoDB Connection — Module C / Database
Async MongoDB connection manager using motor (async MongoDB driver).
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

logger = logging.getLogger(__name__)

# Global client/db reference
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db(uri: str, db_name: str):
    """Initialize MongoDB connection."""
    global _client, _db
    logger.info(f"Connecting to MongoDB: {db_name}...")
    _client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    _db = _client[db_name]
    # Verify connection
    await _db.command("ping")
    logger.info("MongoDB connected successfully.")


async def disconnect_db():
    """Close MongoDB connection."""
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB disconnected.")


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency: returns active DB instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
