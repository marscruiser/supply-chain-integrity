"""IPFS Service — Module C / Services."""
import json
import io
import logging
logger = logging.getLogger(__name__)


class IPFSService:
    """Async IPFS wrapper for use in FastAPI."""

    def __init__(self, config):
        self.config = config
        self._client = None

    def _connect(self):
        import ipfshttpclient
        self._client = ipfshttpclient.connect(
            f"/ip4/{self.config.ipfs_host}/tcp/{self.config.ipfs_port}"
        )

    async def upload_json(self, data: dict) -> str:
        if not self._client:
            self._connect()
        json_bytes = json.dumps(data, indent=2, default=str).encode("utf-8")
        result = self._client.add(io.BytesIO(json_bytes), pin=True)
        return result["Hash"]

    async def get_json(self, cid: str) -> dict:
        if not self._client:
            self._connect()
        raw = self._client.cat(cid)
        return json.loads(raw.decode("utf-8"))

    async def upload_file(self, file_path: str) -> str:
        if not self._client:
            self._connect()
        result = self._client.add(file_path, pin=True)
        return result["Hash"]
