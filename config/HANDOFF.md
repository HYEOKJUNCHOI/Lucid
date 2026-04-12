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
- **작성 시각:** 2026-04-10 KST
- **빌드 상태:** 컴파일 에러 없음 (CSS/JSON/JSX 편집만) ✅

---

### 현재 상태 요약
FreeStudyView(자유학습)의 Monaco 에디터 테마를 **One Dark(One EyeCare)** 기준으로 전면 정리. 탭은 **Chrome 스타일 오목 귀(flare)** 포함, 배경색은 CSS 변수 2개(`--free-editor-bg`, `--free-tabbar-bg`)로 그룹화해서 한 곳만 바꾸면 탭/에디터/채팅/Monaco까지 전부 동기화됨.

**다음 최우선 작업: Chrome 탭 귀 크기 14px 시각 확인** — 직전 세션 마지막에 11→14로 키웠는데 혁준님이 눈으로 확인 전에 세션 종료됨. 새 세션 시작 시 "자유학습" 들어가서 탭 하단 플레어가 또렷이 보이는지 체크 필요.

---

### 이번 세션에서 한 일 (2026-04-10)

**1. CSS 변수 그룹화 + Monaco 런타임 주입**
- `src/index.css` `:root`에 `--free-editor-bg`, `--free-tabbar-bg` 추가
- `FreeStudyView.jsx` `handleEditorMount`에서 `getComputedStyle`로 읽어 `nightOwlTheme`에 `defineTheme` 주입
- 효과: CSS 변수 1번 바꾸면 탭바/활성탭/에디터 본문/채팅/오른쪽 버튼 패널/Monaco `editor.background`까지 전부 동기화

**2. Monaco 테마 전면 전환 (Catppuccin 파스텔 → One Dark)**
- `src/themes/nightOwl.json` 룰 전체 재작성
- One EyeCare Theme(by Nazmus Sayad) 기반 Atom One Dark 팔레트
- 팔레트: 주석 `#5c6370` / 문자열 `#98c379` / 숫자·상수 `#d19a66` / 키워드·스토리지 `#c678dd` / 연산자·regex `#56b6c2` / 타입 `#e5c07b` / 함수 `#61afef` / 변수 `#abb2bf`
- 배경 `#282c34` → 런타임에 CSS 변수로 교체됨
- **빨강(`#e06c75`) 사용 금지 원칙** 유지
- 메서드 노랑 `#ffc66d` 보존 규칙 **해제** (파랑 `#61afef`로, 메모리도 갱신)

**3. Java 토크나이저 분리**
- `FreeStudyView.jsx` Monarch provider에 `storageModifiers` 배열 추가
- `public/private/protected/static/final/abstract/...` → `storage.modifier`
- `import/package/class/for/if/...` → `keyword`
- 토크나이저 rules의 두 곳(메서드 패턴 `(?=\s*\()` + 일반 식별자)에 `@storageModifiers` 케이스 먼저 추가
- **현재 두 토큰 모두 `#c678dd` 보라로 매핑** — 유저가 "원복해줘 보라색계열로" 지시. 토크나이저 분리는 남겨둠(나중에 색 바꾸려면 nightOwl.json `storage.modifier` 한 줄만 바꾸면 됨)

**4. Chrome 탭 모양 구현** (`src/index.css` `.free-tab*`)
- `.free-tab-bar`: `padding: 6px 0 0 14px` (왼쪽만 14px, 첫 탭 귀가 `overflow-hidden`에 안 잘리게)
- `.free-tab`: `border-top-left-radius: 13px`, `border-top-right-radius: 13px`, `margin-right: 2px`
- `.free-tab-active::before/::after`, `.free-tab-inactive:hover::before/::after`, `.free-tab-right-panel::before` 모두 14×14px 오목 귀
- 마스크: `radial-gradient(circle at 0 0, transparent 14px, #000 14.5px)` — 위치는 좌우에 따라 `0 0` / `100% 0`
- `.free-tab-right-panel`도 같은 클래스로 활성 탭과 일체형 처리(왼쪽 귀만, 오른쪽은 패널 `overflow-hidden`으로 클리핑)

