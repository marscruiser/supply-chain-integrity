"""Verification endpoints — Module C API."""
from fastapi import APIRouter, File, UploadFile
router = APIRouter()


@router.post("/origin/{shipment_id}", summary="Store origin inspection")
async def store_origin(shipment_id: str, image: UploadFile = File(...)):
    """Upload X-ray scan at origin → generate fingerprint → store on blockchain + IPFS."""
    # TODO: call VerificationService.store_origin_inspection()
    return {"shipment_id": shipment_id, "status": "implementation pending"}


@router.post("/destination/{shipment_id}", summary="Verify at destination")
async def verify_destination(shipment_id: str, image: UploadFile = File(...)):
    """Upload destination X-ray → compare to origin → return PASS/FAIL verdict."""
    # TODO: call VerificationService.verify_destination()
    return {"shipment_id": shipment_id, "status": "implementation pending"}


@router.get("/status/{shipment_id}", summary="Get verification status")
async def get_status(shipment_id: str):
    return {"shipment_id": shipment_id, "verified": None}
