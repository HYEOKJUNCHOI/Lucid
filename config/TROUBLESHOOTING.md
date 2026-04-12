# TROUBLESHOOTING.md — Lucid 개선 이력

> 문제 발견 → 원인 → 해결 기록. 나중에 "왜 이렇게 됐지?" 할 때 여기서 찾는다.

---

## 📋 포맷
```
### [날짜] 제목
- 문제: 어떤 증상이었나
- 원인: 왜 생겼나
- 해결: 어떻게 고쳤나
- 파일: 어디를 수정했나
```

---

## 2026-04-09

### [퀴즈] 없는 변수로 문제 생성 (n6 사건)
- **문제:** `Print02.java`에는 `n6`가 없는데 빈칸 채우기에서 `int n6 = ___` 문제 출제됨
- **원인:** 퀴즈 프롬프트에 코드 본문을 포함하지 않아서 GPT가 파일명만 보고 상상으로 문제를 만듦
- **해결:** 프롬프트에 코드 전체를 직접 포함 + "코드에 실제로 존재하는 내용만" 강제 규칙 추가. 빈칸 채우기는 "코드에서 한 줄을 그대로 가져와서" 명시
- **파일:** `RoutineView.jsx` — `buildQuizPrompt()`

---

### [퀴즈] "결과 보기" 눌러도 다음으로 안 넘어가는 버그
- **문제:** 마지막 문제 풀고 "결과 보기" 클릭해도 화면이 그대로였음
- **원인:** `quizDone = true` 여도 `curQ`(마지막 문제)가 여전히 존재해서 `curQ ?` 분기가 `quizDone ?` 보다 먼저 실행됨
- **해결:** 렌더링 조건 순서 변경 — `quizDone` 체크를 `curQ` 앞으로 이동
- **파일:** `RoutineView.jsx` — quiz 렌더링 삼항 연산자 순서

---

### [퀴즈] 빈칸 채우기에서 타이핑 시 커서가 도망가는 버그
- **문제:** 빈칸 input에 글자 하나 입력하면 포커스가 사라져서 클릭-타이핑-클릭-타이핑 반복해야 했음
- **원인:** 퀴즈 컨테이너 `div`의 `ref` 콜백이 매 렌더마다 `el.focus()`를 호출해서 input 포커스를 빼앗음
- **해결:** `fill_blank` 타입일 때는 컨테이너에 포커스 주지 않도록 조건 추가 (`curQ.type !== 'fill_blank'`)
- **파일:** `RoutineView.jsx` — quiz container div의 tabIndex, ref 콜백

---

### [채팅] 퀴즈 모드에서 채팅창이 문제를 모름
- **문제:** 잘못된 문제를 채팅으로 항의해도 GPT가 문제 내용을 몰라서 엉뚱한 답변
- **원인:** 채팅 시스템 프롬프트에 현재 퀴즈 문제 컨텍스트가 없었음
- **해결:** `sendChat()`에서 `panelMode === 'quiz'`일 때 현재 문제/정답/해설을 시스템 프롬프트에 포함
- **파일:** `RoutineView.jsx` — `sendChat()` 시스템 프롬프트

---

### [비용] API 비용 90% 절감
- **문제:** ChatView가 `gpt-4o`를 사용해서 30명 기준 월 ~60만원 예상
- **원인:** 비유 품질을 위해 초반에 4o로 설정했으나 학습용 코드 설명에 과스펙
- **해결:**
  - ChatView: `gpt-4o` → `gpt-4o-mini`
  - RoutineView, LevelUpView, DictionaryPopup: `gpt-4o-mini` → `gpt-4.1-nano`
- **효과:** 1인 3시간 기준 670원 → 68원 (-90%), 30명/월 60만원 → 6만원
- **파일:** `ChatView.jsx`, `RoutineView.jsx`, `LevelUpView.jsx`, `DictionaryPopup.jsx`

---

### [UX] 브라우저 기본 alert/confirm/prompt 대체
- **문제:** `window.confirm()` 사용 시 브라우저 기본 다이얼로그(촌스러운 회색 박스) 노출
- **원인:** 빠른 구현을 위해 네이티브 API 사용
- **해결:** 커스텀 모달 컴포넌트로 교체 (rounded-2xl, 다크 테마, 아이콘 포함)
  - 루틴 X 버튼 → 종료 확인 모달
  - 홈 로고 클릭 → 홈 이동 확인 모달
  - LevelUpView 건너뛰기 → 레벨 입력 모달
- **파일:** `RoutineView.jsx`, `StudentPage.jsx`, `LevelUpView.jsx`

---

### [UX] 루틴 중간에 꺼지면 처음부터 다시 시작
- **문제:** 루틴 진행 중 브라우저를 닫으면 다시 1번 코드부터 시작
- **원인:** 진행 상태가 메모리(state)에만 있고 지속 저장 안 됨
- **해결:** `goNextItem()` 시 `lucid_routine_progress` 키로 localStorage에 날짜·인덱스·파일경로 배열 저장. 재진입 시 같은 날/같은 루틴이면 복원
- **파일:** `RoutineView.jsx` — `goNextItem()`, routineItems 구성 useEffect