**5. 배경 밝기 튜닝 (반복 iteration)**
- 시작: `#282c34` (10/10) → 요청 -4단계 → `#181a1f` (6/10) → 요청 7.5로 → `#1e2127` (7.5/10) — 최종값
- 탭바는 별도로 6/10 유지 → `#14161a` — 최종값
- 대비: 활성탭 7.5 vs 탭바 6 → 탭 입체감 확보

**6. 비활성 탭 밝기 튜닝**
- 원래 `rgba(0,0,0,0.35)` + `inset 0 2px 4px rgba(0,0,0,0.5)` → 너무 어둡다
- 4단계(`rgba(255,255,255,0.035)`) → 너무 밝다
- 최종 2.5단계: `background: rgba(0,0,0,0.16); box-shadow: inset 0 1px 3px rgba(0,0,0,0.35)`

**7. 비활성 탭 호버**
- 중복된 `.free-tab-inactive:hover` 2개 규칙을 하나로 병합
- `background: rgba(255,255,255,0.08); color: #e5e7eb; box-shadow: none`
- 좌/우 귀도 `rgba(255,255,255,0.08)`로 동기화

**8. 오른쪽 채팅 패널 색상 정리** (`FreeStudyView.jsx`)
- 패널 테두리 `#313244` → `#2c313a` (Catppuccin 잔재 제거)
- 입력창 상단 구분선 `#313244` → `#2c313a`
- 입력창 배경 `#1e1e1e` → `#14161a` (탭바와 동일)
- 입력창 테두리 `#313244` → `#2c313a`
- 왼쪽 코드 패널 테두리도 동일하게 통일

---

### 아직 안 한 일 / 이어서 해야 할 일

1. **⭐ Chrome 탭 귀 14px 시각 확인 (최우선)**
   - 직전 이터레이션(11→14px)이 혁준님 눈으로 확인되기 전에 세션 종료
   - 자유학습 페이지 들어가서 활성 탭(Main.java, AI 생성 코드) 하단 플레어가 크롬처럼 또렷이 보이는지 체크
   - 만약 여전히 둥글게만 보이면 → 추가 디버깅 필요 (마스크 렌더링 검증, clip-path 대안 고려)

2. **홈페이지 반 카드 플래시 버그**
   - `src/hooks/useAuth.js` line 88에 `console.log('[useAuth] setUserData', ...)` 디버그 로그 **남아있음**
   - `src/pages/Student/StudentPage.jsx:1058` `{!userData ? null : groupIDs.length === 0 ? (...)}` 가드 조건 넣어둠
   - 혁준님이 F12 콘솔에서 로그 확인 후 결과 피드백 기다리는 중
   - 커밋/배포 전에는 console.log 제거해야 함

3. **storage.modifier 색 분리 여부**
   - 지금은 keyword와 동일한 보라 `#c678dd`
   - 토크나이저는 이미 `storageModifiers` 케이스로 분리해둠 → `nightOwl.json`의 `storage.modifier` 한 줄만 바꾸면 색 분리 가능
   - 필요해지면 바꿀 것

---

### 주의사항 / 알려둘 것

- **Monaco 테마는 런타임 주입 구조**: `nightOwl.json`에 하드코딩된 `editor.background` `#282c34`는 `handleEditorMount`에서 CSS 변수로 덮어써짐. JSON 값을 직접 바꿔도 런타임 값이 이긴다.
- **One Dark 팔레트는 고정 기준**: 메모리(`feedback_theme_pastel.md`)에도 기록됨. 새 토큰에 색 넣을 때는 이 팔레트 안에서 역할 매칭부터 시도. 빨강 계열 회피.
- **CSS 변수 바꿀 때**: `src/index.css`의 `:root` 두 줄만 바꾸면 탭/에디터/채팅/Monaco까지 한 번에 반영됨. 개별 하드코딩 값으로 돌아가지 말 것.
- **`FreeStudyView.jsx`는 untracked 상태**: 이 파일은 git에 한 번도 add된 적 없음 — 이번 커밋에서 처음 추가됨.
- **워킹디렉토리에 쌓인 다른 수정 파일들**: Admin 페이지, StudentPage 등 여러 파일에 커밋 안 된 변경이 있음. **이번 커밋은 이번 세션 작업(index.css, nightOwl.json, FreeStudyView.jsx)에만 집중** — 나머지는 별도 세션/커밋에서 처리 필요.

