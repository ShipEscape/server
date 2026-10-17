import os
import sys
import matplotlib.pyplot as plt
import numpy as np

if len(sys.argv) < 2:
    print("使用方法: python render.py <npz文件路径>")
    sys.exit(1)

file_path = sys.argv[1]
if not os.path.exists(file_path):
    print(f"错误: 文件不存在 -> {file_path}")
    sys.exit(1)

# 1. 加载数据
data = np.load(file_path)
temp = data["temp"]  # 80x62 真实摄氏度矩阵
t_min = float(data["t_min"])
t_max = float(data["t_max"])
h, w = temp.shape

# 2. 绘制热力图 (使用 inferno 色盘，契合深蓝→紫→橙→白的前端色调)
plt.figure(figsize=(8, 6))
im = plt.imshow(temp, cmap="inferno", interpolation="bicubic", vmin=t_min, vmax=t_max)

# 添加侧边温度色标尺
cbar = plt.colorbar(im, fraction=0.046, pad=0.04)
cbar.set_label("temp (℃)", fontsize=11)

# 设置标题与隐藏坐标轴
plt.title(f"res: {w}x{h} | min: {t_min:.1f}℃ | max: {t_max:.1f}℃", fontsize=12)
plt.axis("off")

# 3. 保存并展示
out_png = os.path.splitext(file_path)[0] + ".png"
plt.savefig(out_png, bbox_inches="tight", dpi=200)
print(f"渲染成功，已保存至: {out_png}")

plt.show()