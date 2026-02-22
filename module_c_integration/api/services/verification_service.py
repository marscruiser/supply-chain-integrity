"""
Verification Service — Module C / Services
Orchestrates the full end-to-end shipment verification flow:
  1. Receives uploaded X-ray image
  2. Calls Module A Vision API for fingerprint generation
  3. Retrieves origin fingerprint from blockchain (via Module B)
  4. Compares hashes and returns integrity verdict
  5. Stores result on blockchain and IPFS
  6. Logs to MongoDB
  7. Notifies via WebSocket
"""

import httpx
import logging
import hashlib
from typing import Optional
from datetime import datetime, timezone

from services.blockchain_service import BlockchainService
from services.ipfs_service import IPFSService
from database.repositories.inspection_repository import InspectionRepository
from database.repositories.shipment_repository import ShipmentRepository
from schemas.inspection import InspectionCreateSchema, InspectionResultSchema
from core.events import EventBus

logger = logging.getLogger(__name__)


class VerificationService:
    """
    Core orchestration layer for full shipment verification pipeline.
    Called by the /api/v1/verify endpoints.
    """

    def __init__(
        self,
        config,
        blockchain: BlockchainService,
        ipfs: IPFSService,
        inspection_repo: InspectionRepository,
        shipment_repo: ShipmentRepository,
        event_bus: EventBus,
    ):
        self.config = config
        self.blockchain = blockchain
        self.ipfs = ipfs
        self.inspection_repo = inspection_repo
        self.shipment_repo = shipment_repo
        self.event_bus = event_bus
        self.vision_api_url = config.vision_api_url

    async def call_vision_api(self, image_bytes: bytes, reference_cid: Optional[str] = None) -> dict:
        """
        Call Module A Vision API to generate fingerprint and/or compare against reference.
        Returns the full inspection result dict from the vision module.
        """
        async with httpx.AsyncClient(timeout=60.0) as client:
            files = {"image": ("xray.png", image_bytes, "image/png")}
            data = {}
            if reference_cid:
                data["reference_cid"] = reference_cid

            response = await client.post(
                f"{self.vision_api_url}/api/v1/inspect",
                files=files,
                data=data,
            )
            response.raise_for_status()
            return response.json()

    async def store_origin_inspection(
        self,
        shipment_id: str,
        image_bytes: bytes,
    ) -> InspectionResultSchema:
        """
        Store origin inspection for a shipment.
        - Calls vision API for fingerprint
        - Uploads to IPFS
        - Records hash on blockchain
        - Logs to MongoDB
        """
        logger.info(f"Starting origin inspection for shipment: {shipment_id}")

        # Step 1: Vision API — generate fingerprint
        vision_result = await self.call_vision_api(image_bytes)
        fingerprint = vision_result.get("fingerprint", {})

        # Step 2: SHA256 of raw image bytes
        image_sha256 = hashlib.sha256(image_bytes).hexdigest()

        # Step 3: Upload full result to IPFS
        cid = await self.ipfs.upload_json({
            "shipment_id": shipment_id,
            "inspection_type": "ORIGIN",
            "fingerprint": fingerprint,
            "image_sha256": image_sha256,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Step 4: Store on blockchain
        phash = fingerprint.get("perceptual_hashes", {}).get("phash", "")
        ssim_score = int(vision_result.get("ssim_score", 1.0) * 10000)
        tx_hash = await self.blockchain.store_origin_inspection(
            shipment_id=shipment_id,
            image_hash=image_sha256,
            phash=phash,
            ipfs_cid=cid,
            ssim_score_x10000=ssim_score,
        )

        # Step 5: Log to MongoDB
        record = await self.inspection_repo.create({
            "shipment_id": shipment_id,
            "inspection_type": "ORIGIN",
            "image_sha256": image_sha256,
            "ipfs_cid": cid,
            "phash": phash,
            "ssim_score": vision_result.get("ssim_score", 1.0),
            "blockchain_tx": tx_hash,
            "verdict": "CLEAN",
            "created_at": datetime.now(timezone.utc),
        })

        # Step 6: Notify WebSocket
        await self.event_bus.publish("inspection.origin", {
            "shipment_id": shipment_id,
            "cid": cid,
            "tx_hash": tx_hash,
        })

        return InspectionResultSchema(**record)

    async def verify_destination(
        self,
        shipment_id: str,
        image_bytes: bytes,
    ) -> InspectionResultSchema:
        """
        Verify destination shipment against stored origin fingerprint.
        - Fetches origin fingerprint from blockchain
        - Calls vision API for comparison
        - Records verdict on blockchain
        - Returns pass/fail result
        """
        logger.info(f"Starting destination verification for shipment: {shipment_id}")

        # Step 1: Get origin fingerprint CID from blockchain
        shipment_data = await self.blockchain.get_shipment(shipment_id)
        origin_cid = shipment_data.get("originFingerprintCID")
        if not origin_cid:
            raise ValueError(f"No origin inspection found for shipment: {shipment_id}")

        # Step 2: Call vision API with reference CID for comparison
        vision_result = await self.call_vision_api(image_bytes, reference_cid=origin_cid)
        fingerprint = vision_result.get("fingerprint", {})
        verdict = vision_result.get("verdict", {})

        # Step 3: Upload to IPFS
        image_sha256 = hashlib.sha256(image_bytes).hexdigest()
        cid = await self.ipfs.upload_json({
            "shipment_id": shipment_id,
            "inspection_type": "DESTINATION",
            "fingerprint": fingerprint,
            "verdict": verdict,
            "image_sha256": image_sha256,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Step 4: Record on blockchain
        phash = fingerprint.get("perceptual_hashes", {}).get("phash", "")
        hamming = vision_result.get("hash_distance", 0)
        ssim_score = int(vision_result.get("ssim_score", 1.0) * 10000)

        tx_hash, blockchain_verdict = await self.blockchain.verify_destination(
            shipment_id=shipment_id,
            new_image_hash=image_sha256,
            new_phash=phash,
            ipfs_cid=cid,
            ssim_score_x10000=ssim_score,
            hamming_distance=hamming,
        )

        # Step 5: MongoDB log
        record = await self.inspection_repo.create({
            "shipment_id": shipment_id,
            "inspection_type": "DESTINATION",
            "image_sha256": image_sha256,
            "ipfs_cid": cid,
            "phash": phash,
            "ssim_score": vision_result.get("ssim_score", 1.0),
            "hamming_distance": hamming,
            "blockchain_tx": tx_hash,
            "verdict": blockchain_verdict,
            "created_at": datetime.now(timezone.utc),
        })

        # Step 6: WebSocket notification
        await self.event_bus.publish("inspection.destination", {
            "shipment_id": shipment_id,
            "verdict": blockchain_verdict,
            "cid": cid,
            "tx_hash": tx_hash,
        })

        return InspectionResultSchema(**record)
