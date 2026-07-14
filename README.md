# Neuphovia · AURA

**사진의 아우라를 읽고, 빛을 코치하고, 노래로 바꾸는 AI 포토 스튜디오.**

당신의 사진을 분석해 미적 정체성을 배우고 — 찍기 전엔 프로처럼 코치하고,
찍은 뒤엔 프로답게 다듬으며, 마지막엔 그 사진을 노래로 승화한다.
어두운 사진도 웅장한 **해피엔딩**으로 맺는다.

> 자매 프로젝트 **Virtual ME**(파동 정체성·연꽃 연못)와 연결 — 사진은 무의식의 흔적,
> 미적 정체성은 파동 정체성의 한 갈래이며, 이미지→음악 엔진을 공유한다.

## 빠른 시작

```bash
# 프론트 (정적 서빙 권장 — file:// 은 iframe/백엔드 제약)
python3 -m http.server 5500
# → http://localhost:5500  (index.html: 통합 앱 셸)

# 백엔드 (선택 · M1 구도 · M2 미적)
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## 구조

| 파일 | 역할 |
|------|------|
| `index.html` | 통합 앱 셸(탭 UI) |
| `aura-connected.html` | **백엔드 연결** 분석 — M1·M2 구도·미적(오프라인 폴백) |
| `aura-identity.html` | **미적 정체성(M6)** — 취향 벡터·팔레트 시그니처 누적 |
| `aura-app.html` | 색·아우라·구도·음악 통합 분석 |
| `aura-enhance.html` | before/after 재가공(색·톤·조명 그레이딩) |
| `aura-photosong-card.html` | 포토-송 카드(PNG 저장) |
| `aura-photosong-video.html` | 포토-송 영상(webm, 오디오 포함) |
| `aura-concept.html` · `aura-pitch.html` · `aura-ml-backend-spec.html` | 컨셉·피치·ML 스펙 |
| `aura-api.js` | 공유 백엔드 헬퍼(`AuraAPI.analyze`) |
| `backend/` | FastAPI · `composition.py`(M1) · `aesthetic.py`(M2) |

## 기능 (6 = 3 기둥)

- **READ** — F1 구도(삼각·방향성·황금·초점) · F2 아우라 · F3 색 스키마
- **COACH & CRAFT** — F4 명작 학습·찍기 전 가이드 · F5 색·톤·조명 재가공
- **SING** — F6 이미지→파형→음악 + 해피엔딩 아크 · 포토-송 카드/영상

구도 분석 근거: 화조도·Bassano 명작의 구도 문법(삼각구도·방향성 흐름·황금구조·초점 위계).

## 상태

- 브라우저 MVP: **작동**(분석·재가공·음악·카드/영상·정체성)
- 백엔드 M1·M2: **실행 가능**(OpenCV) · M3~M6은 로드맵

## 프라이버시

원본은 기기 우선 처리, 저장·전송은 감정 범주값·키워드 중심. 개인 참조 사진은
`.gitignore`로 저장소에서 제외.

---
🤖 개발 보조: Claude Code
