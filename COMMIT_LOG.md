# COMMIT_LOG.md — 확정 작업 기록

> **규칙:** 사용자가 "오케이"나 "긍정"을 나타내고 다음 지시를 내리면 기록. 역순(최신이 맨 위).
> AI는 핸드오프 시 이 파일에 새 항목을 추가한다.

---

## 2026-04-07 (세션 3)

### [CC] refactor: groupIDs 버그 수정 + 사이드바 아코디언 트리 UI
- **커밋 해시:** `6851dc8`
- **지시:** groupIDs 재작성 + 사이드바 VS Code 트리 스타일로 변경
- **내용:**
  - `StudentManagement`: `normalizeToIds` 제거, 등록 유저는 `users/{uid}`만 업데이트 (`invited_students` 동기화 삭제 → 덮어쓰기 버그 원인 제거), `originalGroupIds` 상태로 안전장치 개선
  - `StudentPage`: 3단계 레벨(sidebarLevel) 방식 → `repo === null` 분기로 단순화, 챕터 아코디언 트리뷰 구현 (클릭 시 인라인 파일 목록 + 지연 로딩)
- **수정 파일:**
  - `src/pages/Admin/StudentManagement.jsx`
  - `src/pages/Student/StudentPage.jsx`

### [CC] feat: 3단계 사이드바 네비게이션 + groupIDs 버그 수정 (선행 커밋)
- **커밋 해시:** `dfdf569`
- **지시:** 사이드바 레포→챕터→파일 3단계 구조, ChatView 파일타입 분기, groupIDs stale state 수정
- **내용:**
  - `StudentPage`: 레포 목록 사이드바 이동, GPT 챕터 라벨 분석 + Firebase 커밋해시 캐싱
  - `ChatView`: `concept.type === 'file'` 직접 다운로드 분기 추가
  - `StudentManagement`: `openSingleAssign`에서 Firestore 직접 읽기로 stale state 버그 수정
- **수정 파일:**
  - `src/pages/Student/StudentPage.jsx`
  - `src/pages/Student/ChatView.jsx`
  - `src/pages/Admin/StudentManagement.jsx`

---

## 2026-04-07 (세션 2)

### [CC] fix: 강사 GitHub 유저네임 필드 통일 및 그룹 강사 수정 기능 추가
- **커밋 해시:** `7065dc2`
- **지시:** githubRepo → githubUsername 통일, 그룹 카드에서 강사 수정 가능하도록
- **내용:**
  - `TeacherManagement`: 저장 필드 `githubRepo` → `githubUsername` 통일, 라벨/placeholder를 유저네임 형식으로 변경
  - `GroupManagement`: 그룹 카드 hover 시 연필 아이콘 → 인라인 강사 드롭다운 → 저장 기능 추가 (`updateDoc`)
  - `RepoSelect`: `korit_(\d+)_gov_(.+)` 정규식으로 기수+과목 파싱, 비매칭 레포 자동 제외
- **수정 파일:**
  - `src/pages/Admin/TeacherManagement.jsx`
  - `src/pages/Admin/GroupManagement.jsx`
  - `src/pages/Student/RepoSelect.jsx`

---

## 2026-04-07

### [AG] feat: 학생 그룹 배정 시스템 전면 개편 및 UI 고도화
- **커밋 해시:** `d9943b2`
- **지시:** 그룹 배정 시 데이터 유실 버그(1+1=0) 수정 및 학생 화면 동기화, RepoSelect UI 개선
- **내용:**
  - ❗ `single` 모드에서 체크 해제 시 그룹이 제거되지 않던 핵심 버그 수정 (merge → replace)
  - `groupIDs`에 이름(name)으로 저장된 오염 데이터를 Firebase 문서 ID로 정규화하는 `normalizeToIds()` 헬퍼 추가
  - 이메일 대소문자 불일치(case mismatch)로 인한 유저 중복 인식 문제 수정 (`.toLowerCase()` 전역 적용)
  - 관리자 수정 후 학생 홈 화면에 미반영되던 문제 해결 (`users` + `invited_students` 이중 동기화)
  - 모달 오픈 시 기존 `groupIDs`를 Firebase 문서 ID로 정규화하여 체크박스 초기 상태 보장
  - batch 모드: 병합(Merge), single 모드: 교체(Replace) 정책 명확히 분리
  - 공통 로딩 컴포넌트 `LucidLoader` 생성 → 전 관리자 페이지(`Group/Teacher/Student`) 일괄 적용
  - `LucidSelect` 커스텀 드롭다운 컴포넌트 신규 추가
  - `RepoSelect` 반응형 2단 그리드 도입 및 카드 디자인 슬림화
  - 학생 관리 목록 그룹 뱃지 UI 적용
- **수정 파일:**
  - `src/pages/Admin/StudentManagement.jsx` — 배정 로직 전면 개편 (핵심)
  - `src/pages/Student/RepoSelect.jsx` — 2단 그리드 및 슬림 카드 UI
  - `src/components/common/LucidLoader.jsx` — 신규 공통 로더 컴포넌트
  - `src/components/common/LucidSelect.jsx` — 신규 커스텀 드롭다운
  - `src/pages/Admin/GroupManagement.jsx`, `TeacherManagement.jsx` — LucidLoader 적용
  - `src/hooks/useAuth.js` — 실시간 동기화 보강

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
