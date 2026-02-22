"""
Vision Module FastAPI Application — Module A
Provides REST endpoints for X-ray image inspection.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config import VisionConfig
from routes import inspection, health, datasets, fingerprints, evaluation


def create_app(config: VisionConfig = None) -> FastAPI:
    if config is None:
        config = VisionConfig.from_env()

    app = FastAPI(
        title="Supply Chain Vision API",
        description="X-Ray image inspection and perceptual fingerprinting service for supply chain integrity",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store config in app state
    app.state.config = config

    # Register routers
    app.include_router(health.router, prefix="/health", tags=["Health"])
    app.include_router(inspection.router, prefix="/api/v1/inspect", tags=["Inspection"])
    app.include_router(fingerprints.router, prefix="/api/v1/fingerprints", tags=["Fingerprints"])
    app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["Datasets"])
    app.include_router(evaluation.router, prefix="/api/v1/evaluate", tags=["Evaluation"])

    @app.on_event("startup")
    async def startup_event():
        app.state.vision_config = config

    @app.on_event("shutdown")
    async def shutdown_event():
        pass

    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
