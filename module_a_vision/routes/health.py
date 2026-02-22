"""Health check route — Module A."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def health_check():
    return {"status": "healthy", "module": "vision", "version": "1.0.0"}
