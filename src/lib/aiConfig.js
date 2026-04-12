/**
 * Lucid AI 설정 — OpenAI 모델 중앙화
 * - 용도별로 모델을 나눠서 관리하면, 모델 교체 시 이 파일만 수정.
 * - 모델 이름을 파일마다 하드코딩하지 말 것.
 */

export const MODELS = {
  // 🚀 빠른 채팅·분석·비유 생성·퀴즈 생성 (기본 채팅 모델)
  CHAT: 'gpt-4.1-nano',

  // ✅ 정답 검증·소규모 구조화 태스크 (정확도가 더 중요한 곳)
  VERIFY: 'gpt-4.1-nano',

  // 💬 FreeStudy 튜터
  FREESTUDY_TUTOR: 'gemini-2.5-flash-lite',

  // 🎓 심층 튜터 대화 (ChatView 메인) — 가장 비싸지만 교육 퀄리티 필요
  TUTOR: 'gpt-4o',

  // 🤖 Gemini: 문제 생성·코드 분석 (FreeStudy 퀴즈)
  GEMINI_QUIZ: 'gemini-2.5-flash-lite',

  // 🧪 Gemini 튜터 비교 테스트용 (2026-04-12 ListModels 확인)
  GEMINI_TUTOR_FLASH: 'gemini-2.0-flash',          // 1순위 (저렴)
  GEMINI_TUTOR_PRO: 'gemini-2.5-flash',            // 2순위
  GEMINI_TUTOR_3: 'gemini-3.1-flash-lite-preview', // 3순위 (최신)
};

/**
 * 2026-04-12 기준 사용 가능한 Gemini flash 모델 목록
 * (ListModels API로 직접 확인)
 *
 * gemini-2.0-flash
 * gemini-2.0-flash-001
 * gemini-2.0-flash-lite          ← 신규 유저 사용 불가 (단종 중)
 * gemini-2.0-flash-lite-001      ← 신규 유저 사용 불가
 * gemini-2.5-flash
 * gemini-2.5-flash-lite
 * gemini-2.5-flash-image
 * gemini-2.5-flash-preview-tts
 * gemini-3-flash-preview         ← GEMINI_QUIZ 사용 중
 * gemini-3.1-flash-lite-preview
 * gemini-3.1-flash-image-preview
 * gemini-flash-latest
 * gemini-flash-lite-latest
 */

/** OpenAI Chat Completions API 엔드포인트 */
export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/** Gemini API 엔드포인트 (모델명 치환용) */
export const GEMINI_CHAT_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/** 공통 기본값 */
export const DEFAULTS = {
  temperature: 0.7,
};
