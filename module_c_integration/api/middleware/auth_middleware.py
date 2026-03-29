"""Auth middleware — Module C API (Student 2: JWT Validation).
Validates JWT tokens on protected routes and injects user info into request.state.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

from config import APIConfig
from core.security import decode_token

logger = logging.getLogger(__name__)

PUBLIC_PATHS = {
    "/health", "/health/",
    "/docs", "/redoc", "/openapi.json",
    "/api/v1/auth/token", "/api/v1/auth/register",
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path

        # Allow public paths and WebSocket connections
        if path in PUBLIC_PATHS or path.startswith("/ws"):
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            # Allow unauthenticated access but mark as anonymous
            request.state.user = None
            return await call_next(request)

        token = auth_header.replace("Bearer ", "")
        try:
            config = APIConfig.from_env()
            payload = decode_token(token, config.jwt_secret, config.jwt_algorithm)
            request.state.user = {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "company": payload.get("company"),
                "role": payload.get("role"),
            }
        except Exception as e:
            logger.warning(f"JWT validation failed: {e}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )

        return await call_next(request)
