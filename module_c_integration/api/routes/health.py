"""Health check route — Module C API."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def health():
    return {"status": "healthy", "module": "api", "version": "1.0.0"}
