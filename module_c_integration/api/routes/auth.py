"""Auth routes — Module C API (Student 2: JWT Authentication)."""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from config import APIConfig
from core.security import hash_password, verify_password, create_access_token, decode_token
from database.connection import get_db
from database.repositories.user_repository import UserRepository

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Request / Response Models ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    company: str
    role: str = "sender"  # sender | inspector | admin


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ── Seed default users on first call ──────────────────────────────────────
_seeded = False

SEED_USERS = [
    {"email": "admin@supplyguard.com",    "password": "admin123",    "company": "SupplyGuard", "role": "admin"},
    {"email": "sender@apple.com",         "password": "sender123",   "company": "Apple",       "role": "sender"},
    {"email": "inspector@bestbuy.com",    "password": "inspector123","company": "BestBuy",     "role": "inspector"},
]


async def _ensure_seed_users(repo: UserRepository):
    """Create default demo users if they don't exist."""
    global _seeded
    if _seeded:
        return
    for u in SEED_USERS:
        existing = await repo.find_by_email(u["email"])
        if not existing:
            await repo.collection.insert_one({
                "email": u["email"],
                "hashed_password": hash_password(u["password"]),
                "company": u["company"],
                "role": u["role"],
            })
            logger.info(f"Seeded user: {u['email']}")
    _seeded = True


def _get_config() -> APIConfig:
    return APIConfig.from_env()


# ── POST /token — Login ──────────────────────────────────────────────────
@router.post("/token", summary="Login — get JWT access token", response_model=TokenResponse)
async def login(req: LoginRequest):
    db = get_db()
    repo = UserRepository(db)
    await _ensure_seed_users(repo)

    # Find user by email (need password hash, so query directly)
    user_doc = await repo.collection.find_one({"email": req.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(req.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    config = _get_config()
    token = create_access_token(
        data={"sub": str(user_doc["_id"]), "email": user_doc["email"],
              "company": user_doc["company"], "role": user_doc["role"]},
        secret=config.jwt_secret,
        algorithm=config.jwt_algorithm,
        expires_min=config.jwt_expire_minutes,
    )

    return TokenResponse(
        access_token=token,
        user={
            "id": str(user_doc["_id"]),
            "email": user_doc["email"],
            "company": user_doc["company"],
            "role": user_doc["role"],
        },
    )


# ── POST /register — Create account ──────────────────────────────────────
@router.post("/register", summary="Register a new user account")
async def register(req: RegisterRequest):
    db = get_db()
    repo = UserRepository(db)
    await _ensure_seed_users(repo)

    existing = await repo.find_by_email(req.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if req.role not in ("sender", "inspector"):
        raise HTTPException(status_code=400, detail="Role must be 'sender' or 'inspector'")

    user_doc = await repo.collection.insert_one({
        "email": req.email,
        "hashed_password": hash_password(req.password),
        "company": req.company,
        "role": req.role,
    })

    config = _get_config()
    token = create_access_token(
        data={"sub": str(user_doc.inserted_id), "email": req.email,
              "company": req.company, "role": req.role},
        secret=config.jwt_secret,
        algorithm=config.jwt_algorithm,
        expires_min=config.jwt_expire_minutes,
    )

    return {
        "message": "User registered successfully",
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user_doc.inserted_id), "email": req.email,
                 "company": req.company, "role": req.role},
    }


# ── GET /me — Current user info ──────────────────────────────────────────
@router.get("/me", summary="Get current user profile")
async def me(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
