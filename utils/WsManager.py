import asyncio
import json

from starlette.websockets import WebSocket


class WsManager:
    """管理与手机的 WebSocket"""
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast_json(self, data: dict):
        if not self.active_connections:
            return

        message = json.dumps(data)
        disconnected = set()

        async def _safe_send(ws: WebSocket):
            try:
                await ws.send_text(message)
            except:
                disconnected.add(ws)

        await asyncio.gather(*[_safe_send(ws) for ws in self.active_connections])

        self.active_connections.difference_update(disconnected)

ws_manager = WsManager()