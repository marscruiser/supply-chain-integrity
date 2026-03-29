"""Shipment CRUD routes — Module C API (Student 2: Company Data Isolation)."""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from database.connection import get_db
from database.repositories.shipment_repository import ShipmentRepository
from services.blockchain_service import BlockchainService
from config import APIConfig

router = APIRouter()
logger = logging.getLogger(__name__)

_blockchain_service = None


def _get_blockchain() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        config = APIConfig.from_env()
        _blockchain_service = BlockchainService(config)
    return _blockchain_service


class CreateShipmentRequest(BaseModel):
    shipment_code: str
    description: Optional[str] = ""
    receiver_company: Optional[str] = ""


# ── POST / — Register new shipment ───────────────────────────────────────
@router.post("/", summary="Register new shipment")
async def create_shipment(req: CreateShipmentRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Authentication required")

    if user["role"] not in ("sender", "admin"):
        raise HTTPException(403, "Only senders and admins can register shipments")

    db = get_db()
    repo = ShipmentRepository(db)

    # Check for duplicate code
    existing = await repo.find_by_code(req.shipment_code)
    if existing:
        raise HTTPException(409, f"Shipment code '{req.shipment_code}' already exists")

    # Register on blockchain
    try:
        svc = _get_blockchain()
        bc_result = await svc.register_shipment(req.shipment_code)
        tx_hash = bc_result.get("tx_hash", "")
        # The on-chain ID is the total shipments count after registration
        stats = await svc.get_system_stats()
        blockchain_id = stats.get("total_shipments", 0)
    except Exception as e:
        logger.error(f"Blockchain register failed: {e}")
        blockchain_id = 0
        tx_hash = ""

    # Store in MongoDB
    shipment = await repo.create({
        "shipment_code": req.shipment_code,
        "description": req.description,
        "company": user["company"],
        "receiver_company": req.receiver_company,
        "status": "REGISTERED",
        "blockchain_id": blockchain_id,
        "register_tx": tx_hash,
        "inspection_ids": [],
    })

    return {
        "message": "Shipment registered",
        "shipment": shipment,
        "blockchain_tx": tx_hash,
    }


# ── GET / — List shipments (filtered by company) ─────────────────────────
@router.get("/", summary="List all shipments")
async def list_shipments(request: Request, skip: int = 0, limit: int = 20):
    user = getattr(request.state, "user", None)
    db = get_db()
    repo = ShipmentRepository(db)

    if user and user["role"] == "admin":
        # Admin sees everything
        cursor = repo.collection.find({}).skip(skip).limit(limit).sort("created_at", -1)
    elif user:
        # Sender sees their own; inspector sees shipments sent TO their company
        cursor = repo.collection.find({
            "$or": [
                {"company": user["company"]},
                {"receiver_company": user["company"]},
            ]
        }).skip(skip).limit(limit).sort("created_at", -1)
    else:
        cursor = repo.collection.find({}).skip(skip).limit(limit).sort("created_at", -1)

    shipments = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        shipments.append(doc)

    total = await repo.count()
    return {"shipments": shipments, "total": total, "skip": skip, "limit": limit}


# ── GET /{shipment_id} — Get shipment by ID ──────────────────────────────
@router.get("/{shipment_id}", summary="Get shipment by ID")
async def get_shipment(shipment_id: str, request: Request):
    db = get_db()
    repo = ShipmentRepository(db)
    shipment = await repo.find_by_id(shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    user = getattr(request.state, "user", None)
    if user and user["role"] != "admin":
        if shipment.get("company") != user["company"] and shipment.get("receiver_company") != user["company"]:
            raise HTTPException(403, "Access denied to this shipment")

    return shipment


# ── GET /code/{code} — Get shipment by human-readable code ───────────────
@router.get("/code/{code}", summary="Get shipment by human-readable code")
async def get_by_code(code: str, request: Request):
    db = get_db()
    repo = ShipmentRepository(db)
    shipment = await repo.find_by_code(code)
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    return shipment
