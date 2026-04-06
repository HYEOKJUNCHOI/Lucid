# COMMIT_LOG.md — 확정 작업 기록

> **규칙:** 사용자가 "오케이"나 "긍정"을 나타내고 다음 지시를 내리면 기록. 역순(최신이 맨 위).
> AI는 핸드오프 시 이 파일에 새 항목을 추가한다.

---

## 2026-04-06

### [AG] feat: 로그인 UI 고도화 및 첫 커밋 완료
- **지시:** 로그인 페이지의 미적 완성도를 높이고 깃 푸시를 마칠 것
- **내용:**
  - 화면 전체를 덮는 3x3 격자 기반의 실시간 코드 타이핑 애니메이션 구현
  - 글래스모피즘 기반의 세련된 로그인 카드 디자인 및 오로라 배경 효과 적용
  - Firebase Auth(Google) 연동 및 Firestore 유저 데이터 자동 동기화 로직 구축
  - 로컬 Git 초기화, 리모트 연결(.gitignore 최적화) 및 성공적인 첫 Push 완료
- **수정 파일:**
  - `src/pages/Login/Login.jsx` — 배경 애니메이션 및 UI 레이아웃 전면 개편
  - `src/hooks/useAuth.js` — Firestore 연동 로직 강화
  - `.gitignore` — Vite/Firebase용 패턴 추가
  - `GEMINI.md`, `CLAUDE.md` — 도커 미사용 명시 및 로그 기록 규칙 추가
