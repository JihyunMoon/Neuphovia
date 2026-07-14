# AURA Backend — M1 구도 · M2 미적 스코어링

방금의 아트북(화조도·Bassano) **구도 문법(삼각·방향성·황금·초점 위계)**을 코드로 구현한
실행 가능한 백엔드. 무거운 딥러닝 없이 OpenCV로 실제 동작하며, CLIP 연동 훅을 남겨둔다.

## 실행

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## 테스트

```bash
curl -F "image=@../IMG_4637.png" http://localhost:8000/api/analyze | python -m json.tool
```

## 구조

| 파일 | 모듈 | 역할 |
|------|------|------|
| `composition.py` | **M1** | saliency→초점, PCA→방향성 흐름, 연결요소→초점 위계, 황금/삼각 정합 |
| `aesthetic.py` | **M2** | 컬러풀니스·선명도·노출 + 구도 정합 결합 → 0~10 점수·위반·가이드 |
| `app.py` | API | `/api/analyze` → 표준 계약 JSON (프론트가 그대로 매핑) |

## 응답 계약

```json
{
  "composition": {"triangle_fit":0.62,"golden_score":0.71,"flow":[...],"focal":[...],"center_locked":false},
  "aesthetic": {"score":7.4,"nearest_master":"화조도-삼각구도","violations":[...],"guidelines":[...]},
  "aura": {"score":-0.3,"bright":0.28,"warm":-0.1},
  "palette": ["#1a2340", "..."],
  "music_seed": {"root":50,"mode":"minor->major","arc":"happy_ending"}
}
```

## 프론트 연동 (기존 프로토타입에서)

`aura-app.html` / `aura-enhance.html`의 로컬 `analyze()`를 아래로 교체하면
브라우저 휴리스틱 대신 백엔드 M1·M2 결과를 쓴다:

```js
async function analyzeRemote(fileOrBlob){
  const fd = new FormData();
  fd.append('image', fileOrBlob);
  const res = await fetch('http://localhost:8000/api/analyze', {method:'POST', body:fd});
  return res.json(); // → composition/aesthetic/aura/palette/music_seed
}
```

## 다음 (Scale/Expand)
- M1: SAM 세그멘테이션·Depth-Anything로 층위 정밀화
- M2: CLIP-aesthetic 헤드 로드해 `_try_clip()` 활성화, 명작 코퍼스 파인튜닝
- M3 가이드(VLM) · M4 확산 재가공 · M5 재배치 · M6 미적 정체성