---

### 작성 정보 (이전)
- **작성자:** Antigravity (AG)
- **작성 시각:** 2026-04-07 KST (세션 4)
- **빌드 상태:** 컴파일 에러 없음 (Vite build success) ✅

---

### 현재 상태 요약
`ChatView.jsx` GPT 연동 및 3단계 학습 에이전트(분석-메타포-퀴즈) 구현 완료. Zustand 도입으로 모든 학습 상태(채팅, 선택 기록 등)가 새로고침 시에도 유지됨.
**다음 최우선 작업: `ResultView.jsx` 결과 페이지 고도화 및 레벨 시각화**

---

### 이번 세션에서 한 일

**GPT 에이전트 시스템 (`ChatView.jsx`)**
- OpenAI GPT-1.5-Pro(또는 4o-mini) 연동 완료 (Direct Fetch).
- 3단계 학습 시나리오 자동 연동:
  1. **개념 분석**: 코드에서 핵심 로직 추출.
  2. **메타포 생성**: 게임/생활 비유로 개념 설명.
  3. **레벨 테스트**: 4지선다 퀴즈 생성 및 정답 체크.
- `@tailwindcss/typography` 도입으로 챗봇 응답의 마크다운 서식(코드 블록, 표 등) 고화질 렌더링.

**Zustand 상태관리 전면 도입 (`src/store/useLearningStore.js`)**
- `useLearningStore` 신규 생성.
- `persist` 미들웨어 적용 → `lucid-learning-storage` (localStorage)에 세션 데이터 저장.
- 새로고침 시에도 `repo`, `teacher`, `messages`, `step`, `concept` 등이 그대로 복구됨.

**UI 레이아웃 고도화 (`StudentPage.jsx`)**
- 메인 학습 영역의 `max-width`를 1400px로 확장하여 코드 및 채팅 가독성 확보.
- GitHub API 호출 시 `VITE_GITHUB_TOKEN` 인증 헤더 지원 (Rate Limit 5000req/h 확보 가능).
- 사이드바 아코디언 챕터의 GPT 라벨 질감(Padding, Font weight, Color) 개선.

---

### 아직 안 한 일 / 이어서 해야 할 일

1. **⭐ `ResultView.jsx` UI 고도화 (최우선)**
   - 학습 완료 후 결과를 요약하고 레벨(별/트로피)을 시각화하는 UI 구현 필요.
   - 현재 뼈대만 있는 상태.

2. **파일 정리 (Cleanup)**
   - `ModeSelect.jsx`, `ConceptSelect.jsx`는 이제 사용되지 않으므로 삭제 필요 (상태 점검 후).

3. **퀴즈 결과 피드백**
   - 퀴즈를 풀었을 때 단순히 정답/오답 표시를 넘어, 왜 틀렸는지 GPT에게 물어보는 "오답 노트" 기능 추가 고민.

---

### 주의사항 / 알려둘 것

- **환경변수**: `.env`에 `VITE_OPENAI_API_KEY`와 `VITE_GITHUB_TOKEN`이 설정되어 있어야 원활한 동작이 가능함.
- **상태 초기화**: 학습 도중 리포지토리를 바꾸거나 "뒤로가기"를 누르면 `reset()` 함수가 실행되어 스토어가 초기화됨.
- **GitHub Rate Limit**: 토큰 없이 사용 시 60회/시간 제한이 있으므로 반드시 토큰 설정을 권장.

