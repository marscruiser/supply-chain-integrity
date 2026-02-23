"""
Blockchain Service — Module C / Services
Wraps Web3.py calls to interact with deployed smart contracts.
All methods are async-compatible via run_in_executor for blocking Web3 calls.
"""

import asyncio
import logging
import json
import hashlib
from pathlib import Path
from typing import Optional, Tuple
from functools import partial

from web3 import Web3

logger = logging.getLogger(__name__)

STATUS_NAMES = ["REGISTERED", "ORIGIN_INSPECTED", "IN_TRANSIT", "DESTINATION_VERIFIED", "TAMPERED", "DISPUTED"]
VERDICT_NAMES = ["CLEAN", "SUSPICIOUS", "TAMPERED"]


class BlockchainService:
    """Service layer for all blockchain interactions."""

    def __init__(self, config):
        self.config = config
        self._w3: Optional[Web3] = None
        self._contract = None
        self._account = None

    def _get_web3(self) -> Web3:
        if self._w3 is not None:
            return self._w3
        self._w3 = Web3(Web3.HTTPProvider(self.config.eth_rpc_url))
        if not self._w3.is_connected():
            raise ConnectionError(f"Cannot connect to Ethereum node at {self.config.eth_rpc_url}")
        logger.info(f"Connected to Ethereum node. Chain ID: {self._w3.eth.chain_id}")
        return self._w3

    def _get_contract(self):
        if self._contract is not None:
            return self._contract
        w3 = self._get_web3()

        # Load ABI from compiled artifact (full Hardhat JSON)
        abi_path = Path(__file__).parent.parent / "config" / "SupplyChainIntegrity_abi.json"
        if not abi_path.exists():
            raise FileNotFoundError(f"Contract ABI not found: {abi_path}")
        with open(abi_path) as f:
            artifact = json.load(f)

        # Support both full Hardhat artifact {"abi": [...]} and plain ABI [...]
        abi = artifact.get("abi", artifact) if isinstance(artifact, dict) else artifact

        # Load contract address from deployment file
        addr_path = Path(__file__).parent.parent / "config" / "contract_addresses.json"
        if addr_path.exists():
            with open(addr_path) as f:
                addresses = json.load(f)
            contract_addr = addresses["contracts"]["SupplyChainIntegrity"]
        elif self.config.contract_address:
            contract_addr = self.config.contract_address
        else:
            raise FileNotFoundError("No contract address found. Deploy contracts first.")

        self._contract = w3.eth.contract(
            address=w3.to_checksum_address(contract_addr),
            abi=abi,
        )
        logger.info(f"Loaded SupplyChainIntegrity contract at {contract_addr}")
        return self._contract

    def _get_account(self):
        if self._account is not None:
            return self._account
        w3 = self._get_web3()
        self._account = w3.eth.account.from_key(self.config.eth_private_key)
        return self._account

    def _send_transaction(self, func):
        """Build, sign, and send a contract transaction. Returns receipt."""
        w3 = self._get_web3()
        account = self._get_account()
        nonce = w3.eth.get_transaction_count(account.address)
        tx = func.build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 3000000,
            "gasPrice": w3.eth.gas_price,
        })
        signed = w3.eth.account.sign_transaction(tx, private_key=self.config.eth_private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return receipt

    async def _run_blocking(self, func, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    # ─── Public API ───────────────────────────────────────────────────────────

    async def get_connection_info(self) -> dict:
        """Get blockchain connection details."""
        w3 = self._get_web3()
        account = self._get_account()
        balance = w3.eth.get_balance(account.address)
        contract = self._get_contract()
        return {
            "connected": True,
            "rpc_url": self.config.eth_rpc_url,
            "chain_id": w3.eth.chain_id,
            "block_number": w3.eth.block_number,
            "account": account.address,
            "balance_eth": float(w3.from_wei(balance, "ether")),
            "contract_address": contract.address,
        }

    async def register_shipment(self, shipment_code: str) -> dict:
        """Register a new shipment on blockchain."""
        contract = self._get_contract()
        func = contract.functions.registerShipment(shipment_code)
        receipt = await self._run_blocking(self._send_transaction, func)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "shipment_code": shipment_code,
            "status": "REGISTERED",
        }

    async def store_origin_inspection(
        self, shipment_id: int, image_data: str, phash: str, ipfs_cid: str
    ) -> dict:
        """Store origin inspection. image_data is used to generate SHA-256 hash."""
        contract = self._get_contract()
        image_hash = hashlib.sha256(image_data.encode()).digest()
        func = contract.functions.storeOriginInspection(
            shipment_id, image_hash, phash, ipfs_cid, 10000  # SSIM=1.0 for origin
        )
        receipt = await self._run_blocking(self._send_transaction, func)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "image_hash": image_hash.hex(),
            "phash": phash,
            "ipfs_cid": ipfs_cid,
        }

    async def verify_destination(
        self, shipment_id: int, image_data: str, phash: str, ipfs_cid: str,
        ssim_score: float, hamming_distance: int, notes: str = ""
    ) -> dict:
        """Verify at destination. Returns verdict."""
        contract = self._get_contract()
        image_hash = hashlib.sha256(image_data.encode()).digest()
        ssim_x10000 = int(ssim_score * 10000)
        func = contract.functions.verifyDestinationInspection(
            shipment_id, image_hash, phash, ipfs_cid,
            ssim_x10000, hamming_distance, notes
        )
        receipt = await self._run_blocking(self._send_transaction, func)
        # Read back the latest inspection record to get the verdict
        shipment = await self.get_shipment(shipment_id)
        return {
            "tx_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "image_hash": image_hash.hex(),
            "ssim_score": ssim_score,
            "hamming_distance": hamming_distance,
            "verdict": shipment["status"],
            "shipment_status": shipment["status"],
        }

    async def get_shipment(self, shipment_id: int) -> dict:
        """Fetch shipment data from blockchain."""
        contract = self._get_contract()
        result = await self._run_blocking(
            contract.functions.getShipment(shipment_id).call
        )
        return {
            "shipment_id": result[0],
            "shipment_code": result[1],
            "originator": result[2],
            "current_holder": result[3],
            "status": STATUS_NAMES[result[4]] if result[4] < len(STATUS_NAMES) else "UNKNOWN",
            "registered_at": result[5],
            "last_updated_at": result[6],
            "inspection_count": len(result[7]),
            "origin_cid": result[8] or None,
            "origin_image_hash": result[9].hex() if result[9] != b'\x00' * 32 else None,
            "origin_phash": result[10] or None,
        }

    async def get_inspection_record(self, record_id: int) -> dict:
        """Fetch a single inspection record."""
        contract = self._get_contract()
        r = await self._run_blocking(
            contract.functions.getInspectionRecord(record_id).call
        )
        inspection_types = ["ORIGIN", "IN_TRANSIT", "DESTINATION"]
        return {
            "record_id": r[0],
            "shipment_id": r[1],
            "inspection_type": inspection_types[r[2]] if r[2] < len(inspection_types) else "UNKNOWN",
            "image_hash": r[3].hex() if r[3] != b'\x00' * 32 else None,
            "phash": r[4],
            "ipfs_cid": r[5],
            "ssim_score": r[6] / 10000,
            "hamming_distance": r[7],
            "verdict": VERDICT_NAMES[r[8]] if r[8] < len(VERDICT_NAMES) else "UNKNOWN",
            "inspector": r[9],
            "timestamp": r[10],
            "notes": r[11],
        }

    async def get_system_stats(self) -> dict:
        """Get contract-level statistics."""
        contract = self._get_contract()
        total_ships, total_insp, total_alerts = await self._run_blocking(
            contract.functions.getSystemStats().call
        )
        w3 = self._get_web3()
        return {
            "total_shipments": total_ships,
            "total_inspections": total_insp,
            "total_tampering_alerts": total_alerts,
            "block_number": w3.eth.block_number,
            "chain_id": w3.eth.chain_id,
        }

    async def run_full_demo(self) -> dict:
        """Run the full demo sequence: register → origin → verify clean → register → origin → verify tampered."""
        steps = []

        # Step 1: Register shipment
        import time
        code = f"SHP-DEMO-{int(time.time()) % 100000}"
        reg = await self.register_shipment(code)
        ship_id = (await self.get_system_stats())["total_shipments"]
        steps.append({
            "step": 1,
            "action": "Register Shipment",
            "description": f"Registered shipment {code}",
            "tx_hash": reg["tx_hash"],
            "gas_used": reg["gas_used"],
            "block": reg["block_number"],
            "result": "REGISTERED",
            "result_type": "success",
        })

        # Step 2: Store origin inspection
        origin = await self.store_origin_inspection(
            ship_id, f"clean-xray-{code}", "a1b2c3d4e5f60718",
            f"QmOrigin{code[-5:]}"
        )
        steps.append({
            "step": 2,
            "action": "Store Origin Fingerprint",
            "description": f"SHA-256: {origin['image_hash'][:16]}... | pHash: {origin['phash']}",
            "tx_hash": origin["tx_hash"],
            "gas_used": origin["gas_used"],
            "block": origin["block_number"],
            "result": "ORIGIN_INSPECTED",
            "result_type": "success",
        })

        # Step 3: Verify clean
        clean = await self.verify_destination(
            ship_id, f"clean-xray-{code}", "a1b2c3d4e5f60718",
            f"QmCleanDest{code[-5:]}", 0.98, 2, "Cargo intact."
        )
        steps.append({
            "step": 3,
            "action": "Verify at Destination (Clean)",
            "description": f"SSIM: 0.98 | Hamming: 2 — Below threshold",
            "tx_hash": clean["tx_hash"],
            "gas_used": clean["gas_used"],
            "block": clean["block_number"],
            "result": clean["verdict"],
            "result_type": "success",
        })

        # Step 4: Register a second shipment for tamper demo
        code2 = f"SHP-TAMP-{int(time.time()) % 100000}"
        reg2 = await self.register_shipment(code2)
        ship_id2 = (await self.get_system_stats())["total_shipments"]
        steps.append({
            "step": 4,
            "action": "Register Shipment (Tamper Test)",
            "description": f"Registered {code2} for tampering demo",
            "tx_hash": reg2["tx_hash"],
            "gas_used": reg2["gas_used"],
            "block": reg2["block_number"],
            "result": "REGISTERED",
            "result_type": "success",
        })

        # Step 5: Store origin for tamper shipment
        origin2 = await self.store_origin_inspection(
            ship_id2, f"original-{code2}", "ff00ff00ff00ff00",
            f"QmOrigin{code2[-5:]}"
        )
        steps.append({
            "step": 5,
            "action": "Store Origin Fingerprint",
            "description": f"SHA-256: {origin2['image_hash'][:16]}... | pHash: ff00ff00ff00ff00",
            "tx_hash": origin2["tx_hash"],
            "gas_used": origin2["gas_used"],
            "block": origin2["block_number"],
            "result": "ORIGIN_INSPECTED",
            "result_type": "success",
        })

        # Step 6: Verify tampered
        tampered = await self.verify_destination(
            ship_id2, f"TAMPERED-contraband-{code2}", "00ff00ff00ff00ff",
            f"QmTampered{code2[-5:]}", 0.32, 42, "ALERT: Structural anomaly detected!"
        )
        steps.append({
            "step": 6,
            "action": "Verify at Destination (Tampered)",
            "description": f"SSIM: 0.32 | Hamming: 42 — Above threshold!",
            "tx_hash": tampered["tx_hash"],
            "gas_used": tampered["gas_used"],
            "block": tampered["block_number"],
            "result": tampered["verdict"],
            "result_type": "danger",
        })

        stats = await self.get_system_stats()
        return {"steps": steps, "stats": stats}
