# 🧠 Lucid — AI 기반 차세대 교육 플랫폼

> **AI와 게임화로 코딩 학습을 재정의하다**  
> 교육 현장의 학생 맞춤형 학습, 강사 효율화, 관리자 인사이트를 한 플랫폼에서 해결

![Lucid Dashboard](./public/lucid-demo.png)

---

## 📌 프로젝트 개요

**Lucid**는 AI를 활용하여 교육 현장의 **실질적인 문제**를 해결하는 차세대 교육 솔루션입니다.

### 해결하는 핵심 문제점

| 문제 | Lucid의 해결책 |
|------|---------------|
재작성

---

## ✨ 주요 기능

### 🎓 학생 학습 영역

#### 1️⃣ **자유학습 (FreeStudyView)** — 핵심 엔진
- **GitHub 통합**: 강사 코드 자동 불러오기 (기수 필터링)
- **AI 튜터 채팅**: 코드 컨텍스트 기반 질문 응답
- **✨ AI 코드생성** (신규)
  - 코드노트의 코드를 분석 → 비슷한 패턴의 다른 코드 자동 생성
  - 난이도 선택: 쉬움 / 보통 / 어려움
  - 가이던스 팝업으로 사용성 개선
- **AI 키워드 코드생성**: 핵심어만 입력하면 예시 코드 자동 작성
- **AI 문제출제**: 자동 퀴즈 생성 및 풀이 제시
- **코드노트**: 마크다운 기반 필기 (저장, PDF 내보내기 지원)
- **메모장**: 충분히 강력한 마크다운 에디터
- **타이핑 연습**: 한글 → 영문 자동 변환

#### 2️⃣ **문제풀이 (LevelUpView)** — 실력 측정
- 과목별 입장 (Java 기초, Python AI 등)
- 배치고사 (초기 레벨 진단)
- 일반 퀴즈 (XP, LP 획득)
- **하트 시스템**: 듀오링고식 3개 기본, 오답 시 차감 (시각적 임팩트)
- **주간 우수자 랭킹**: 실시간 경쟁 유도
- **스트릭 시스템**: 연속 성공 추적

#### 3️⃣ **용어 사전**
- 더블클릭으로 용어 팝업
- AI 기반 실시간 번역/설명

---

### 👨‍🏫 강사/관리자 영역

#### 1️⃣ **학생관리**
- 신규 학생 정보 일괄 등록
- 기수별/그룹별 학생 조회 및 편집
- 학생 정보 수정/삭제

#### 2️⃣ **학생 현황 대시보드**
- 전체 학생 카드형 리스트
- 실시간 레벨, 스트릭, 활동 상태 표시
- 정렬 (이름순, 레벨순)
- 학생 상세 조회

#### 3️⃣ **자리배치 (AI 추천)**
- 모의 테이블 레이아웃
- AI 자동 배치 최적화 (레벨 분산)
- 수동 조정 가능
- 테이블별 편성 관리

#### 4️⃣ **디버그 패널**
- Firestore 실시간 필드 편집
- 전체 학생 랜덤 테스트 데이터 생성
- 학생별 출석 달력 조회

---

## 🤖 AI 활용 전략

### 사용 모델
- **`gemini-2.5-flash-lite`**: 튜터 채팅, 코드생성, 퀴즈생성 (속도 & 비용 최적)
- **`gemini-2.0-flash`**: 타자 번역 (한→영)

### AI 활용 포인트

| 기능 | AI 역할 | 효과 |
|------|--------|------|
| **코드생성** | 분석형 생성 | 학생의 학습 패턴 이해 후 맞춤 문제 제시 |
| **튜터 채팅** | 컨텍스트 이해 | 코드를 읽고 구체적인 질문 응답 |
| **퀴즈생성** | 자동 출제 | 강사 부담 대폭 감소 |
| **자리배치** | 최적화 | 학습 효율성 고려한 그룹 편성 |
| **타자 번역** | 실시간 변환 | 영문 코드 학습 시 즉시 피드백 |

---

## 🏗️ 기술 스택

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + Custom Animations
- **Editor**: Monaco Editor (코드 열람)
- **Markdown**: React-Markdown + remark/rehype
- **State Management**: React Context API
- **Auth**: Firebase Authentication

### Backend
- **Database**: Firestore (실시간 데이터 동기화)
- **Hosting**: Vercel (배포)
- **AI API**: Google Gemini API

### Development
- **Version Control**: Git + GitHub
- **Package Manager**: npm
- **Build**: Vite

### DevOps
- **Environment**: .env 기반 설정 관리
- **Security**: Service Account 키 .gitignore 처리

---

## 🚀 설치 & 실행

### 1. 저장소 클론
```bash
git clone https://github.com/HYEOKJUNCHOI/Lucid.git
cd Lucid
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 설정
`.env.local` 파일 생성:
```env
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 4. 개발 서버 실행
```bash
npm run dev
```
- Local: `http://localhost:5173`

### 5. 빌드 (배포용)
```bash
npm run build
npm run preview
```

---

## 📂 프로젝트 구조

