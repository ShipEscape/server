import asyncio
import json
import sqlite3
import time
from collections import defaultdict
from pathlib import Path

from pydantic import BaseModel, Field
from starlette.websockets import WebSocket

from utils.StateManager import MobileFireData
from utils.StateManager import state_manager

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_FILE = DATA_DIR / "terminal.db"
SNAP_DIR = DATA_DIR / "snapshots"
OFFLINE_SEC = 70
KEEP_DAYS = 30
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
    persons: list[tuple[float, float]] = []  # [x 横向, y 距离]
    # 热成像统计
    fireAlert: bool = False

    thermalMax: float | None = None
    thermalMin: float | None = None
    thermalCenter: float | None = None
    thermalAvg: float | None = None


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
        self.db.execute("CREATE TABLE IF NOT EXISTS position(id TEXT PRIMARY KEY, x REAL, y REAL)")
        self.pos = {i: (x, y) for i, x, y in self.db.execute("SELECT id, x, y FROM position")}

        have = {r[1] for r in self.db.execute("PRAGMA table_info(telemetry)")}
        for c in FIELDS:
            if c not in have:
                self.db.execute(f"ALTER TABLE telemetry ADD COLUMN {c}")
        self._clean_ts = 0
        self.latest: dict[str, tuple[int, TerminalData]] = {}
        self.sockets: dict[str, WebSocket] = {}
        self.viewers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # 重启后恢复每台终端的最新一条
        for id, ts, *v in self.db.execute(f"SELECT id, MAX(ts), {cols} FROM telemetry GROUP BY id"):
            row = dict(zip(FIELDS, v))
            row["persons"] = json.loads(row["persons"] or "[]")
            self.latest[id] = (ts, TerminalData(**row))

    def set_position(self, id: str, x: float, y: float):
        self.pos[id] = (x, y)
        self.db.execute("INSERT OR REPLACE INTO position VALUES(?,?,?)", (id, x, y))
        self.db.commit()

    # ---------- 状态数据 ----------
    def _save(self, id: str, ts: int, d: TerminalData, alert: bool):
        row = d.model_dump()
        row["persons"] = json.dumps(row["persons"])
        self.db.execute(f"INSERT OR REPLACE INTO telemetry VALUES(?,?,{','.join('?' * len(FIELDS))})",
                        (id, ts // 5 * 5, *row.values()))  # 5 秒一桶，桶内保留最新
        if alert:
            self.db.execute("INSERT INTO event VALUES(?,?,?,?)", (id, ts, "smoke", None))
        if ts - self._clean_ts > 3600:  # 每小时清理一次
            self._clean_ts = ts
            self.db.execute("DELETE FROM telemetry WHERE ts < ?", (ts - KEEP_DAYS * 86400,))
        self.db.commit()

    async def report(self, r: Report):
        now = int(time.time())
        patch = r.model_dump(exclude={"id"}, exclude_unset=True)  # 只合并上传了的 key
        old = self.latest.get(r.id)  # 不存在则自动添加
        d = (old[1] if old else TerminalData()).model_copy(update=patch)
        self.latest[r.id] = (now, d)
        alert = d.fireAlert and not (old and old[1].fireAlert)  # 只在告警上升沿记事件
        await asyncio.to_thread(self._save, r.id, now, d, alert)
        rise = d.fireAlert and not (old and old[1].fireAlert)
        fall = bool(old and old[1].fireAlert) and not d.fireAlert
        if rise or fall:
            await asyncio.to_thread(self._event, r.id, now, "fire" if rise else "fire_end")
            await self._sync_fire()

    def save_snapshot(self, id: str, kind: str, data: bytes, ext: str) -> str:
        ts = int(time.time() * 1000)
        path = SNAP_DIR / id / f"{ts}{ext}"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        rel = f"{id}/{path.name}"
        self.db.execute("INSERT INTO event VALUES(?,?,?,?)", (id, ts // 1000, kind, rel))
        self.db.commit()
        return rel

    def _event(self, id: str, ts: int, kind: str):
        self.db.execute("INSERT INTO event VALUES(?,?,?,?)", (id, ts, kind, None))
        self.db.commit()

    async def _sync_fire(self):
        """任意终端在报警，全局就报警，火源坐标取第一个报警终端的位置"""
        act = [i for i, (_, d) in self.latest.items() if d.fireAlert]
        x, y = self.pos.get(act[0], (None, None)) if act else (None, None)
        await state_manager.update_mobile_fire_data(MobileFireData(
            alert=bool(act),
            fireCenterX=None if x is None else int(x),
            fireCenterY=None if y is None else int(y)))

    def ids(self) -> list[str]:
        return sorted(self.latest)

    def info(self, id: str) -> dict | None:
        if id not in self.latest:
            return None
        seen, d = self.latest[id]
        x, y = self.pos.get(id, (None, None))
        return {**d.model_dump(), "x": x, "y": y, "online": id in self.sockets or time.time() - seen < OFFLINE_SEC}

    # ---------- 热成像高帧率 ----------
    async def set_live(self, id: str):
        ws = self.sockets.get(id)
        if ws:
            await ws.send_json({"live": bool(self.viewers[id]), "ttl": LEASE_TTL})

    def add_viewer(self, id: str) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=1)  # 只留最新帧，慢客户端自动丢旧帧
        self.viewers[id].add(q)
        return q

    def push_frame(self, id: str, frame: bytes):
        for q in self.viewers[id]:
            if q.full():
                q.get_nowait()
            q.put_nowait(frame)

    def history(self, id: str, start: int, end: int, points: int = 300) -> list[dict]:
        step = max(5, (end - start) // points // 5 * 5)
        rows = self.db.execute(
            "SELECT ts/?*? AS t, AVG(thermalAvg), AVG(voltage), AVG(batteryPercent), MAX(personCnt), AVG(isAc) "
            "FROM telemetry WHERE id=? AND ts BETWEEN ? AND ? GROUP BY t ORDER BY t",
            (step, step, id, start, end)).fetchall()
        cols = ["t", "thermalAvg", "voltage", "batteryPercent", "personCnt", "isAc"]
        return [dict(zip(cols, r)) for r in rows]

    def alarms(self, id: str | None = None, limit: int = 50) -> list[dict]:
        sql = "SELECT id, ts, kind, path FROM event WHERE kind IN ('fire','fire_end','thermal')"
        rows = self.db.execute(sql + (" AND id=?" if id else "") + " ORDER BY ts", (id,) if id else ()).fetchall()
        cur, out = {}, []
        for tid, ts, kind, path in rows:
            if kind == "fire":
                cur[tid] = {"id": tid, "start": ts, "end": None, "images": []}
                out.append(cur[tid])
            elif tid in cur and kind == "fire_end":
                cur.pop(tid)["end"] = ts
            elif tid in cur and kind == "thermal":
                cur[tid]["images"].append(path)
        return out[::-1][:limit]


terminal_manager = TerminalManager()
