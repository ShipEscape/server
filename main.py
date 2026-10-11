import json

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from starlette.staticfiles import StaticFiles

app = FastAPI()

# 已连接的 Android 客户端
connected_clients: set[WebSocket] = set()

data = {
    "alert": False,
    "fireCenterX": 0,
    "fireCenterY": 0,
    "fireIntensity": 0.0,
}


class Report(BaseModel):
    alert: bool | None = None
    fireCenterX: int | None = None
    fireCenterY: int | None = None
    fireIntensity: float | None = None


# 智能终端提交数据, 允许只提交部分数据
@app.post("/api/report")
async def report(report_data: Report):
    global data
    data.update(report_data.model_dump(exclude_unset=True))

    disconnected = set()
    for ws in connected_clients:
        try:
            # 广播最新数据
            await ws.send_text(json.dumps(data))
        except:
            disconnected.add(ws)

    # 清理失效的连接
    connected_clients.difference_update(disconnected)
    return "success"


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    global data
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        await websocket.send_text(json.dumps(data))

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.get("/api/data")
async def return_data():
    global data
    return data

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run(app, host="", port=8080)  # 监听所有地址
