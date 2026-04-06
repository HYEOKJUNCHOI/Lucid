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
- **작성자:** Antigravity (AG)
- **작성 시각:** 2026-04-07 04:48 KST
- **커밋 해시:** `d9943b2`
- **빌드 상태:** 컴파일 에러 없음 ✅

---

### 현재 상태 요약
학생 그룹 배정 시스템 전면 개편 완료. 관리자 → 학생 화면 실시간 동기화 정상 작동.
`groupIDs` 데이터 정합성 및 UI 일관성 확보. 핵심 기능 안정화 단계.

---

### 이번 세션에서 한 일

**그룹 배정 로직 전면 개편** (`StudentManagement.jsx`)
- `single` 모드: 체크 상태 그대로 저장(Replace). 체크 해제 = 그룹 제거 정상 작동
- `batch` 모드: 기존 그룹 + 새 그룹 병합(Merge). 여러 학생에 과목 일괄 추가용
- `invite` 모드: 신규 등록 시 이미 가입 유저면 기존 그룹 보존하며 병합
- `normalizeToIds()` 헬퍼 추가: `groupIDs`에 이름(name)으로 오염된 데이터 → Firebase 문서 ID로 자동 변환
- 모달 오픈 시(`openSingleAssign`) 기존 `groupIDs`를 ID로 정규화하여 체크박스 초기 상태 정확히 반영
- 이메일 대소문자 불일치 문제 수정: `combinedList` 필터에 `.toLowerCase()` 전역 적용
- 가입 유저 수정 시 `users` + `invited_students` 양쪽 컬렉션 동시 동기화 (이중 저장으로 유실 방지)
- 학생 목록 소속 그룹을 plain text에서 **뱃지(Badge) UI**로 교체

**UI 고도화**
- `LucidLoader` 공통 로딩 컴포넌트 신규 생성 → `GroupManagement`, `TeacherManagement`, `StudentManagement` 전 적용
- `LucidSelect` 커스텀 드롭다운 컴포넌트 신규 생성 (GroupManagement 강사 선택용)
- `RepoSelect` 반응형 2단 그리드 도입 (과목 2개 이상 시 자동 전환)
- 카드 슬림화 및 레포 목록 컴팩트 리스트 전환

---

### 아직 안 한 일 / 이어서 해야 할 일

1. **`groupIDs` 기존 오염 데이터 마이그레이션**
   - Firebase 콘솔에서 현재 `users` 컬렉션의 `groupIDs` 필드를 직접 확인
   - 이름(name)으로 저장된 값이 있다면 Firebase Admin SDK 또는 콘솔에서 수동으로 ID로 교체 필요
   - `normalizeToIds()`가 저장 시 자동 변환하므로, 수정 버튼 한 번 눌러 저장하면 자동 정리됨

2. **학생 대시보드(`StudentPage.jsx`) 내부 기능**
   - GPT / Gemini API 연동 (ChatView, ConceptSelect 등)
   - ResultView 레벨 시각화

3. **`invited_students` → `users` 자동 마이그레이션 로직**
   - 학생이 처음 로그인할 때 `invited_students` 데이터를 `users`로 이관하는 로직은 `useAuth.js`에 구현되어 있음
   - 단, `invited_students` 문서 ID가 소문자 이메일이어야 정상 매칭됨 (현재 보장됨)

---

### 주의사항 / 알려둘 것

- **데이터 구조**: `groupIDs`는 반드시 Firestore `groups` 컬렉션의 **문서 ID(Firebase auto-generated)**여야 함. 이름(name)이 들어가면 `RepoSelect`에서 `doc(db, 'groups', gId)` 조회 실패 → 학생 화면 빈 화면
- **모드 정책**: `single`=Replace, `batch`=Merge. 이 정책은 의도적으로 분리된 것이므로 변경 시 주의
- **이메일 정규화**: 관리자가 입력하는 모든 이메일은 저장 전 `.toLowerCase()` 변환됨. 구글 로그인 이메일도 동일하게 소문자이므로 매칭 보장
- **GitHub API**: 인증 없이 public 레포 사용 중 (rate limit: 60req/h). `teacher.githubUsername` 필드 기반으로 레포 조회
- **환경변수**: `.env`에 `VITE_OPENAI_API_KEY` 존재. Gemini API도 준비 중
