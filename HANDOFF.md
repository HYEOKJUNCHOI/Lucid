# HANDOFF.md — 핸드오프 프로토콜

> ⚠️ **이 구분선(===) 위의 규칙 영역은 절대 수정 금지.**
> AI는 아래 `인수인계 내용` 영역만 업데이트한다.

---

## 핸드오프 규칙

### 언제 핸드오프를 작성하는가?
- 사용자가 **"핸드오프 해"** 라고 지시하면 즉시 작업을 멈추고 핸드오프를 작성한다.
- AI가 스스로 판단해서 핸드오프를 작성하지 않는다. **반드시 사용자 지시가 있어야 한다.**

### 핸드오프 작성 절차
1. 현재 작업을 **안전한 상태까지 마무리**한다. (컴파일 에러가 없는 상태)
2. `git add → commit → push` 수행한다.
3. 아래 `인수인계 내용` 영역을 업데이트한다.
4. HANDOFF.md도 함께 커밋한다.

### 인수인계 받는 절차
1. `git pull`로 최신 코드를 받는다.
2. 이 파일의 `인수인계 내용`을 읽는다.
3. 언급된 파일들을 직접 열어 코드를 한 번 읽는다.
4. 이해한 내용을 바탕으로 **브랜치를 새로 파서** 작업을 이어간다.

### 작성 원칙
- **간결하게.** 소설 쓰지 말고, 핵심만 적는다.
- **파일 경로는 정확하게.** 수정한 파일 목록은 풀 경로로 적는다.
- **미완료 작업은 솔직하게.** 하다 만 것, 시도했지만 안 된 것을 숨기지 않는다.

---

### ⚠️ 이 선 아래만 수정할 것 ===================================================

---

## 인수인계 내용

### 작성 정보
- **작성자:** Claude Code (CC)
- **작성 시각:** 2026-04-07
- **빌드 상태:** 컴파일 에러 없음 ✅

---

### 현재 상태 요약
로그인 화면 완성 + 전체 뼈대(StudentPage 5단계 흐름 + AdminPage) 구현 완료.
학생 화면 내부 로직(GPT 연동, GitHub API 연동)은 미착수.

---

### 이번 세션에서 한 일

**CLAUDE.md / GEMINI.md 업데이트**
- 섹션 3: 목업·뼈대 파일 생성 전 상의 규칙 추가
- 섹션 7 [기획]: PROJECT.md 먼저 읽기 규칙 추가

**PROJECT.md 업데이트**
- `teachers/{id}` 데이터 모델 변경: `repoUrl` → `githubUsername`
- 레포명 파싱 규칙 명시: `korit_9_gov_java` → `_gov_` 뒤 추출 → 라벨

**뼈대 파일 신규 생성**
- `src/pages/Student/StudentPage.jsx` — step 상태(1~5)로 단계 관리
- `src/pages/Student/TeacherSelect.jsx` — Firestore 강사 목록 + GitHub API 레포 조회
- `src/pages/Student/ModeSelect.jsx` — 챕터/날짜 모드 선택
- `src/pages/Student/ConceptSelect.jsx` — 챕터(폴더) 또는 날짜별 커밋 목록
- `src/pages/Student/ChatView.jsx` — 코드 패널 + GPT 채팅 (PC 2단 / 모바일 탭)
- `src/pages/Student/ResultView.jsx` — 레벨 결과 화면
- `src/pages/Admin/AdminPage.jsx` — 플레이스홀더

**App.jsx 업데이트**
- 플레이스홀더 제거 → 실제 StudentPage / AdminPage 연결
- `logout` prop 전달

**로그인 화면 완성** (`src/pages/Login/Login.jsx`)
- 디자인: VS Code 다크 테마 + 배경 타이핑 애니메이션
- 태그라인: "어려운 코드를, 익숙한 언어로 해석하다"
- 버튼: Google(실제 로그인) / 카카오(개발 중 알림) / GitHub(개발 중 알림)
- 배경: 6개 코드 블록이 랜덤 위치에서 타이핑 애니메이션 (일부 prefilled)

---

### 아직 안 한 일 / 이어서 해야 할 일

**Day 1 남은 작업 (오늘 마감)**
- `ChatView.jsx`: GPT API 실제 연동 (`VITE_OPENAI_API_KEY` .env에 있음)
  - Agent 1: 코드 분석 → 개념 추출
  - Agent 2: 메타포 생성 (게임 + 생활)
  - Agent 3: 레벨 진단
- `TeacherSelect.jsx`: Firestore `teachers` 컬렉션에 테스트 데이터 필요
  - `{ name: "김준일", githubUsername: "code1218" }` 수동 등록 필요
- `ResultView.jsx`: 레벨 시각화 (클래시오브클랜 스타일 별/트로피) 미구현

**Day 2 예정**
- 메타포 좋아요 버튼 → Firebase 저장
- 동기부여 시스템 (나 vs 어제의 나, 함께 공부 중 N명)

---

### 주의사항 / 알려둘 것

- `.env`에 `VITE_OPENAI_API_KEY` 있음 — GPT API 바로 사용 가능
- `.env`에 `VITE_ANTHROPIC_API_KEY`도 있으나 현재 사용 안 함 (GPT 사용 예정)
- GitHub API는 인증 없이 public 레포 사용 (rate limit: 60req/h)
- Firestore `teachers` 컬렉션이 비어있으면 TeacherSelect에서 목록이 안 뜸 → 테스트 전 수동 등록 필요
- git 저장소 미설정 상태 — 인수 후 `git init` 또는 기존 레포 연결 필요
