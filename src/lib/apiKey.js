const LS_KEY = 'lucid_openai_api_key';

export const getGeminiApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || '';

/** 현재 사용할 API 키 반환 (개인 키 우선, 없으면 환경변수 폴백) */
export const getApiKey = () => {
  return localStorage.getItem(LS_KEY) || import.meta.env.VITE_OPENAI_API_KEY || '';
};

/** 개인 API 키 저장 */
export const saveApiKey = (key) => {
  if (key) localStorage.setItem(LS_KEY, key.trim());
  else localStorage.removeItem(LS_KEY);
};

/** 개인 API 키 존재 여부 */
export const hasPersonalApiKey = () => {
  const key = localStorage.getItem(LS_KEY);
  return !!key && key.startsWith('sk-');
};