```
Lucid/
├── public/                  # 정적 자산
├── src/
│   ├── pages/              # 페이지 컴포넌트
│   │   ├── Landing/        # 랜딩 페이지
│   │   ├── Login/          # 로그인 페이지
│   │   ├── Student/        # 학생 영역
│   │   │   ├── StudentPage.jsx     # 대시보드
│   │   │   ├── FreeStudyView.jsx   # 자유학습 (핵심)
│   │   │   ├── LevelUpView.jsx     # 문제풀이
│   │   │   └── ChatView.jsx        # AI 튜터
│   │   └── Admin/          # 관리자 영역
│   │       ├── AdminPage.jsx       # 통합 관리 화면
│   │       ├── StudentManagement.jsx
│   │       ├── StudentDashboard.jsx
│   │       ├── SeatChart.jsx
│   │       └── DebugPanel.jsx
│   ├── components/         # 재사용 컴포넌트
│   │   ├── study/          # 학습 관련
│   │   │   ├── FreeStudyQuiz.jsx
│   │   │   ├── MemoPanel.jsx
│   │   │   ├── TypingPractice.jsx
│   │   │   └── PlacementQuiz.jsx
│   │   ├── memo/           # 메모 기능
│   │   │   └── MemoInventory.jsx
│   │   ├── chat/           # 채팅 기능
│   │   │   └── ChatPanel.jsx
│   │   ├── admin/          # 관리자 UI
│   │   │   └── AttendanceCalendar.jsx
│   │   └── common/         # 공통 컴포넌트
│   │       └── DictionaryPopup.jsx
│   ├── hooks/              # Custom Hooks
│   │   └── useAuth.js      # Firebase 인증
│   ├── services/           # 비즈니스 로직
│   │   ├── learningService.js
│   │   └── userStateService.js
│   ├── lib/                # 설정 & 유틸
│   │   ├── firebase.js
│   │   ├── aiConfig.js     # Gemini 설정
│   │   └── prompts.js      # AI 프롬프트 모음
│   ├── App.jsx
│   └── index.css           # 글로벌 스타일
├── docs/                   # 기획 & 운영 문서
│   ├── CORE_SYSTEM.md
│   ├── 기능최종정리.md
│   ├── Lucid_XP_SYSTEM.md
│   └── ...
├── config/                 # 개발 설정
│   ├── CLAUDE.md           # AI 협업 지침
│   └── ...
├── firestore.rules         # Firestore 보안 규칙
├── .env.example            # 환경 변수 템플릿
├── .gitignore              # Git 제외 파일
├── package.json
└── README.md
```

---

## 🎮 사용 흐름

### 학생 학습 흐름

```
로그인 → 메인 대시보드
  └─ [자유학습] → 코드 학습 → AI 튜터 질문 → AI 코드생성 → 메모 정리
  └─ [문제풀이] → 퀴즈 도전 → 점수 획득 → 레벨업
  └─ [채팅] → AI와 직접 대화
```

### 강사 관리 흐름

```
로그인 (강사) → 관리자 페이지
  └─ [학생관리] → 학생 등록/수정
  └─ [대시보드] → 학생 현황 모니터링
  └─ [자리배치] → AI 추천 배치 활용
  └─ [디버그 패널] → 실시간 데이터 수정
```

---

## 🔐 보안 & 프라이버시

- **Firestore Rules**: 사용자 인증 기반 접근 제어
- **API Key 관리**: 환경 변수로 보안 관리 (.gitignore 처리)
- **Firebase Authentication**: 안전한 로그인
- **Service Account**: git 제외 (절대 커밋 금지)

---

## 📊 데이터 구조 (Firestore)

```
users/{uid}/
  ├── profile/            # 사용자 프로필
  ├── stats/              # 학습 통계 (XP, 레벨, 스트릭)
  ├── meta/
  │   ├── memo            # 메모 저장
  │   └── typing-log      # 타이핑 기록
  └── achievements/       # 업적 (배치 완료, 스트릭 등)

subjects/{subjectId}/
  └── quizzes/{quizId}/   # 과목별 퀴즈

classes/{classId}/
  └── students/{uid}/     # 기수별 학생 정보
```

---

## 📈 주요 성과 & 특징

| 항목 | 설명 |
|------|------|
| **AI 기능 다양성** | 코드생성 3종, 퀴즈생성, 튜터, 배치 최적화 |
| **UX 개선** | 게임화 요소 (XP, 레벨, 하트) → 학습 동기 유도 |
| **강사 효율화** | AI 자동 출제 → 채점 부담 대폭 감소 |
| **데이터 기반 관리** | 실시간 대시보드 + 통계 분석 |
| **확장성** | 모듈화된 컴포넌트 구조 (새 기능 추가 용이) |

---

## 🤝 팀 & 협업

### 개발 규칙
- **Commit 메시지**: `[CC] feat: 설명` 또는 `[AG] fix: 설명`
- **Branch**: `main` / `develop` / `feature/*`
- **Code Review**: 기술 리뷰 + 비판 단계 (완전성 검증)

### AI 협업 방식
- Claude Code가 주요 개발 담당 (80%)
- Gemini API 연동은 별도 담당자 (20%)
- 모든 기획 문서를 git에 포함 (AI와의 협업 기록 투명화)

---

## 📝 문서

| 문서 | 목적 |
|------|------|
| [CORE_SYSTEM.md](./docs/CORE_SYSTEM.md) | 핵심 시스템 설계 |
| [기능최종정리.md](./docs/기능최종정리.md) | 전체 기능 목록 |
| [Lucid_XP_SYSTEM.md](./docs/Lucid_XP_SYSTEM.md) | XP/레벨/스트릭 시스템 |
| [CLAUDE.md](./config/CLAUDE.md) | AI 협업 지침서 |

---

## 🚀 배포

- **평가**: Vercel
- **실시간 DB**: Firestore
- **CI/CD**: GitHub → Vercel 자동 배포

---

## 📞 문의

**공모전 제출**: KIT 바이브코딩 2026  
**GitHub**: [https://github.com/HYEOKJUNCHOI/Lucid](https://github.com/HYEOKJUNCHOI/Lucid)

---

## 📄 라이선스

This project is submitted to the **KIT Vibe Coding Competition 2026**.  
All rights reserved unless otherwise stated.

---

**Made with ❤️ by Lucid Team**  
*AI와 인간의 협업으로 교육을 재정의하다.*
