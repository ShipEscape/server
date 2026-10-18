import asyncio
import time

from fastapi import APIRouter, HTTPException, UploadFile
from pathlib import Path
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
    await tm.set_live(id)
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
    await tm.set_live(id)
    last = time.monotonic()
    try:
        while True:
            try:
                await ws.send_bytes(await asyncio.wait_for(q.get(), 10))
            except asyncio.TimeoutError:
                await ws.send_text("ping")          # 没有帧时探测连接是否还在
            if time.monotonic() - last > 10:        # 按时间续约，不依赖是否有帧
                last = time.monotonic()
                await tm.set_live(id)
    except Exception:
        pass
    finally:
        tm.viewers[id].discard(q)
        await tm.set_live(id)

@router.post("/snapshot/{id}", summary="智能终端上传抓拍")
async def snapshot(id: str, file: UploadFile, kind: str = "photo"):   # kind: photo / thermal
    ext = Path(file.filename or "").suffix or ".jpg"
    return {"path": tm.save_snapshot(id, kind, await file.read(), ext)}

@router.get("/history/{id}", summary="历史曲线数据")
async def history(id: str, start: int, end: int):
    return await asyncio.to_thread(tm.history, id, start, end)

@router.post("/position/{id}", summary="设置终端位置")
async def set_position(id: str, x: float, y: float):
    tm.set_position(id, x, y)
    return {"ok": True}

@router.get("/alarms", summary="报警日志")
async def alarms(id: str | None = None, limit: int = 50):
    return await asyncio.to_thread(tm.alarms, id, limit)