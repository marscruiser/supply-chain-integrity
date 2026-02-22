"""Auth routes — Module C API."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
router = APIRouter()


class TokenRequest(BaseModel):
    username: str
    password: str


@router.post("/token", summary="Get JWT access token")
async def login(request: TokenRequest):
    # TODO: validate credentials, return JWT
    return {"access_token": "placeholder", "token_type": "bearer"}


@router.post("/register", summary="Register new user")
async def register(request: TokenRequest):
    return {"message": "Registration — implementation pending"}
