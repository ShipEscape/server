import uvicorn
from fastapi import FastAPI
from starlette.staticfiles import StaticFiles
from routers import terminal,mobile

app = FastAPI()
app.include_router(terminal.router)
app.include_router(mobile.router)
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
if __name__ == "__main__":
    print("http://127.0.0.1:8080/")
    uvicorn.run(app, host="", port=8080)  # 监听所有地址
