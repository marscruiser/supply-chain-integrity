"""Dispute routes — Module C API.
Handles dispute lifecycle: raise, list, resolve.
Inspector gets 1 verify chance, then must dispute for re-verification.
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime, timezone

from database.connection import get_db
from database.repositories.shipment_repository import ShipmentRepository
from database.repositories.inspection_repository import InspectionRepository

router = APIRouter()
logger = logging.getLogger(__name__)

DISPUTES_COLLECTION = "disputes"


class RaiseDisputeRequest(BaseModel):
    reason: str


class ResolveDisputeRequest(BaseModel):
    approved: bool


# ── POST /{shipment_id} — Raise dispute ──────────────────────────────────
@router.post("/{shipment_id}", summary="Raise dispute on a shipment")
async def raise_dispute(shipment_id: str, req: RaiseDisputeRequest, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Authentication required")
    if user["role"] not in ("inspector", "admin"):
        raise HTTPException(403, "Only inspectors can raise disputes")

    db = get_db()
    shipment_repo = ShipmentRepository(db)
    disputes = db[DISPUTES_COLLECTION]

    shipment = await shipment_repo.find_by_id(shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    if shipment["status"] not in ("TAMPERED", "VERIFIED"):
        raise HTTPException(400, "Can only dispute after destination verification")

    # Check no active dispute exists
    existing = await disputes.find_one({
        "shipment_id": shipment_id,
        "status": "PENDING",
    })
    if existing:
        raise HTTPException(409, "An active dispute already exists for this shipment")

    # Create dispute in MongoDB
    dispute = {
        "shipment_id": shipment_id,
        "shipment_code": shipment.get("shipment_code", ""),
        "raised_by": user["email"],
        "raised_by_company": user["company"],
        "reason": req.reason,
        "status": "PENDING",
        "resolved_by": None,
        "resolution_note": None,
        "created_at": datetime.now(timezone.utc),
        "resolved_at": None,
    }
    result = await disputes.insert_one(dispute)
    dispute["_id"] = str(result.inserted_id)

    # Update shipment status
    await shipment_repo.update_status(shipment_id, "DISPUTED")

    return {"message": "Dispute raised", "dispute": dispute}


# ── GET / — List disputes ────────────────────────────────────────────────
@router.get("/", summary="List all disputes")
async def list_disputes(request: Request, skip: int = 0, limit: int = 50):
    user = getattr(request.state, "user", None)
    db = get_db()
    disputes = db[DISPUTES_COLLECTION]

    query = {}
    if user and user["role"] != "admin":
        # Show disputes where user's company is the sender or the inspector
        query = {"$or": [
            {"raised_by_company": user["company"]},
        ]}
        # Also find shipments belonging to this company
        shipment_repo = ShipmentRepository(db)
        company_shipments = []
        async for doc in shipment_repo.collection.find(
            {"$or": [{"company": user["company"]}, {"receiver_company": user["company"]}]},
            {"_id": 1}
        ):
            company_shipments.append(str(doc["_id"]))
        if company_shipments:
            query = {"$or": [
                {"raised_by_company": user["company"]},
                {"shipment_id": {"$in": company_shipments}},
            ]}

    cursor = disputes.find(query).sort("created_at", -1).skip(skip).limit(limit)
    results = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        results.append(doc)

    total = await disputes.count_documents(query)
    return {"disputes": results, "total": total}


# ── POST /{dispute_id}/resolve — Sender resolves dispute ─────────────────
@router.post("/{dispute_id}/resolve", summary="Resolve a dispute")
async def resolve_dispute(dispute_id: str, req: ResolveDisputeRequest, request: Request):
    from bson import ObjectId

    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Authentication required")
    if user["role"] not in ("sender", "admin"):
        raise HTTPException(403, "Only senders can resolve disputes")

    db = get_db()
    disputes = db[DISPUTES_COLLECTION]
    shipment_repo = ShipmentRepository(db)

    dispute = await disputes.find_one({"_id": ObjectId(dispute_id)})
    if not dispute:
        raise HTTPException(404, "Dispute not found")
    if dispute["status"] != "PENDING":
        raise HTTPException(400, "Dispute already resolved")

    # Verify sender owns this shipment
    shipment = await shipment_repo.find_by_id(dispute["shipment_id"])
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if user["role"] != "admin" and shipment.get("company") != user["company"]:
        raise HTTPException(403, "You can only resolve disputes for your own shipments")

    new_status = "APPROVED" if req.approved else "REJECTED"
    await disputes.update_one(
        {"_id": ObjectId(dispute_id)},
        {"$set": {
            "status": new_status,
            "resolved_by": user["email"],
            "resolved_at": datetime.now(timezone.utc),
        }}
    )

    if req.approved:
        # Reset shipment so inspector can re-verify
        await shipment_repo.update_status(dispute["shipment_id"], "ORIGIN_SCANNED")
        # Reset verify count to allow one more attempt
        await db["verify_counts"].update_one(
            {"shipment_id": dispute["shipment_id"]},
            {"$set": {"count": 0}},
        )
        msg = "Dispute approved — inspector can now re-verify"
    else:
        await shipment_repo.update_status(dispute["shipment_id"], "TAMPERED")
        msg = "Dispute rejected — shipment remains TAMPERED"

    return {"message": msg, "status": new_status}
