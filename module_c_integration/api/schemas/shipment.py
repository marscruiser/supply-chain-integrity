"""Pydantic schemas for Shipment — Module C / Schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ShipmentCreateSchema(BaseModel):
    shipment_code: str
    description: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    cargo_type: Optional[str] = None


class ShipmentResponseSchema(BaseModel):
    id: str
    shipment_code: str
    status: str
    blockchain_tx: Optional[str] = None
    blockchain_id: Optional[int] = None
    origin_fingerprint_cid: Optional[str] = None
    inspection_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
