"""Shared shipment model — used across all modules."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ShipmentBase(BaseModel):
    shipment_id: str
    shipment_code: str
    status: str
    originator: str
    created_at: datetime
    origin_fingerprint_cid: Optional[str] = None
    origin_image_hash: Optional[str] = None
