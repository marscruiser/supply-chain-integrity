"""Inspection records routes — Module C API.
Real list + stats endpoints backed by MongoDB.
"""
from fastapi import APIRouter, Request
from database.connection import get_db
from database.repositories.inspection_repository import InspectionRepository
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", summary="List inspections")
async def list_inspections(
    request: Request,
    shipment_id: str = None,
    verdict: str = None,
    skip: int = 0,
    limit: int = 50,
):
    db = get_db()
    repo = InspectionRepository(db)
    user = getattr(request.state, "user", None)

    query = {}
    if shipment_id:
        query["shipment_id"] = shipment_id
    if verdict:
        query["verdict"] = verdict.upper()
    if user and user["role"] != "admin":
        query["company"] = user["company"]

    cursor = repo.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    inspections = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        inspections.append(doc)

    total = await repo.collection.count_documents(query)
    return {"inspections": inspections, "total": total, "skip": skip, "limit": limit}


@router.get("/stats", summary="Inspection aggregate statistics")
async def inspection_stats(request: Request):
    db = get_db()
    repo = InspectionRepository(db)
    user = getattr(request.state, "user", None)

    match_stage = {}
    if user and user["role"] != "admin":
        match_stage = {"company": user["company"]}

    total = await repo.collection.count_documents(match_stage)

    # By verdict
    pipeline = []
    if match_stage:
        pipeline.append({"$match": match_stage})
    pipeline.append({"$group": {"_id": "$verdict", "count": {"$sum": 1}}})
    verdict_counts = {}
    async for doc in repo.collection.aggregate(pipeline):
        verdict_counts[doc["_id"] or "UNKNOWN"] = doc["count"]

    # Avg confidence for destination inspections
    avg_pipeline = []
    if match_stage:
        avg_pipeline.append({"$match": {**match_stage, "inspection_type": "DESTINATION"}})
    else:
        avg_pipeline.append({"$match": {"inspection_type": "DESTINATION"}})
    avg_pipeline.append({"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}}})
    avg_conf = 0.0
    async for doc in repo.collection.aggregate(avg_pipeline):
        avg_conf = doc.get("avg_confidence", 0) or 0

    return {
        "total_inspections": total,
        "by_verdict": verdict_counts,
        "avg_confidence": round(avg_conf, 4),
        "tampering_rate": round(
            verdict_counts.get("TAMPERED", 0) / max(total, 1) * 100, 1
        ),
    }


@router.get("/{inspection_id}", summary="Get inspection by ID")
async def get_inspection(inspection_id: str):
    db = get_db()
    repo = InspectionRepository(db)
    inspection = await repo.find_by_id(inspection_id)
    if not inspection:
        from fastapi import HTTPException
        raise HTTPException(404, "Inspection not found")
    return inspection
