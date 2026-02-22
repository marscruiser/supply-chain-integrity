"""
IPFS Uploader — Module B / IPFS
Handles all IPFS upload/retrieval operations.

Uses ipfshttpclient to communicate with local IPFS node (or via web3.storage API).
Supports:
  - Uploading JSON inspection data
  - Uploading X-ray image files
  - Uploading diff/visualization reports
  - Pinning content
  - CID retrieval and status checking
"""

import json
import io
import hashlib
import logging
from pathlib import Path
from typing import Optional, Union
import numpy as np

logger = logging.getLogger(__name__)


class IPFSUploader:
    """
    Client for interacting with IPFS via local daemon or web3.storage.
    All uploads return a CID (Content Identifier) string.
    """

    def __init__(self, config):
        self.config = config
        self.ipfs_host = getattr(config, 'ipfs', None)
        self._client = None

    def _get_client(self):
        """Lazily initialize IPFS connection."""
        if self._client is not None:
            return self._client
        try:
            import ipfshttpclient
            host = self.ipfs_host.host if self.ipfs_host else "127.0.0.1"
            port = self.ipfs_host.port if self.ipfs_host else 5001
            self._client = ipfshttpclient.connect(f"/ip4/{host}/tcp/{port}")
            logger.info(f"Connected to IPFS at {host}:{port}")
            return self._client
        except Exception as e:
            logger.error(f"Failed to connect to IPFS: {e}")
            raise

    def upload_json(self, data: dict) -> str:
        """Upload a JSON dict to IPFS. Returns CID."""
        json_bytes = json.dumps(data, indent=2).encode("utf-8")
        client = self._get_client()
        result = client.add(io.BytesIO(json_bytes), pin=True)
        cid = result["Hash"]
        logger.info(f"Uploaded JSON to IPFS. CID: {cid}")
        return cid

    def upload_file(self, file_path: str) -> str:
        """Upload a file from disk to IPFS. Returns CID."""
        client = self._get_client()
        result = client.add(str(file_path), pin=True)
        cid = result["Hash"]
        logger.info(f"Uploaded {file_path} to IPFS. CID: {cid}")
        return cid

    def upload_image(self, image: np.ndarray, filename: str = "xray.png") -> str:
        """Upload a numpy image array to IPFS. Returns CID."""
        import cv2
        _, encoded = cv2.imencode(".png", (image * 255).astype(np.uint8) if image.dtype == np.float32 else image)
        client = self._get_client()
        result = client.add(io.BytesIO(encoded.tobytes()), pin=True)
        cid = result["Hash"]
        logger.info(f"Uploaded image to IPFS. CID: {cid}")
        return cid

    def upload_result(self, result: dict, image: Optional[np.ndarray] = None) -> str:
        """
        Upload a full inspection result to IPFS.
        - Uploads image separately if provided
        - Embeds image CID into result JSON
        - Returns CID of result JSON
        """
        if image is not None:
            try:
                img_cid = self.upload_image(image)
                result["xray_image_cid"] = img_cid
            except Exception as e:
                logger.warning(f"Image upload failed: {e}")
        return self.upload_json(result)

    def get_content(self, cid: str) -> bytes:
        """Retrieve content from IPFS by CID. Returns raw bytes."""
        client = self._get_client()
        return client.cat(cid)

    def get_json(self, cid: str) -> dict:
        """Retrieve and parse JSON from IPFS by CID."""
        raw = self.get_content(cid)
        return json.loads(raw.decode("utf-8"))

    def pin(self, cid: str) -> bool:
        """Pin a CID to prevent garbage collection."""
        try:
            client = self._get_client()
            client.pin.add(cid)
            return True
        except Exception as e:
            logger.warning(f"Failed to pin {cid}: {e}")
            return False

    def is_available(self, cid: str) -> bool:
        """Check if a CID is available on the local node."""
        try:
            self.get_content(cid)
            return True
        except Exception:
            return False

    def get_gateway_url(self, cid: str) -> str:
        """Return the public IPFS gateway URL for a CID."""
        host = self.ipfs_host.gateway if self.ipfs_host else "http://127.0.0.1:8080"
        return f"{host}/ipfs/{cid}"
