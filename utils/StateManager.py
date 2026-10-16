import dataclasses
from pathlib import Path
from utils.WsManager import ws_manager
from pydantic import BaseModel, json

DATA_DIR = Path(__file__).resolve().parent.parent/"data"
MOBILE_FIRE_DATA_FILE = DATA_DIR / "MobileFireData.json"


class MobileFireData(BaseModel):
    alert: bool | None = None
    fireCenterX: int | None = None
    fireCenterY: int | None = None
    fireIntensity: float | None = None


# class


class StateManager:
    """存储与处理数据"""

    def __init__(self):
        self.mobile_fire_data=self._load_initial_data()

    def _load_initial_data(self) -> MobileFireData:
        try:
            content = MOBILE_FIRE_DATA_FILE.read_text(encoding="utf-8")
            return MobileFireData.model_validate_json(content)
        except:
            return MobileFireData()

    def _save_data(self):
        """保存 MobileFireData"""
        MOBILE_FIRE_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        MOBILE_FIRE_DATA_FILE.write_text(
            self.mobile_fire_data.model_dump_json(indent=2),
            encoding="utf-8"
        )

    async def update_mobile_fire_data(self, data: MobileFireData):
        """更新数据，并自动发送给客户端"""
        patch = data.model_dump(exclude_unset=True)
        self.mobile_fire_data = self.mobile_fire_data.model_copy(update=patch)
        self._save_data()
        await ws_manager.broadcast_json(self.mobile_fire_data.model_dump())


state_manager = StateManager()
