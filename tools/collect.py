import asyncio
import os
import struct
import time
import numpy as np
import websockets

WS_URL = "ws://127.0.0.1:8080/api/terminal/view/testDevice"  # 目标服务地址与设备ID
SAVE_DIR = "./dataset_testDevice"

os.makedirs(SAVE_DIR, exist_ok=True)


async def main():
    last_save = 0.0

    while True:
        try:
            print(f"正在连接 {WS_URL} ...")
            async with websockets.connect(WS_URL) as ws:
                print("连接成功，开始每秒采集 1 帧...")
                while True:
                    msg = await ws.recv()
                    # 忽略字符串心跳
                    if isinstance(msg, str):
                        continue

                    now = time.time()
                    # 严格限制每秒保存 1 帧
                    if now - last_save < 1.0:
                        continue

                    # 解析头部 12 字节 (<HHff)
                    w, h, lo, hi = struct.unpack("<HHff", msg[:12])

                    # 提取 uint8 像素并反算为实际摄氏度矩阵 (h, w)
                    raw = np.frombuffer(msg[12 : 12 + w * h], dtype=np.uint8).reshape((h, w))
                    temp = lo + (raw.astype(np.float32) / 255.0) * (hi - lo)

                    # 保存为压缩文件
                    filename = f"{SAVE_DIR}/{int(now)}.npz"
                    np.savez_compressed(
                        filename,
                        temp=temp,  # 80x62 摄氏度矩阵 (float32)
                        t_min=lo,  # 最低温
                        t_max=hi,  # 最高温
                    )

                    last_save = now
                    print(f"[{time.strftime('%H:%M:%S')}] 已保存: {filename} ({w}x{h}, {lo:.1f}℃ ~ {hi:.1f}℃)")

        except Exception as e:
            print(f"连接断开或出错: {e}，2 秒后重试...")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())