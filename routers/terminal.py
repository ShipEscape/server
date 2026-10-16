from fastapi import APIRouter

router = APIRouter(prefix="/api/terminal", tags=["智能终端(树莓派)接口"])


@router.post("/report", summary="智能终端提交数据")
async def report():
    # TODO: 未完成
    return "success"

@router.post("/cnt", summary="智能终端数量")
async def lst():
    # TODO: 未完成
    return 2

@router.post("/list", summary="列出智能终端")
async def lst():
    # TODO: 未完成
    return ["0", "1"]


@router.post("/info/{id}", summary="获取智能终端数据")
async def info(id):
    # TODO: 未完成
    return {"smokeAlert": False,
            "batteryPercent": 80,
            "temperature": 25,
            "dotCnt": 10,
            "personCnt": 3,
            "thermalUrl": "http://example.com"}
