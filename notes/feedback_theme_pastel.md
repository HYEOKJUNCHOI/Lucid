---
name: 에디터 테마 — One EyeCare / One Dark 선호
description: Monaco 신택스 컬러는 One Dark(One EyeCare) 계열 기준. 눈에 편한 뮤티드 팔레트, 빨강 회피.
type: feedback
originSessionId: 8d8a6b4f-7bdf-4d29-9eee-963ffacfca42
---
Monaco 에디터 신택스 컬러의 **기준 팔레트는 One Dark (VSCode 확장 "One EyeCare Theme" by Nazmus Sayad)**. Atom One Dark 기반의 눈에 편한 뮤티드 톤. 이전 파스텔(Catppuccin Mocha) 방향은 2026-04-10 회의에서 One Dark로 전환됨.

**기준 팔레트 (One Dark):**
- Foreground / 변수: `#abb2bf` (연한 회색)
- 배경: `#282c34`
- 주석: `#5c6370`
- 키워드/storage: `#c678dd` (보라)
- 함수/메서드: `#61afef` (파랑)
- 클래스/타입: `#e5c07b` (노랑)
- 문자열: `#98c379` (초록)
- 숫자/상수: `#d19a66` (오렌지)
- 연산자/regex: `#56b6c2` (시안)
- 태그(HTML): `#e06c75` (빨강) — **사용 금지, 필요 시 foreground 회색으로 대체**

**Why:**
- 혁준님이 장시간 응시해도 눈이 편한 "Eye Care" 지향. "쨍하다"는 피드백이 반복됨.
- 이전 Catppuccin 파스텔도 괜찮았지만 최종적으로 One EyeCare가 기준이 되었음 (사용자가 확장 팔레트 직접 전달).
- **빨간색 회피 원칙**: 신택스 하이라이팅에서 빨간 계열(#e06c75 등)은 쓰지 않는다. 에러 밑줄/인디케이터 같은 의미적 빨강은 예외.

**How to apply:**
- 새 토큰에 색 배정 시 위 One Dark 팔레트 안에서 역할 매칭부터 시도.
- 변수(로컬/필드/파라미터)는 foreground `#abb2bf` — 별도 색 주지 않음 (One Dark 관례).
- 메서드 노랑 `#ffc66d` 보존 규칙은 **2026-04-10 해제됨** — 메서드는 One Dark 파랑 `#61afef`로.
- "어둡게" 지시가 오면 lightness 낮춘 변형을 쓰되 One Dark 팔레트 기조는 유지.
- 배경은 `#282c34` 기본. 탭바/패널 등 보조 영역은 `#21252b` / `#2c313a` 같은 One Dark UI 계열로 층위.