### 작성 정보
- **작성자:** Claude Code (CC)
- **작성 시각:** 2026-04-07 KST (세션 3)
- **커밋 해시:** `6851dc8`
- **빌드 상태:** 컴파일 에러 없음 ✅

---

### 현재 상태 요약
학생 페이지 사이드바 아코디언 트리 UI 완성. groupIDs 버그(invited_students 동기화 덮어쓰기) 수정.
**다음 최우선 작업: `ChatView.jsx` GPT 연동** (sendMessage 함수가 TODO 플레이스홀더 상태)

---

### 이번 세션에서 한 일

**groupIDs 버그 수정** (`StudentManagement.jsx`)
- `normalizeToIds` 헬퍼 삭제 (groups 상태 의존으로 불안정)
- 등록된 학생 저장 시 `users/{uid}`만 업데이트. `invited_students` 동기화 완전 제거
  - 이유: `invited_students`에 오래된 빈 데이터가 있으면 `useAuth.js`의 else 분기(최초 가입자 처리)가 실행될 때 그걸 읽어서 `users` 문서를 덮어쓰는 구조였음
- `originalGroupIds` 상태 추가 → 모달 열 때 Firestore에서 읽은 원본값으로 안전장치 동작

**사이드바 아코디언 트리** (`StudentPage.jsx`)
- 기존 3단계 레벨(sidebarLevel 1→2→3 페이지 전환) 방식 완전 교체
- `repo === null` : 레포 목록 표시 / `repo !== null` : 아코디언 트리 표시
- 챕터 클릭 → 화살표 회전 + 인라인 파일 목록 (VS Code 파일 탐색기 스타일)
- 파일은 첫 클릭 시에만 GitHub API 호출 → `chapterFilesMap`에 캐시
- GPT 라벨 로딩 스피너 챕터 행 안에 인라인 표시

---

### 아직 안 한 일 / 이어서 해야 할 일

1. **⭐ `ChatView.jsx` GPT 연동 (최우선)**
   - 코드 불러오기 완성됨 (GitHub API, `concept.type === 'file'` 분기)
   - `sendMessage` 함수 내부가 TODO 플레이스홀더 상태 (line 70~82)
   - 구현 방향:
     - Agent 1: 코드 분석 → 핵심 개념 추출 (채팅 시작 시 자동 실행)
     - Agent 2: 게임/생활 메타포 생성 (자동 실행)
     - Agent 3: 레벨 진단 4지선다 5문제 (버튼 트리거)
   - `VITE_OPENAI_API_KEY` `.env`에 존재 확인됨. fetch 직접 호출 방식 사용

2. **ResultView 레벨 시각화**
   - 현재 뼈대만 있음 (`src/pages/Student/ResultView.jsx`)
   - 클래시오브클랜 스타일 별/트로피 UI 구현 필요

3. **ModeSelect.jsx, ConceptSelect.jsx 파일**
   - 학생 페이지 흐름에서 완전히 제거됨 (사이드바로 대체)
   - 파일 자체는 아직 남아 있음 → 삭제해도 무방

---

### 주의사항 / 알려둘 것

- **강사 데이터**: `teachers/{id}` 문서에 `githubUsername` 필드 필수
- **레포 네이밍 규칙**: `korit_{기수}_gov_{과목}` 패턴만 학생 화면에 노출됨
- **groupIDs**: Firestore `groups` 컬렉션의 문서 ID여야 함
- **모드 정책**: `single`=Replace, `batch`=Merge
- **GitHub API rate limit**: 인증 없이 public 레포 사용 중 (60req/h)
- **환경변수**: `.env`에 `VITE_OPENAI_API_KEY` 존재
- **GPT 챕터 라벨 캐시**: Firebase `chapterLabels/{id}` 컬렉션에 `label` + `commitHash` 저장. 커밋 해시 변경 시 자동 갱신
