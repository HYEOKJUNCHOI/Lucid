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
