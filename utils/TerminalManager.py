import asyncio
import json
import sqlite3
import time
from collections import defaultdict
from pathlib import Path

from pydantic import BaseModel, Field
from starlette.websockets import WebSocket

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_FILE = DATA_DIR / "terminal.db"
OFFLINE_SEC = 30
KEEP_DAYS = 30
FPS_IDLE, FPS_VIEW = 1, 8
LEASE_TTL = 30


class TerminalData(BaseModel):
    # 电池
    isAc: bool | None = None
    voltage: float | None = None
    batteryPercent: float | None = Field(None, ge=0, le=100)
    # 烟雾
    smokeAlert: bool = False
    # 毫米波
    personCnt: int = 0
    dotCnt: int = 0
    persons: list[tuple[float, float]] = []   # [x 横向, y 距离]
    # 热成像统计
    thermalMax: float | None = None
    thermalMin: float | None = None
    thermalCenter: float | None = None


class Report(TerminalData):
    id: str


FIELDS = list(TerminalData.model_fields)


class TerminalManager:
    def __init__(self):
        self.db = sqlite3.connect(DB_FILE, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL")
        cols = ", ".join(FIELDS)
        self.db.execute(f"CREATE TABLE IF NOT EXISTS telemetry(id TEXT, ts INTEGER, {cols}, PRIMARY KEY(id, ts))")
        self.db.execute("CREATE TABLE IF NOT EXISTS event(id TEXT, ts INTEGER, kind TEXT, path TEXT)")
        self._clean_ts = 0
        self.latest: dict[str, tuple[int, TerminalData]] = {}
        self.sockets: dict[str, WebSocket] = {}
        self.viewers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # 重启后恢复每台终端的最新一条
        for id, ts, *v in self.db.execute(f"SELECT id, MAX(ts), {cols} FROM telemetry GROUP BY id"):
            row = dict(zip(FIELDS, v))
            row["persons"] = json.loads(row["persons"] or "[]")
            self.latest[id] = (ts, TerminalData(**row))

    # ---------- 状态数据 ----------
    def _save(self, id: str, ts: int, d: TerminalData, alert: bool):
        row = d.model_dump()
        row["persons"] = json.dumps(row["persons"])
        self.db.execute(f"INSERT OR REPLACE INTO telemetry VALUES(?,?,{','.join('?' * len(FIELDS))})",
                        (id, ts // 5 * 5, *row.values()))        # 5 秒一桶，桶内保留最新
        if alert:
            self.db.execute("INSERT INTO event VALUES(?,?,?,?)", (id, ts, "smoke", None))
        if ts - self._clean_ts > 3600:                           # 每小时清理一次
            self._clean_ts = ts
            self.db.execute("DELETE FROM telemetry WHERE ts < ?", (ts - KEEP_DAYS * 86400,))
        self.db.commit()

    async def report(self, r: Report):
        now = int(time.time())
        patch = r.model_dump(exclude={"id"}, exclude_unset=True)   # 只合并上传了的 key
        old = self.latest.get(r.id)                                # 不存在则自动添加
        d = (old[1] if old else TerminalData()).model_copy(update=patch)
        self.latest[r.id] = (now, d)
        alert = d.smokeAlert and not (old and old[1].smokeAlert)   # 只在告警上升沿记事件
        await asyncio.to_thread(self._save, r.id, now, d, alert)

    def ids(self) -> list[str]:
        return sorted(self.latest)

    def info(self, id: str) -> dict | None:
        if id not in self.latest:
            return None
        seen, d = self.latest[id]
        return {**d.model_dump(), "online": time.time() - seen < OFFLINE_SEC}

    # ---------- 热成像高帧率 ----------
    async def set_fps(self, id: str):
        """有人观看 -> 高帧率；无人 -> 低帧率。重复下发即续约。"""
        ws = self.sockets.get(id)
        if ws:
            fps = FPS_VIEW if self.viewers[id] else FPS_IDLE
            await ws.send_json({"fps": fps, "ttl": LEASE_TTL})

    def add_viewer(self, id: str) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=1)    # 只留最新帧，慢客户端自动丢旧帧
        self.viewers[id].add(q)
        return q

    def push_frame(self, id: str, frame: bytes):
        for q in self.viewers[id]:
            if q.full():
                q.get_nowait()
            q.put_nowait(frame)


terminal_manager = TerminalManager()