"""Verification endpoints — Module C API (Student 1 + 3: End-to-End Upload Flow).
Uses the Vision AI /compare endpoint for full multi-signal tamper detection.
"""
from fastapi import APIRouter, File, Form, UploadFile, Request, HTTPException
import httpx
import hashlib
import logging
import aiofiles
import os
from pathlib import Path
from datetime import datetime, timezone

from config import APIConfig
from database.connection import get_db
from database.repositories.shipment_repository import ShipmentRepository
from database.repositories.inspection_repository import InspectionRepository
from services.blockchain_service import BlockchainService

router = APIRouter()
logger = logging.getLogger(__name__)

_config = None
_blockchain_service = None

# Local storage for origin images (used for comparison at destination)
ORIGIN_IMAGES_DIR = Path("/app/origin_scans")
ORIGIN_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def _get_config() -> APIConfig:
    global _config
    if _config is None:
        _config = APIConfig.from_env()
    return _config


def _get_blockchain() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService(_get_config())
    return _blockchain_service


# ── POST /origin/{shipment_id} — Upload origin X-ray ─────────────────────
@router.post("/origin/{shipment_id}", summary="Store origin inspection")
async def store_origin(
    shipment_id: str,
    image: UploadFile = File(...),
    address: str = Form(""),
    city: str = Form(""),
    country: str = Form(""),
    request: Request = None,
):
    user = getattr(request.state, "user", None) if request else None
    if not user:
        raise HTTPException(401, "Authentication required")
    if user["role"] not in ("sender", "admin"):
        raise HTTPException(403, "Only senders can upload origin scans")

    db = get_db()
    shipment_repo = ShipmentRepository(db)
    inspection_repo = InspectionRepository(db)

    # Verify shipment exists and belongs to user's company
    shipment = await shipment_repo.find_by_id(shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    if user["role"] != "admin" and shipment.get("company") != user["company"]:
        raise HTTPException(403, "This shipment belongs to a different company")

    # Read image bytes
    image_bytes = await image.read()
    image_sha256 = hashlib.sha256(image_bytes).hexdigest()

    # Save origin image locally for later comparison
    origin_path = ORIGIN_IMAGES_DIR / f"{shipment_id}.png"
    async with aiofiles.open(origin_path, "wb") as f:
        await f.write(image_bytes)
    logger.info(f"Saved origin image for shipment {shipment_id} at {origin_path}")

    # Call Vision API → analyze to get fingerprint
    config = _get_config()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"image": (image.filename or "xray.png", image_bytes, image.content_type or "image/png")}
            resp = await client.post(f"{config.vision_api_url}/api/v1/inspect/analyze", files=files)
            resp.raise_for_status()
            vision_result = resp.json()
    except Exception as e:
        logger.error(f"Vision API call failed: {e}")
        raise HTTPException(502, f"Vision AI service unavailable: {str(e)}")

    phash = vision_result.get("phash", "")
    fingerprint_id = vision_result.get("fingerprint_id", "")

    # Store on blockchain
    bc_id = shipment.get("blockchain_id", 0)
    tx_hash = ""
    if bc_id and bc_id > 0:
        try:
            svc = _get_blockchain()
            bc_result = await svc.store_origin_inspection(
                shipment_id=bc_id,
                image_data=image_sha256,
                phash=phash[:16] if phash else "0000000000000000",
                ipfs_cid=f"Qm{image_sha256[:44]}",
            )
            tx_hash = bc_result.get("tx_hash", "")
        except Exception as e:
            logger.error(f"Blockchain store failed: {e}")
            tx_hash = ""

    # Log to MongoDB
    location = {"address": address, "city": city, "country": country}
    await inspection_repo.create({
        "shipment_id": shipment_id,
        "inspection_type": "ORIGIN",
        "image_sha256": image_sha256,
        "phash": phash,
        "fingerprint_id": fingerprint_id,
        "blockchain_tx": tx_hash,
        "verdict": "ORIGIN_STORED",
        "inspector_email": user["email"],
        "company": user["company"],
        "location": location,
        "created_at": datetime.now(timezone.utc),
    })

    # Update shipment status
    await shipment_repo.update_status(shipment_id, "ORIGIN_SCANNED")

    return {
        "message": "Origin scan stored successfully",
        "shipment_id": shipment_id,
        "fingerprint_id": fingerprint_id,
        "image_sha256": image_sha256[:32] + "...",
        "phash": phash,
        "blockchain_tx": tx_hash or "pending",
    }


