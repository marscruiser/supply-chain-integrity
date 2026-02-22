"""
Blockchain Service — Module C / Services
Wraps Web3.py calls to interact with deployed smart contracts.
All methods are async-compatible via run_in_executor for blocking Web3 calls.
"""

import asyncio
import logging
import json
from pathlib import Path
from typing import Optional, Tuple
from functools import partial

from web3 import Web3
from web3.middleware import geth_poa_middleware

logger = logging.getLogger(__name__)


class BlockchainService:
    """
    Service layer for all blockchain interactions.
    Wraps the SupplyChainIntegrity smart contract.
    """

    def __init__(self, config):
        self.config = config
        self._w3: Optional[Web3] = None
        self._contract = None
        self._account = None

    def _get_web3(self) -> Web3:
        if self._w3 is not None:
            return self._w3
        self._w3 = Web3(Web3.HTTPProvider(self.config.eth_rpc_url))
        self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        if not self._w3.is_connected():
            raise ConnectionError(f"Cannot connect to Ethereum node at {self.config.eth_rpc_url}")
        logger.info(f"Connected to Ethereum node. Chain ID: {self._w3.eth.chain_id}")
        return self._w3

    def _get_contract(self):
        if self._contract is not None:
            return self._contract
        w3 = self._get_web3()
        # Load ABI from compiled artifacts
        abi_path = Path(__file__).parent.parent / "config" / "SupplyChainIntegrity_abi.json"
        if not abi_path.exists():
            raise FileNotFoundError(f"Contract ABI not found: {abi_path}. Run 'make deploy-contracts' first.")
        with open(abi_path) as f:
            abi = json.load(f)
        self._contract = w3.eth.contract(
            address=w3.to_checksum_address(self.config.contract_address),
            abi=abi,
        )
        return self._contract

    def _get_account(self):
        if self._account is not None:
            return self._account
        w3 = self._get_web3()
        self._account = w3.eth.account.from_key(self.config.eth_private_key)
        return self._account

    def _send_transaction(self, func) -> str:
        """Build, sign, and send a contract transaction. Returns tx hash."""
        w3 = self._get_web3()
        account = self._get_account()
        nonce = w3.eth.get_transaction_count(account.address)
        tx = func.build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": self.config.gas_limit,
            "gasPrice": w3.eth.gas_price,
        })
        signed = w3.eth.account.sign_transaction(tx, private_key=self.config.eth_private_key)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return receipt.transactionHash.hex()

    async def _run_blocking(self, func, *args, **kwargs):
        """Run a blocking call in thread executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))

    async def register_shipment(self, shipment_code: str) -> str:
        """Register a new shipment on blockchain. Returns tx hash."""
        contract = self._get_contract()
        func = contract.functions.registerShipment(shipment_code)
        return await self._run_blocking(self._send_transaction, func)

    async def store_origin_inspection(
        self,
        shipment_id: str,
        image_hash: str,
        phash: str,
        ipfs_cid: str,
        ssim_score_x10000: int,
    ) -> str:
        """Store origin inspection record on blockchain. Returns tx hash."""
        contract = self._get_contract()
        w3 = self._get_web3()
        image_hash_bytes = w3.to_bytes(hexstr=f"0x{image_hash}")
        ship_id = int(shipment_id)
        func = contract.functions.storeOriginInspection(
            ship_id, image_hash_bytes, phash, ipfs_cid, ssim_score_x10000
        )
        return await self._run_blocking(self._send_transaction, func)

    async def verify_destination(
        self,
        shipment_id: str,
        new_image_hash: str,
        new_phash: str,
        ipfs_cid: str,
        ssim_score_x10000: int,
        hamming_distance: int,
        notes: str = "",
    ) -> Tuple[str, str]:
        """Verify destination and get verdict. Returns (tx_hash, verdict_string)."""
        contract = self._get_contract()
        w3 = self._get_web3()
        image_hash_bytes = w3.to_bytes(hexstr=f"0x{new_image_hash}")
        ship_id = int(shipment_id)
        func = contract.functions.verifyDestinationInspection(
            ship_id, image_hash_bytes, new_phash, ipfs_cid,
            ssim_score_x10000, hamming_distance, notes
        )
        tx_hash = await self._run_blocking(self._send_transaction, func)
        # Fetch updated verdict from contract
        shipment = await self.get_shipment(shipment_id)
        status_map = {4: "TAMPERED", 3: "CLEAN", 5: "DISPUTED"}
        verdict = status_map.get(shipment.get("status", 0), "UNKNOWN")
        return tx_hash, verdict

    async def get_shipment(self, shipment_id: str) -> dict:
        """Fetch shipment data from blockchain."""
        contract = self._get_contract()
        result = await self._run_blocking(
            contract.functions.getShipment(int(shipment_id)).call
        )
        return {
            "shipmentId": result[0],
            "shipmentCode": result[1],
            "originator": result[2],
            "status": result[4],
            "originFingerprintCID": result[8],
            "originImageHash": result[9].hex() if result[9] else None,
        }

    async def get_system_stats(self) -> dict:
        """Get contract statistics."""
        contract = self._get_contract()
        total_ships, total_insp, total_alerts = await self._run_blocking(
            contract.functions.getSystemStats().call
        )
        return {
            "total_shipments": total_ships,
            "total_inspections": total_insp,
            "total_tampering_alerts": total_alerts,
        }
