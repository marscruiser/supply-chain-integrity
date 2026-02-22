"""Pydantic schemas for Inspection Records — Module C / Schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class InspectionCreateSchema(BaseModel):
    shipment_id: str
    inspection_type: str         # ORIGIN | IN_TRANSIT | DESTINATION
    image_sha256: str
    ipfs_cid: str
    phash: Optional[str] = None
    ssim_score: Optional[float] = None
    hamming_distance: Optional[int] = None
    blockchain_tx: Optional[str] = None
    verdict: str


class InspectionResultSchema(BaseModel):
    id: Optional[str] = None
    shipment_id: str
    inspection_type: str
    verdict: str
    confidence: Optional[float] = None
    ssim_score: Optional[float] = None
    hamming_distance: Optional[int] = None
    ipfs_cid: str
    blockchain_tx: Optional[str] = None
    tampered_regions: Optional[List[dict]] = []
    explanation: Optional[str] = None
    created_at: Optional[datetime] = None
