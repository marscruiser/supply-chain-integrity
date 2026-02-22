"""
Module C — FastAPI Main Application
Central API Gateway integrating all three modules:
  - Calls Module A Vision API for fingerprint generation
  - Calls Module B Blockchain for hash storage/retrieval
  - Logs all events to MongoDB
  - Serves WebSocket for real-time dashboard updates
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import APIConfig
from database.connection import connect_db, disconnect_db
from routes import (
    shipments, inspections, verification,
    fingerprints, health, auth, websocket, reports
)
from middleware.logging_middleware import LoggingMiddleware
from middleware.auth_middleware import AuthMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    config = app.state.config
    logger.info("Starting Supply Chain Integrity API...")
    await connect_db(config.mongodb_uri, config.mongodb_db_name)
    yield
    logger.info("Shutting down API...")
    await disconnect_db()


def create_app(config: APIConfig = None) -> FastAPI:
    if config is None:
        config = APIConfig.from_env()

    app = FastAPI(
        title="Supply Chain Integrity API",
        description=(
            "Backend API for the Supply Chain Integrity System. "
            "Integrates X-ray vision analysis, blockchain integrity logging, "
            "and IPFS decentralized storage."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.state.config = config

    # Middleware
    app.add_middleware(CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(LoggingMiddleware)

    # Routers
    app.include_router(health.router,          prefix="/health",                tags=["Health"])
    app.include_router(auth.router,            prefix="/api/v1/auth",           tags=["Auth"])
    app.include_router(shipments.router,       prefix="/api/v1/shipments",      tags=["Shipments"])
    app.include_router(inspections.router,     prefix="/api/v1/inspections",    tags=["Inspections"])
    app.include_router(verification.router,    prefix="/api/v1/verify",         tags=["Verification"])
    app.include_router(fingerprints.router,    prefix="/api/v1/fingerprints",   tags=["Fingerprints"])
    app.include_router(reports.router,         prefix="/api/v1/reports",        tags=["Reports"])
    app.include_router(websocket.router,       prefix="/ws",                    tags=["WebSocket"])

    return app


app = create_app()
