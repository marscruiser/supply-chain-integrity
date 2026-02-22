"""
IPFS Uploader — Vision module wrapper.
Re-exports IPFS client from module_b_blockchain for use in Module A.
"""

import json
import io
import logging
import numpy as np

logger = logging.getLogger(__name__)


class IPFSUploader:
    """Simplified IPFS upload client for vision module."""

    def __init__(self, config):
        self.config = config
        self._client = None

    def _connect(self):
        try:
            import ipfshttpclient
            host = getattr(self.config, 'ipfs', None)
            ip = host.host if host else "127.0.0.1"
            port = host.port if host else 5001
            self._client = ipfshttpclient.connect(f"/ip4/{ip}/tcp/{port}")
        except Exception as e:
            logger.error(f"IPFS connection failed: {e}")
            raise

    def upload_result(self, result: dict, image: np.ndarray = None) -> str:
        """Upload inspection result JSON (and optionally image) to IPFS. Returns CID."""
        if self._client is None:
            self._connect()
        json_bytes = json.dumps(result, indent=2, default=str).encode("utf-8")
        res = self._client.add(io.BytesIO(json_bytes), pin=True)
        return res["Hash"]
