"""
AURA · Backend API (FastAPI)
POST /api/analyze  (multipart 이미지) → 프론트가 그대로 쓰는 표준 계약 JSON
  · composition (M1)  · aesthetic (M2)  · aura · palette · guidelines · music_seed

실행:
  pip install -r requirements.txt
  uvicorn app:app --reload --port 8000
프론트에서:
  fetch('http://localhost:8000/api/analyze', {method:'POST', body: formData})
"""
import io
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from composition import analyze_composition
from aesthetic import score_aesthetic

app = FastAPI(title="AURA API", version="0.1")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

HUE_NAMES = ["빨강", "주황", "노랑", "연두", "초록", "청록", "파랑", "보라", "자주"]


def _read_bgr(data: bytes, max_dim=900):
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    s = min(1.0, max_dim / max(w, h))
    if s < 1.0:
        img = img.resize((int(w * s), int(h * s)))
    rgb = np.array(img)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), rgb


def _palette(rgb, k=5):
    """k-means로 대표 색 추출 → hex 리스트 + 주조 hue."""
    Z = rgb.reshape(-1, 3).astype(np.float32)
    Z = Z[:: max(1, len(Z) // 4000)]  # 다운샘플
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(Z, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten(), minlength=k)
    order = np.argsort(-counts)
    cols = centers[order].astype(int)
    hexes = ["#%02x%02x%02x" % (c[0], c[1], c[2]) for c in cols]
    hsv = cv2.cvtColor(cols[0:1].astype(np.uint8).reshape(1, 1, 3), cv2.COLOR_RGB2HSV)[0, 0]
    hue = float(hsv[0]) * 2.0  # OpenCV H는 0..180
    return hexes, hue


def _aura(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    bright = float(hsv[:, :, 2].mean() / 255.0)
    sat = float(hsv[:, :, 1].mean() / 255.0)
    warm = float((rgb[:, :, 0].astype(np.float32) - rgb[:, :, 2]).mean() / 255.0)
    aura = max(-1.0, min(1.0, (bright - 0.45) * 1.6 + warm * 0.9 + (sat - 0.3) * 0.6))
    return {"score": round(aura, 3), "bright": round(bright, 3),
            "sat": round(sat, 3), "warm": round(warm, 3)}


@app.get("/")
def root():
    return {"service": "AURA API", "endpoints": ["/api/analyze"]}


@app.post("/api/analyze")
async def analyze(image: UploadFile = File(...)):
    data = await image.read()
    bgr, rgb = _read_bgr(data)

    comp = analyze_composition(bgr)          # M1
    aes = score_aesthetic(bgr, comp)         # M2
    aura = _aura(rgb)
    hexes, hue = _palette(rgb)
    hue_name = HUE_NAMES[int(((hue + 20) % 360) / 40)]

    dark = aura["score"] < -0.1
    music_seed = {
        "root": 48 + int((hue % 360) / 360 * 10),
        "mode": "minor->major" if dark else "major",
        "arc": "happy_ending" if dark else "bright",
        "tempo": round(0.5 - aura["sat"] * 0.18, 3),
        "hue_name": hue_name,
    }

    return {
        "composition": comp,
        "aesthetic": aes,
        "aura": aura,
        "palette": hexes,
        "dominant_hue": hue_name,
        "guidelines": aes["guidelines"],
        "music_seed": music_seed,
    }