@router.post("/destination/{shipment_id}", summary="Verify at destination")
async def verify_destination(
    shipment_id: str,
    image: UploadFile = File(...),
    address: str = Form(""),
    city: str = Form(""),
    country: str = Form(""),
    request: Request = None,
):
    """
    Upload destination X-ray → compare to origin using Vision AI → return CLEAN/TAMPERED verdict.
    Uses the full multi-signal pipeline: SSIM + pHash + object count + histogram + movement detection.
    """
    user = getattr(request.state, "user", None) if request else None
    if not user:
        raise HTTPException(401, "Authentication required")
    if user["role"] not in ("inspector", "admin"):
        raise HTTPException(403, "Only inspectors can verify shipments")

    db = get_db()
    shipment_repo = ShipmentRepository(db)
    inspection_repo = InspectionRepository(db)

    # Verify shipment exists
    shipment = await shipment_repo.find_by_id(shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")

    # ── Verify count limit: 1 attempt per inspector per shipment ─────────────
    verify_counts = db["verify_counts"]
    inspector_email = user["email"]
    count_doc = await verify_counts.find_one({
        "shipment_id": shipment_id,
        "inspector_email": inspector_email,
    })
    current_count = count_doc["count"] if count_doc else 0

    if current_count >= 1:
        raise HTTPException(
            403,
            "You have already verified this shipment once. "
            "If you believe the result is incorrect, please raise a Dispute."
        )


    # Check origin scan exists
    origin_path = ORIGIN_IMAGES_DIR / f"{shipment_id}.png"
    if not origin_path.exists():
        raise HTTPException(400, "No origin scan found. Upload origin X-ray first.")

    # Read destination image
    dest_bytes = await image.read()
    dest_sha256 = hashlib.sha256(dest_bytes).hexdigest()

    # Read origin image
    async with aiofiles.open(origin_path, "rb") as f:
        origin_bytes = await f.read()

    # ═══════════════════════════════════════════════════════════════════════
    # Send BOTH images to Vision AI /compare endpoint for full analysis
    # This uses: SSIM + pHash + object count + histogram + movement detection
    # ═══════════════════════════════════════════════════════════════════════
    config = _get_config()
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            files = {
                "image1": ("origin.png", origin_bytes, "image/png"),
                "image2": ("destination.png", dest_bytes, "image/png"),
            }
            resp = await client.post(
                f"{config.vision_api_url}/api/v1/inspect/compare",
                files=files,
            )
            resp.raise_for_status()
            compare_result = resp.json()
    except Exception as e:
        logger.error(f"Vision AI compare failed: {e}")
        raise HTTPException(502, f"Vision AI comparison service unavailable: {str(e)}")

    # Extract verdict from Vision AI response
    verdict = compare_result.get("verdict", "TAMPERED")
    confidence = compare_result.get("confidence", 0.5)
    explanation = compare_result.get("explanation", "")
    signals = compare_result.get("signals", {})
    tampered_regions = compare_result.get("tampered_regions", [])

    # Store on blockchain
    bc_id = shipment.get("blockchain_id", 0)
    tx_hash = ""
    if bc_id and bc_id > 0:
        try:
            svc = _get_blockchain()
            ssim_score = signals.get("ssim_score", 0.95)
            phash_distance = signals.get("phash_distance", 0)
            bc_result = await svc.verify_destination(
                shipment_id=bc_id,
                image_data=dest_sha256,
                phash=signals.get("dest_phash", "")[:16] or "0000000000000000",
                ipfs_cid=f"Qm{dest_sha256[:44]}",
                ssim_score=ssim_score,
                hamming_distance=phash_distance,
                notes=explanation[:200] if explanation else "",
            )
            tx_hash = bc_result.get("tx_hash", "")
        except Exception as e:
            logger.error(f"Blockchain verify failed: {e}")
            tx_hash = ""

    # Log to MongoDB
    location = {"address": address, "city": city, "country": country}
    await inspection_repo.create({
        "shipment_id": shipment_id,
        "inspection_type": "DESTINATION",
        "image_sha256": dest_sha256,
        "verdict": verdict,
        "confidence": confidence,
        "explanation": explanation,
        "signals": signals,
        "tampered_regions": tampered_regions,
        "blockchain_tx": tx_hash,
        "inspector_email": user["email"],
        "company": user["company"],
        "location": location,
        "created_at": datetime.now(timezone.utc),
    })

    # Update shipment status
    new_status = "TAMPERED" if verdict == "TAMPERED" else "VERIFIED"
    await shipment_repo.update_status(shipment_id, new_status)

    # Increment verify count — keyed per inspector, per shipment
    await verify_counts.update_one(
        {"shipment_id": shipment_id, "inspector_email": inspector_email},
        {"$inc": {"count": 1}, "$setOnInsert": {"shipment_id": shipment_id, "inspector_email": inspector_email}},
        upsert=True,
    )

    return {
        "shipment_id": shipment_id,
        "verdict": verdict,
        "confidence": confidence,
        "explanation": explanation,
        "signals": signals,
        "tampered_regions": tampered_regions,
        "tampered_regions_count": compare_result.get("tampered_regions_count", 0),
        "blockchain_tx": tx_hash or "pending",
    }


# ── GET /status/{shipment_id} — Get verification status ──────────────────
@router.get("/status/{shipment_id}", summary="Get verification status")
async def get_status(shipment_id: str):
    db = get_db()
    inspection_repo = InspectionRepository(db)

    inspections = []
    async for doc in inspection_repo.collection.find({"shipment_id": shipment_id}).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        inspections.append(doc)

    if not inspections:
        return {"shipment_id": shipment_id, "verified": False, "inspections": []}

    latest = inspections[0]
    return {
        "shipment_id": shipment_id,
        "verified": latest.get("inspection_type") == "DESTINATION",
        "verdict": latest.get("verdict"),
        "inspections": inspections,
    }
