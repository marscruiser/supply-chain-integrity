"""Shipment CRUD routes — Module C API."""
from fastapi import APIRouter, Depends, HTTPException
router = APIRouter()


@router.post("/", summary="Register new shipment")
async def create_shipment(shipment_code: str, description: str = None):
    """Register a new shipment on blockchain and MongoDB."""
    # TODO: inject ShipmentService, call create_shipment()
    return {"status": "implementation pending", "shipment_code": shipment_code}


@router.get("/", summary="List all shipments")
async def list_shipments(skip: int = 0, limit: int = 20):
    return {"shipments": [], "total": 0, "skip": skip, "limit": limit}


@router.get("/{shipment_id}", summary="Get shipment by ID")
async def get_shipment(shipment_id: str):
    return {"shipment_id": shipment_id, "status": "implementation pending"}


@router.get("/code/{code}", summary="Get shipment by human-readable code")
async def get_by_code(code: str):
    return {"code": code, "status": "implementation pending"}
