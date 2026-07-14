"""
AURA · M1 — Composition Grammar Analyzer
아트북(화조도·Bassano) 구도 문법을 코드로: 삼각구도 · 방향성 흐름 · 황금구조 · 초점 위계.

무거운 딥러닝 없이 OpenCV saliency + PCA + connected components로 실제 동작한다.
saliency 모듈이 없으면(cv2.saliency 미설치) 밝기 대비 기반 폴백을 쓴다.
"""
import cv2
import numpy as np

# 황금비/삼분할 교차 좌표(정규화)
GRID_PTS = [1 / 3, 2 / 3, 0.382, 0.618]


def _saliency(bgr, gray):
    """돌출맵(0..1). cv2.saliency가 있으면 spectral residual, 없으면 대비 폴백."""
    try:
        sal = cv2.saliency.StaticSaliencySpectralResidual_create()
        ok, m = sal.computeSaliency(bgr)
        if ok:
            m = m.astype(np.float32)
            return m / (m.max() + 1e-6)
    except Exception:
        pass
    # 폴백: 로컬 대비 + 중앙 가중
    blur = cv2.GaussianBlur(gray, (0, 0), 5)
    contrast = np.abs(gray.astype(np.float32) - blur.astype(np.float32))
    contrast /= (contrast.max() + 1e-6)
    return contrast


def _nearest_grid(v):
    return min(abs(v - p) for p in GRID_PTS)


def _triangle_fit(pts, w, h):
    """세 초점의 삼각형 면적(정규화)으로 삼각구도 강도. 넓게 벌어질수록 강함."""
    if len(pts) < 3:
        return 0.0
    (x1, y1), (x2, y2), (x3, y3) = [(p[0] / w, p[1] / h) for p in pts[:3]]
    area = abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2.0
    return float(min(1.0, area * 4.0))  # 0.25 면적이면 만점


def _flow_pca(sal, w, h):
    """돌출 픽셀 좌표의 주성분(PCA)으로 지배적 방향성 흐름 벡터 산출."""
    ys, xs = np.nonzero(sal > (sal.mean() + sal.std()))
    if len(xs) < 20:
        return {"from": [0.2, 0.8], "to": [0.7, 0.3], "type": "diagonal", "strength": 0.0}
    pts = np.stack([xs / w, ys / h], axis=1).astype(np.float32)
    mean = pts.mean(axis=0)
    cov = np.cov((pts - mean).T)
    evals, evecs = np.linalg.eigh(cov)
    axis = evecs[:, np.argmax(evals)]  # 주축
    spread = float(np.sqrt(evals.max()))
    p0 = mean - axis * spread
    p1 = mean + axis * spread
    dx, dy = abs(axis[0]), abs(axis[1])
    typ = "horizontal" if dx > 2 * dy else "vertical" if dy > 2 * dx else "diagonal"
    return {
        "from": [float(np.clip(p0[0], 0, 1)), float(np.clip(p0[1], 0, 1))],
        "to": [float(np.clip(p1[0], 0, 1)), float(np.clip(p1[1], 0, 1))],
        "type": typ,
        "strength": round(min(1.0, spread * 2.5), 3),
    }


def analyze_composition(bgr):
    """구도 문법 4축을 산출해 dict로 반환."""
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    sal = _saliency(bgr, gray)

    # 초점 무게중심(정규화)
    ys, xs = np.mgrid[0:h, 0:w]
    tot = sal.sum() + 1e-6
    cx = float((xs * sal).sum() / tot / w)
    cy = float((ys * sal).sum() / tot / h)

    # 초점 위계: Otsu 임계 후 상위 3개 연결요소
    u8 = (sal * 255).astype(np.uint8)
    _, th = cv2.threshold(u8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    n, _, stats, cents = cv2.connectedComponentsWithStats(th)
    regions = sorted(
        [(int(stats[i, cv2.CC_STAT_AREA]), cents[i]) for i in range(1, n)],
        key=lambda r: -r[0],
    )[:3]
    focal = [
        {"xy": [float(c[0] / w), float(c[1] / h)], "weight": round(a / (h * w), 3)}
        for a, c in regions
    ]

    # 황금/삼분할 정합(초점이 교차점에 가까울수록 높음)
    golden = max(0.0, min(1.0, 1.0 - (_nearest_grid(cx) + _nearest_grid(cy)) * 2.2))

    triangle_fit = _triangle_fit([c for _, c in regions], w, h)
    flow = _flow_pca(sal, w, h)

    return {
        "focal_centroid": [round(cx, 3), round(cy, 3)],
        "focal": focal,
        "golden_score": round(golden, 3),
        "triangle_fit": round(triangle_fit, 3),
        "flow": [flow],
        "center_locked": bool(abs(cx - 0.5) < 0.08 and abs(cy - 0.5) < 0.08),
    }
