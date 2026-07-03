from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ISOLATED_SRC = ROOT / "demo" / "black-cat-ten-gods-isolated-source.png"
FALLBACK_SRC = ROOT / "demo" / "black-cat-painterly-ten-gods-smile-gaze.png"
SRC = ISOLATED_SRC if ISOLATED_SRC.exists() else FALLBACK_SRC
OUT_DIR = ROOT / "miniprogram" / "images" / "ten-gods" / "cat"
PREVIEW = ROOT / "demo" / "black-cat-ten-gods-cutout-preview.png"

NAMES = [
    "bijian",
    "jiecai",
    "shishen",
    "shangguan",
    "piancai",
    "zhengcai",
    "qisha",
    "zhengguan",
    "pianyin",
    "zhengyin",
]

CANVAS = 256
FIT_W = 216
FIT_H = 230


def checkerboard(width, height, size=24):
    y, x = np.indices((height, width))
    board = ((x // size + y // size) % 2) * 18 + 226
    return np.dstack([board, board, board]).astype(np.uint8)


def remove_background(crop_rgb):
    h, w = crop_rgb.shape[:2]
    bgr = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)
    hsv = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2HSV)

    mask = np.full((h, w), cv2.GC_BGD, dtype=np.uint8)
    margin_x = max(10, int(w * 0.035))
    margin_y = max(14, int(h * 0.035))
    central = np.zeros((h, w), dtype=bool)
    central[margin_y:h - margin_y, margin_x:w - margin_x] = True

    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    dark = gray < 86
    warm_prop = (hue < 42) & (sat > 58) & (val > 58)
    brown_prop = (hue < 36) & (sat > 32) & (val > 38) & (val < 190)
    raw_seed = ((dark | warm_prop | brown_prop) & central).astype(np.uint8) * 255

    # Drop canvas texture fragments by keeping meaningful color/dark components only.
    labels_count, labels, stats, centroids = cv2.connectedComponentsWithStats(raw_seed, 8)
    seed = np.zeros_like(raw_seed)
    for label in range(1, labels_count):
        x, y, bw, bh, area = stats[label]
        if area < 18:
            continue
        touches_edge = x <= 5 or y <= 5 or x + bw >= w - 5 or y + bh >= h - 5
        cx, cy = centroids[label]
        near_center = (w * 0.08) < cx < (w * 0.92) and (h * 0.06) < cy < (h * 0.94)
        if touches_edge and area < 2800:
            continue
        if not near_center and area < 120:
            continue
        seed[labels == label] = 255

    seed_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, seed_kernel, iterations=1)
    probable = cv2.dilate(seed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (33, 33)), iterations=1)
    mask[probable > 0] = cv2.GC_PR_FGD
    mask[seed > 0] = cv2.GC_FGD

    # Keep image edges as certain background.
    edge = max(8, int(min(w, h) * 0.03))
    mask[:edge, :] = cv2.GC_BGD
    mask[-edge:, :] = cv2.GC_BGD
    mask[:, :edge] = cv2.GC_BGD
    mask[:, -edge:] = cv2.GC_BGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, None, bgd_model, fgd_model, 7, cv2.GC_INIT_WITH_MASK)

    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    fg = cv2.bitwise_and(fg, cv2.dilate(seed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (47, 47)), iterations=1))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, kernel, iterations=2)

    labels_count, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = np.zeros_like(fg)
    for label in range(1, labels_count):
        x, y, bw, bh, area = stats[label]
        if area < 80:
            continue
        touches_edge = x <= 1 or y <= 1 or x + bw >= w - 1 or y + bh >= h - 1
        if touches_edge and area < 1200:
            continue
        keep[labels == label] = 255

    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, kernel, iterations=1)
    alpha = cv2.GaussianBlur(keep, (0, 0), 0.8)
    alpha[keep == 255] = 255
    return alpha


def to_square_icon(crop_rgb, alpha):
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0 or len(ys) == 0:
        raise RuntimeError("empty foreground mask")

    x0, x1 = max(0, xs.min() - 14), min(alpha.shape[1], xs.max() + 15)
    y0, y1 = max(0, ys.min() - 14), min(alpha.shape[0], ys.max() + 15)

    rgba = np.dstack([crop_rgb, alpha])
    icon = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")

    scale = min(FIT_W / icon.width, FIT_H / icon.height, 1.8)
    target = (max(1, int(icon.width * scale)), max(1, int(icon.height * scale)))
    icon = icon.resize(target, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = (CANVAS - icon.width) // 2
    y = (CANVAS - icon.height) // 2 + 5
    canvas.alpha_composite(icon, (x, y))
    return canvas


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = np.array(Image.open(SRC).convert("RGB"))
    height, width = src.shape[:2]
    icons = []

    for idx, name in enumerate(NAMES):
        row = idx // 5
        col = idx % 5
        x0 = round(col * width / 5)
        x1 = round((col + 1) * width / 5)
        y0 = round(row * height / 2)
        y1 = round((row + 1) * height / 2)
        crop = src[y0:y1, x0:x1]
        alpha = remove_background(crop)
        icon = to_square_icon(crop, alpha)
        compressed = icon.quantize(colors=160, method=Image.Quantize.FASTOCTREE)
        compressed.save(OUT_DIR / f"{idx + 1:02d}-{name}.png", optimize=True)
        icons.append(icon)

    preview_rgb = Image.fromarray(checkerboard(CANVAS * 5, CANVAS * 2), "RGB").convert("RGBA")
    for idx, icon in enumerate(icons):
        x = (idx % 5) * CANVAS
        y = (idx // 5) * CANVAS
        preview_rgb.alpha_composite(icon, (x, y))
    preview_rgb.save(PREVIEW)

    print(f"wrote {len(icons)} icons to {OUT_DIR}")
    print(f"preview {PREVIEW}")


if __name__ == "__main__":
    main()
