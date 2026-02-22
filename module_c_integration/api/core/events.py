"""Event Bus — Module C / Core. Publishes events to WebSocket clients."""
import json
import logging

logger = logging.getLogger(__name__)


class EventBus:
    """In-memory event bus that broadcasts to WebSocket clients."""

    def __init__(self):
        self._clients = []

    def register(self, client):
        self._clients.append(client)

    def deregister(self, client):
        if client in self._clients:
            self._clients.remove(client)

    async def publish(self, event_type: str, payload: dict):
        msg = json.dumps({"type": event_type, "data": payload})
        dead = []
        for client in self._clients:
            try:
                await client.send_text(msg)
            except Exception:
                dead.append(client)
        for d in dead:
            self._clients.remove(d)
