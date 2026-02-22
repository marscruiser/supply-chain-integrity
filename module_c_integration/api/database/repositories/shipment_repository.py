"""
Shipment Repository — Module C / Database / Repositories
MongoDB CRUD operations for Shipment documents.
"""

from typing import Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class ShipmentRepository:
    """
    Repository for shipment document operations in MongoDB.
    Collection: 'shipments'
    """

    COLLECTION = "shipments"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db[self.COLLECTION]

    async def create(self, data: dict) -> dict:
        """Insert a new shipment document."""
        data["created_at"] = datetime.now(timezone.utc)
        data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    async def find_by_id(self, shipment_id: str) -> Optional[dict]:
        """Find a shipment by MongoDB ID."""
        doc = await self.collection.find_one({"_id": ObjectId(shipment_id)})
        return self._serialize(doc)

    async def find_by_code(self, shipment_code: str) -> Optional[dict]:
        """Find a shipment by its human-readable code."""
        doc = await self.collection.find_one({"shipment_code": shipment_code})
        return self._serialize(doc)

    async def find_by_blockchain_id(self, blockchain_id: int) -> Optional[dict]:
        """Find a shipment by its on-chain ID."""
        doc = await self.collection.find_one({"blockchain_id": blockchain_id})
        return self._serialize(doc)

    async def list_all(self, skip: int = 0, limit: int = 20) -> List[dict]:
        """List all shipments with pagination."""
        cursor = self.collection.find({}).skip(skip).limit(limit).sort("created_at", -1)
        return [self._serialize(doc) async for doc in cursor]

    async def update_status(self, shipment_id: str, status: str) -> bool:
        """Update shipment status."""
        result = await self.collection.update_one(
            {"_id": ObjectId(shipment_id)},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0

    async def add_inspection_ref(self, shipment_id: str, inspection_id: str) -> bool:
        """Add inspection ID reference to shipment."""
        result = await self.collection.update_one(
            {"_id": ObjectId(shipment_id)},
            {"$push": {"inspection_ids": inspection_id},
             "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0

    async def count(self) -> int:
        """Get total shipment count."""
        return await self.collection.count_documents({})

    async def count_by_status(self) -> dict:
        """Aggregate shipment counts by status."""
        pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        counts = {}
        async for doc in self.collection.aggregate(pipeline):
            counts[doc["_id"]] = doc["count"]
        return counts

    def _serialize(self, doc: Optional[dict]) -> Optional[dict]:
        """Convert MongoDB _id ObjectId to string."""
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
