"""Inspection Repository — Module C / Database."""
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List


class InspectionRepository:
    COLLECTION = "inspections"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db[self.COLLECTION]

    async def create(self, data: dict) -> dict:
        data["created_at"] = datetime.now(timezone.utc)
        result = await self.collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    async def find_by_id(self, inspection_id: str) -> Optional[dict]:
        doc = await self.collection.find_one({"_id": ObjectId(inspection_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def list_by_shipment(self, shipment_id: str) -> List[dict]:
        cursor = self.collection.find({"shipment_id": shipment_id}).sort("created_at", -1)
        return [{**doc, "_id": str(doc["_id"])} async for doc in cursor]

    async def count(self) -> int:
        return await self.collection.count_documents({})

    async def count_by_verdict(self) -> dict:
        pipeline = [{"$group": {"_id": "$verdict", "count": {"$sum": 1}}}]
        return {doc["_id"]: doc["count"] async for doc in self.collection.aggregate(pipeline)}
