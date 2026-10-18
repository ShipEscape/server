import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from routers import terminal, mobile
from utils.TerminalManager import SNAP_DIR

app = FastAPI()
app.include_router(terminal.router)
app.include_router(mobile.router)
app.mount("/snapshots", StaticFiles(directory=SNAP_DIR), name="snapshots")
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
print(SNAP_DIR)
if __name__ == "__main__":
    print("http://127.0.0.1:8080/")
    uvicorn.run(app, host="", port=8080)  # 监听所有地址
