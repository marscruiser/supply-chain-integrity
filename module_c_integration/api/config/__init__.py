"""API Config — Module C."""
import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class APIConfig:
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 4
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "supply_chain_integrity"
    eth_rpc_url: str = "http://127.0.0.1:8545"
    eth_private_key: str = ""
    contract_address: str = ""
    gas_limit: int = 300000
    ipfs_host: str = "127.0.0.1"
    ipfs_port: int = 5001
    vision_api_url: str = "http://localhost:8001"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: List[str] = field(default_factory=lambda: ["http://localhost:3000"])

    @classmethod
    def from_env(cls) -> "APIConfig":
        return cls(
            api_host=os.getenv("API_HOST", "0.0.0.0"),
            api_port=int(os.getenv("API_PORT", 8000)),
            mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017"),
            mongodb_db_name=os.getenv("MONGODB_DB_NAME", "supply_chain_integrity"),
            eth_rpc_url=os.getenv("ETH_RPC_URL", "http://127.0.0.1:8545"),
            eth_private_key=os.getenv("ETH_PRIVATE_KEY", ""),
            contract_address=os.getenv("CONTRACT_ADDRESS", ""),
            vision_api_url=os.getenv("VISION_API_URL", "http://localhost:8001"),
            jwt_secret=os.getenv("JWT_SECRET", "change-me"),
            cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
        )
