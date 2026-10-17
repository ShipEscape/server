import json

from fastapi import APIRouter
from fastapi import WebSocket
from pydantic import BaseModel

from utils.StateManager import MobileFireData, state_manager
from utils.WsManager import ws_manager

router = APIRouter(prefix="/api/mobile", tags=["手机逃生客户端接口"])

@router.websocket("/ws")
async def ws(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_text(state_manager.mobile_fire_data.model_dump_json())
        while True:
            await websocket.receive_text()
    except:
        ws_manager.disconnect(websocket)


@router.get("/data")
async def return_data():
    return state_manager.mobile_fire_data.model_dump()
