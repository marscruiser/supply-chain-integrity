"""Blockchain routes — Module C API. Interactive blockchain operations."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from config import APIConfig
from services.blockchain_service import BlockchainService

router = APIRouter()
logger = logging.getLogger(__name__)

# Singleton service
_blockchain_service = None

def _get_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        config = APIConfig.from_env()
        _blockchain_service = BlockchainService(config)
    return _blockchain_service


class RegisterRequest(BaseModel):
    shipment_code: str

class OriginRequest(BaseModel):
    shipment_id: int
    image_data: str = "simulated-xray-origin"
    phash: str = "a1b2c3d4e5f60718"
    ipfs_cid: str = "QmSimulatedOriginCID"

class VerifyRequest(BaseModel):
    shipment_id: int
    image_data: str = "simulated-xray-destination"
    phash: str = "a1b2c3d4e5f60718"
    ipfs_cid: str = "QmSimulatedDestCID"
    ssim_score: float = 0.98
    hamming_distance: int = 2
    notes: str = ""


@router.get("/connection", summary="Get blockchain connection info")
async def connection_info():
    try:
        svc = _get_service()
        return await svc.get_connection_info()
    except Exception as e:
        logger.error(f"Blockchain connection error: {e}")
        raise HTTPException(500, f"Blockchain connection failed: {str(e)}")


@router.get("/stats", summary="Get blockchain system stats")
async def system_stats():
    try:
        svc = _get_service()
        return await svc.get_system_stats()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/register", summary="Register a shipment on the blockchain")
async def register_shipment(req: RegisterRequest):
    try:
        svc = _get_service()
        return await svc.register_shipment(req.shipment_code)
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(500, str(e))


@router.post("/origin", summary="Store origin inspection on-chain")
async def store_origin(req: OriginRequest):
    try:
        svc = _get_service()
        return await svc.store_origin_inspection(
            req.shipment_id, req.image_data, req.phash, req.ipfs_cid
        )
    except Exception as e:
        logger.error(f"Origin error: {e}")
        raise HTTPException(500, str(e))


@router.post("/verify", summary="Verify destination inspection")
async def verify_destination(req: VerifyRequest):
    try:
        svc = _get_service()
        return await svc.verify_destination(
            req.shipment_id, req.image_data, req.phash, req.ipfs_cid,
            req.ssim_score, req.hamming_distance, req.notes
        )
    except Exception as e:
        logger.error(f"Verify error: {e}")
        raise HTTPException(500, str(e))


@router.get("/shipment/{shipment_id}", summary="Get shipment from blockchain")
async def get_shipment(shipment_id: int):
    try:
        svc = _get_service()
        return await svc.get_shipment(shipment_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/inspection/{record_id}", summary="Get inspection record")
async def get_inspection(record_id: int):
    try:
        svc = _get_service()
        return await svc.get_inspection_record(record_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/demo", summary="Run full blockchain demo sequence")
async def run_demo():
    """Execute the complete demo: register → origin → verify clean → verify tampered."""
    try:
        svc = _get_service()
        return await svc.run_full_demo()
    except Exception as e:
        logger.error(f"Demo error: {e}")
        raise HTTPException(500, str(e))
