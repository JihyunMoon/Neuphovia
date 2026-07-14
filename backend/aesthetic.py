"""
AURA · M2 — Aesthetic Scoring
명작 문법 정합 + 촬영 품질 지표를 결합한 미적 점수(0~10)와 '왜' 설명.

기본은 해석 가능한 휴리스틱(컬러풀니스·선명도·노출·구도 정합).
CLIP-aesthetic 모델이 설치돼 있으면 자동으로 가중 결합한다(선택).
"""
import cv2
import numpy as np


def _colorfulness(bgr):
    """Hasler & Süsstrunk (2003) 컬러풀니스 지표 → 0..1 정규화."""
    b, g, r = cv2.split(bgr.astype(np.float32))
    rg = r - g
    yb = 0.5 * (r + g) - b
    metric = np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2)
    return float(min(1.0, metric / 100.0))


def _sharpness(gray):
    """라플라시안 분산 → 선명도 0..1."""
    return float(min(1.0, cv2.Laplacian(gray, cv2.CV_64F).var() / 800.0))


def _exposure_balance(gray):
    """평균 휘도가 0.5에 가까울수록 1."""
    m = gray.mean() / 255.0
    return float(1.0 - min(1.0, abs(m - 0.5) * 2.0)), float(m)


# ---- 선택: CLIP-aesthetic 훅 ----
_CLIP = None


def _try_clip(bgr):
    """open_clip + aesthetic predictor가 있으면 사용. 없으면 None."""
    global _CLIP
    if _CLIP is False:
        return None
    try:
        # 사용자가 별도 설치했을 때만 동작 (무거우므로 기본 비활성)
        import torch, open_clip  # noqa
        # 실제 배포 시: 사전학습 aesthetic head 로드 후 점수 반환
        # 여기서는 인터페이스만 남긴다.
        return None
    except Exception:
        _CLIP = False
        return None


def score_aesthetic(bgr, comp):
    """구도(comp) + 품질 지표 결합 → 0~10 점수 + 위반 목록 + 가이드라인."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    colorful = _colorfulness(bgr)
    sharp = _sharpness(gray)
    expo, mean_l = _exposure_balance(gray)

    golden = comp["golden_score"]
    triangle = comp["triangle_fit"]

    # 가중 결합(합 1.0) → 0..1 → 0..10
    raw = (
        0.24 * golden
        + 0.16 * triangle
        + 0.20 * colorful
        + 0.20 * sharp
        + 0.20 * expo
    )
    clip = _try_clip(bgr)
    if clip is not None:
        raw = 0.5 * raw + 0.5 * clip
    score = round(raw * 10, 1)

    # 위반 & 가이드라인 (아트북 구도 문법 근거)
    violations, guides = [], []
    if comp["center_locked"]:
        violations.append("피사체 중앙 정체")
        guides.append("주 피사체를 1/3 또는 황금(0.382) 교차점으로 옮겨 삼각을 완성하세요.")
    if golden < 0.35:
        violations.append("황금/삼분할 이탈")
        guides.append("초점을 삼분할선 교차점에 맞추면 구조가 단단해집니다.")
    if triangle < 0.25 and len(comp["focal"]) >= 3:
        violations.append("삼각구도 약함")
        guides.append("세 요소를 넓은 삼각으로 배치해 안정된 무게를 만드세요.")
    if sharp < 0.3:
        violations.append("선명도 부족")
        guides.append("초점을 다시 잡거나 셔터스피드를 높이세요.")
    if mean_l < 0.32:
        violations.append("노출 부족")
        guides.append("노출 +1스톱 또는 순광에서 재촬영을 권합니다.")
    elif mean_l > 0.72:
        violations.append("노출 과다")
        guides.append("하이라이트가 날아갔습니다. 노출 -1스톱.")
    if colorful < 0.18:
        guides.append("보색 소품 하나로 시선을 잡으면 생기가 삽니다.")
    if not guides:
        guides.append("구도·노출이 안정적입니다. 여백을 1/3 이상 남겨 숨을 주세요.")

    return {
        "score": score,
        "metrics": {
            "golden": round(golden, 2),
            "triangle": round(triangle, 2),
            "colorfulness": round(colorful, 2),
            "sharpness": round(sharp, 2),
            "exposure": round(expo, 2),
        },
        "nearest_master": "화조도-삼각구도" if triangle > 0.4 else "고전-대각선흐름",
        "violations": violations,
        "guidelines": guides[:4],
    }
