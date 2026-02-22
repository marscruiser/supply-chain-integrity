"""Inspection routes — Module A Vision API."""
from fastapi import APIRouter, File, UploadFile
router = APIRouter()

@router.post("/", summary="Run full X-ray inspection on uploaded image")
async def run_inspection(image: UploadFile = File(...), reference_cid: str = None):
    """Accepts an X-ray image, runs the full vision pipeline, returns fingerprint + verdict."""
    # TODO: Inject VisionConfig, call PreprocessingPipeline -> FingerprintEngine -> AnomalyDetector
    return {"status": "ok", "message": "Inspection pipeline — implementation pending"}

@router.post("/compare", summary="Compare two X-ray images")
async def compare_images(image1: UploadFile = File(...), image2: UploadFile = File(...)):
    """Compare two images and return SSIM score, hash distance, and tampering verdict."""
    return {"status": "ok", "message": "Comparison — implementation pending"}
