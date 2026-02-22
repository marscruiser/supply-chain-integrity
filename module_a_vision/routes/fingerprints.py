"""Fingerprint routes — Module A."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/{fingerprint_id}", summary="Get fingerprint by ID")
async def get_fingerprint(fingerprint_id: str):
    return {"fingerprint_id": fingerprint_id, "status": "implementation pending"}

@router.post("/batch", summary="Generate fingerprints for batch of images")
async def batch_fingerprint():
    return {"status": "batch processing — implementation pending"}
