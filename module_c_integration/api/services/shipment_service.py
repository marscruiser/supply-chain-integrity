"""Shipment Service — Module C / Services."""
import logging
from datetime import datetime, timezone
logger = logging.getLogger(__name__)


class ShipmentService:
    """Business logic for shipment lifecycle management."""

    def __init__(self, config, blockchain_service, shipment_repo, event_bus):
        self.config = config
        self.blockchain = blockchain_service
        self.shipment_repo = shipment_repo
        self.event_bus = event_bus

    async def create_shipment(self, shipment_code: str, metadata: dict = None) -> dict:
        """Register shipment on blockchain + store in MongoDB."""
        tx_hash = await self.blockchain.register_shipment(shipment_code)
        doc = await self.shipment_repo.create({
            "shipment_code": shipment_code,
            "blockchain_tx": tx_hash,
            "status": "REGISTERED",
            **(metadata or {}),
        })
        await self.event_bus.publish("shipment.created", {"shipment_code": shipment_code})
        return doc

    async def list_shipments(self, skip: int = 0, limit: int = 20) -> list:
        return await self.shipment_repo.list_all(skip, limit)

    async def get_shipment(self, shipment_id: str) -> dict:
        return await self.shipment_repo.find_by_id(shipment_id)

    async def update_status(self, shipment_id: str, status: str) -> bool:
        return await self.shipment_repo.update_status(shipment_id, status)
