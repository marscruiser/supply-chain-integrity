"""
User Repository — Module C / Database / Repositories
MongoDB CRUD operations for User documents.
"""

from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class UserRepository:
    """Repository for user document operations in MongoDB. Collection: 'users'."""

    COLLECTION = "users"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db[self.COLLECTION]

    async def create(self, data: dict) -> dict:
        """Insert a new user document."""
        data["created_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    async def find_by_email(self, email: str) -> Optional[dict]:
        """Find a user by email."""
        doc = await self.collection.find_one({"email": email})
        return self._serialize(doc)

    async def find_by_id(self, user_id: str) -> Optional[dict]:
        """Find a user by MongoDB ID."""
        doc = await self.collection.find_one({"_id": ObjectId(user_id)})
        return self._serialize(doc)

    async def list_all(self, skip: int = 0, limit: int = 50) -> List[dict]:
        """List all users with pagination."""
        cursor = self.collection.find({}).skip(skip).limit(limit).sort("created_at", -1)
        return [self._serialize(doc) async for doc in cursor]

    async def count(self) -> int:
        return await self.collection.count_documents({})

    def _serialize(self, doc: Optional[dict]) -> Optional[dict]:
        if doc:
            doc["_id"] = str(doc["_id"])
            doc.pop("hashed_password", None)  # Never return password hash
        return doc
