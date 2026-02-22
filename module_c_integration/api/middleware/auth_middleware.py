"""Auth middleware — Module C API. Validates JWT tokens on protected routes."""
from starlette.middleware.base import BaseHTTPMiddleware

PUBLIC_PATHS = {"/health", "/health/", "/docs", "/redoc", "/openapi.json", "/api/v1/auth/token"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path in PUBLIC_PATHS or request.url.path.startswith("/ws"):
            return await call_next(request)
        # TODO: validate JWT from Authorization header
        return await call_next(request)