---

### [퀴즈] 통과 조건이 이탈 유발
- **문제:** 3문제 중 2개 이상 맞춰야 통과, 미달 시 재출제 루프 → 학생 이탈
- **원인:** 루틴의 목적이 "거울 보여주기"인데 진입장벽을 만들어버림
- **해결:** 통과 조건 제거. 하트 3개 시스템으로 교체 — 틀리면 하트 감소, 3문제 다 풀거나 하트 0이면 결과 화면(맞춤/틀림 통계) → 무조건 다음 코드로
- **파일:** `RoutineView.jsx` — `handleAnswer()`, `goNextQuestion()`, 퀴즈 UI

---

## 2026-04-12

### [타자연습] 한글 IME 입력 시 이중 입력 / 타이머 미정지 문제
- **문제:** 타자연습 중 한글 키를 누르면 글자가 2개씩 입력되거나 안 먹히고, 한글 조합 중에도 타이머가 계속 돌아감
- **원인:** IME 조합(compositionstart~compositionend) 구간을 처리하지 않아서 keydown 이벤트와 onChange가 충돌. 타이머는 IME 구간을 모르므로 계속 진행
- **해결:**
  1. `FreeStudyView.jsx` keydownHandlerRef 상단에 `if (e.isComposing || e.keyCode === 229) return` 추가 → 조합 중 단축키 충돌 차단
  2. `TypingPractice.jsx`에 `onCompositionStart` / `onCompositionEnd` 핸들러 추가
     - 조합 시작: `composingStartRef`에 시각 기록
     - 조합 완료: 경과 시간을 `pausedMs`에 누적 → `elapsed` 계산 시 차감
  3. ASCII 자리에서 한글이 조합 완료되면 `setInput`으로 즉시 revert (한글 차단)
- **파일:** `FreeStudyView.jsx`, `TypingPractice.jsx`

---

## 2026-04-12 (FreeStudyQuiz 신규)

### [API] Gemini 모델명 오류 (404)
- **문제:** `gemini-3.1-flash` 호출 시 404 에러
- **원인:** 존재하지 않는 모델명 사용
- **해결:** ListModels API로 실제 사용 가능 목록 확인 → `gemini-3-flash-preview`로 변경
- **파일:** `src/lib/aiConfig.js` — `MODELS.GEMINI_QUIZ`

---

### [퀴즈] 탭 전환 시 문제 state 초기화
- **문제:** quiz 탭 → tutor 탭 → 다시 quiz 탭 오면 idle로 리셋
- **원인:** `{activeRightTab === 'quiz' && <FreeStudyQuiz />}` 조건부 렌더링으로 언마운트됨
- **해결:** `hidden` 클래스로 숨기는 방식으로 변경 → 컴포넌트 유지
- **파일:** `src/pages/Student/FreeStudyView.jsx`

---

### [채팅] AI 선생님한테 물어보기 — 퀴즈 컨텍스트 없음
- **문제:** 결과 화면에서 AI 선생님 버튼 → "네" 입력 시 AI가 맥락 모르고 엉뚱한 답변
- **원인:** `greeting`만 전달하고 system prompt에 퀴즈 결과 없음
- **해결:** `handleSendToTutor`에서 틀린 문제·정답·개념을 `systemPrompt`로 ChatPanel에 주입
- **파일:** `src/pages/Student/FreeStudyView.jsx` — `handleSendToTutor`, `chatSystemPrompt` state

---

### [퀴즈] 문제 텍스트 내 코드 토큰 Ctrl+Click 안 됨
- **문제:** Gemini가 코드 토큰을 따옴표 없이 평문으로 출력해서 파싱 대상 없음
- **원인:** 프롬프트에 토큰 포맷 지시 없었음
- **해결:** 프롬프트에 "홑따옴표로 감싸라" 규칙 추가 + `QuestionText` 컴포넌트로 파싱
- **파일:** `src/components/study/FreeStudyQuiz.jsx`

---

### [채팅] AI 튜터 말투 개선
- **문제:** nano 모델이 "~입니다", 교과서 말투 + 장황한 설명 + "더 궁금하면 알려줘" 반복
- **원인:** system prompt가 너무 단순 ("간결하게 해줘" 한 줄)
- **해결:** 말투·포맷·금지사항·채팅창 환경(13px, 25자 기준) 상세 규칙 추가
- **파일:** `src/lib/prompts.js` — `lucidTutorSystemPrompt`

---

## 앞으로 개선 예정

- [ ] "이 문제 신고하기" 버튼 — 잘못된 문제 스킵 기능
- [ ] 비유 Firebase 캐싱 (Epsilon-Greedy) — 같은 파일 재호출 방지
- [ ] ChatView 비유/채팅 모델 분리 — 비유만 mini, 채팅은 nano
