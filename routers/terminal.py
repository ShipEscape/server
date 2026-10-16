import asyncio

from fastapi import APIRouter, HTTPException
from starlette.websockets import WebSocket, WebSocketDisconnect

from utils.TerminalManager import Report, terminal_manager as tm

router = APIRouter(prefix="/api/terminal", tags=["智能终端(树莓派)接口"])


@router.post("/report", summary="智能终端提交数据")
async def report(r: Report):
    await tm.report(r)
    return {"ok": True}

@router.get("/cnt", summary="智能终端数量")
async def cnt():
    return len(tm.ids())


@router.get("/list", summary="列出智能终端")
async def lst():
    return tm.ids()


@router.get("/info/{id}", summary="获取智能终端数据")
async def info(id: str):
    data = tm.info(id)
    if data is None:
        raise HTTPException(404, "终端不存在")
    return data


@router.websocket("/ws/{id}")
async def terminal_ws(ws: WebSocket, id: str):
    """终端连接：上行二进制热成像帧，下行 {"fps":n,"ttl":s} 指令"""
    await ws.accept()
    tm.sockets[id] = ws
    await tm.set_fps(id)
    try:
        while True:
            tm.push_frame(id, await ws.receive_bytes())
    except WebSocketDisconnect:
        pass
    finally:
        if tm.sockets.get(id) is ws:
            del tm.sockets[id]


@router.websocket("/view/{id}")
async def view_ws(ws: WebSocket, id: str):
    """观看端连接：转发热成像帧，并定期给终端续约"""
    await ws.accept()
    q = tm.add_viewer(id)
    await tm.set_fps(id)
    try:
        while True:
            try:
                await ws.send_bytes(await asyncio.wait_for(q.get(), 10))
            except asyncio.TimeoutError:
                await ws.send_text("ping")  # 同时探测连接是否还在
                await tm.set_fps(id)  # 续约
    except Exception:
        pass
    finally:
        tm.viewers[id].discard(q)
        await tm.set_fps(id)  # 无人观看则降速
