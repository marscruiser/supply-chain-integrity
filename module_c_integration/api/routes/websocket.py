"""WebSocket route — Module C API. Real-time dashboard updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging
router = APIRouter()
logger = logging.getLogger(__name__)

connected_clients = []


@router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """Accept WebSocket connections from React dashboard for real-time events."""
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info(f"WebSocket client connected. Total: {len(connected_clients)}")
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or handle client messages
            await websocket.send_text(json.dumps({"type": "ack", "data": data}))
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(connected_clients)}")


async def broadcast(event_type: str, payload: dict):
    """Broadcast event to all connected dashboard clients."""
    message = json.dumps({"type": event_type, "data": payload})
    dead = []
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            dead.append(client)
    for d in dead:
        connected_clients.remove(d)
