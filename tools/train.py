import glob
import os
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

DATA_DIR = "./dataset_testDevice"
BATCH_SIZE = 16
EPOCHS = 15
LR = 0.001
MAX_TEMP = 300.0

class ThermalFireDataset(Dataset):

    def __init__(self, file_paths):
        self.files = file_paths

    def __len__(self):
        return len(self.files)

    def _generate_synthetic_fire(self, h, w):
        """火源生成器"""
        y, x = np.ogrid[:h, :w]
        cx = random.randint(5, w - 6)
        cy = random.randint(5, h - 6)

        mode = random.choices(["tiny", "medium", "large"], weights=[0.5, 0.35, 0.15])[0]

        if mode == "tiny":
            t_core = random.uniform(75.0, 150.0)
            sigma_x = random.uniform(0.5, 1.0)
            sigma_y = random.uniform(0.5, 1.2)

        elif mode == "medium":
            t_core = random.uniform(120.0, 260.0)
            sigma_x = random.uniform(1.0, 2.0)
            sigma_y = random.uniform(1.2, 3.0)

        else:
            t_core = random.uniform(200.0, 450.0)
            sigma_x = random.uniform(2.5, 5.0)
            sigma_y = random.uniform(3.5, 7.0)

        diff_y = (y - cy).astype(np.float32)
        diff_x = (x - cx).astype(np.float32)
        dist = (diff_x ** 2) / (2 * sigma_x ** 2) + (diff_y ** 2) / (2 * sigma_y ** 2)

        fire_mask = (t_core * np.exp(-dist)).astype(np.float32)
        return fire_mask

    def __getitem__(self, idx):
        data = np.load(self.files[idx])
        bg_temp = data["temp"].astype(np.float32)  # shape: (62, 80)
        h, w = bg_temp.shape

        is_fire = 1.0 if random.random() > 0.5 else 0.0

        if is_fire:
            fire_patch = self._generate_synthetic_fire(h, w)
            final_temp = np.maximum(bg_temp, fire_patch)
        else:
            final_temp = bg_temp

        # 固定物理温标归一化
        norm_img = np.clip(final_temp, 0.0, MAX_TEMP) / MAX_TEMP

        tensor_img = torch.from_numpy(norm_img).float().unsqueeze(0)  # (1, 62, 80)
        label = torch.tensor([is_fire], dtype=torch.float32)

        return tensor_img, label


class TinyFireNet(nn.Module):

    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> (16, 31, 40)
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),  # -> (32, 15, 20)
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)),  # -> (64, 1, 1)
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, 1),  # 输出二分类 logits
        )

    def forward(self, x):
        return self.classifier(self.features(x))


# 3. 训练主循环
def main():
    files = sorted(glob.glob(f"{DATA_DIR}/*.npz"))
    if len(files) < 20:
        print(f"数据不足: 至少需要 20 帧以上的数据才能开始训练 (当前仅找到 {len(files)} 帧)。")
        return

    random.shuffle(files)
    split = int(len(files) * 0.9)
    train_files, val_files = files[:split], files[split:]

    train_loader = DataLoader(
        ThermalFireDataset(train_files), batch_size=BATCH_SIZE, shuffle=True
    )
    val_loader = DataLoader(ThermalFireDataset(val_files), batch_size=BATCH_SIZE)

    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "mps"
        if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"[*] 训练设备: {device} | 训练集: {len(train_files)} 帧 | 验证集: {len(val_files)} 帧")

    model = TinyFireNet().to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    for epoch in range(1, EPOCHS + 1):
        # 训练阶段
        model.train()
        train_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(y)

        # 验证阶段
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                preds = (torch.sigmoid(model(x)) > 0.5).float()
                correct += (preds == y).sum().item()
                total += len(y)

        acc = (correct / total) * 100
        print(
            f"Epoch [{epoch:02d}/{EPOCHS:02d}] 损失: {train_loss/len(train_files):.4f} | 验证准确率: {acc:.2f}%"
        )

    torch.save(model.state_dict(), "fire_model.pth")
    dummy_input = torch.randn(1, 1, 62, 80).to(device)
    torch.onnx.export(
        model,
        dummy_input,
        "fire_model.onnx",
        input_names=["input"],
        output_names=["output"],
    )
    print("success")


if __name__ == "__main__":
    main()