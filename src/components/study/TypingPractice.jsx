import { useState, useEffect, useRef, useMemo } from 'react';
import { getApiKey } from '../../lib/apiKey';
import { MODELS, OPENAI_CHAT_URL } from '../../lib/aiConfig';


/**
 * 타자연습 오버레이 (split 컨테이너 전체 덮음)
 * - code 에서 package/import/상단 빈 줄을 자동 추출해 prefix 로 고정 (Night Owl 신택스 색칠)
 * - 본문을 타이핑 대상으로 지정 · 글자별 pending/correct/wrong/current 상태
 * - 오른쪽 사이드 기록 패널 (한컴타자 스타일) : CPM · 정확도 · 경과 · 오타 + 진행 게이지
 * - 단축키: F4 토글 · F2 다시하기 · Esc 닫기
 * - 완료 시 onComplete(result) 로 부모에게 결과 전달 → Firestore 기록
 */

// Night Owl 팔레트 — 왼쪽 Monaco 에디터(FreeStudyView)가 쓰는 테마와 동일한 색
const NIGHT_OWL = {
  keyword:    '#c678dd', // package / import / static
  type:       '#e5c07b', // 대문자 시작 식별자 (Random, UUID, Main, ...)
  identifier: '#abb2bf', // 소문자 식별자 + 기본 전경
  delimiter:  '#abb2bf', // . ; , *
};

const JAVA_PREFIX_KEYWORDS = new Set(['package', 'import', 'static']);

function tokenizeJavaPrefix(text) {
  const tokens = [];
  const re = /([A-Za-z_]\w*)|([.;,*])|(\s+)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ t: text.slice(last, m.index), color: NIGHT_OWL.identifier });
    }
    if (m[1]) {
      const word = m[1];
      if (JAVA_PREFIX_KEYWORDS.has(word)) {
        tokens.push({ t: word, color: NIGHT_OWL.keyword });
      } else if (/^[A-Z]/.test(word)) {
        tokens.push({ t: word, color: NIGHT_OWL.type });
      } else {
        tokens.push({ t: word, color: NIGHT_OWL.identifier });
      }
    } else if (m[2]) {
      tokens.push({ t: m[2], color: NIGHT_OWL.delimiter });
    } else if (m[3]) {
      tokens.push({ t: m[3], color: null });
    }
    last = re.lastIndex;
  }
  if (last < text.length) {
    tokens.push({ t: text.slice(last), color: NIGHT_OWL.identifier });
  }
  return tokens;
}

const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

/**
 * 테스트/목업 전용 혁준님 1차 기록 스냅샷
 * 프로필·대시보드 카드 UI 만들 때 이 값을 그대로 꽂아서 쓸 것
 * (2026-04-11 첫 완주 · Night Owl · 샘플 Main.java 기준)
 */
export const DEV_SAMPLE_TYPING_RECORD = {
  cpm: 251,
  accuracy: 92,
  seconds: 19.3,
  wrongCount: 7,
  chars: 0, // 미기록
  playedAt: '2026-04-11T00:00:00.000Z',
  label: '혁준님 첫 완주',
};


/** 완주 멘트 풀 — 완료할 때마다 랜덤으로 1개 뽑힘 */
const FINISH_MESSAGES = [
  '완료!',
  '타닥타닥 멈췄다',
  '손목, 무사 귀환',
  '한 챕터 클리어',
  '코딩 근육 +1',
  '키보드가 웃고 있다',
  '깔끔한 완주',
  '자판 정복',
  '고요한 승리',
  '엔터로 마무리',
  '한 판 더?',
  '타격감 실화?',
];

/** 최고기록 갱신 멘트 — 이건 또 따로 */
const NEW_RECORD_MESSAGES = [
  '벽을 넘었다',
  '너 자신을 이겼다',
  '새 왕좌',
  '기록장이 바빠진다',
];


/** 타수별 계급 컬러 — 원 + 숫자 + 타 단위 전부 여기서 결정
 *  <100: 그레이 / 100대: 초록 / 200대: 파랑 / 300대: 주황 / 400대: 보라
 *  500대: 핑크 / 600대: 네온화이트 / 700+: 레드 */
const getTierIndex = (cpm) =>
  cpm >= 700 ? 7 : cpm >= 600 ? 6 : cpm >= 500 ? 5 : cpm >= 400 ? 4 :
  cpm >= 300 ? 3 : cpm >= 200 ? 2 : cpm >= 100 ? 1 : 0;

const getTypingTier = (cpm) => {
  if (cpm >= 700) return {
    label: '초월', rgb: '220,38,38',
    numberClass: 'text-white', unitClass: 'text-red-300',
    labelClass: 'text-red-400/80',
    boxShadow: '0 0 0 2px rgba(255,80,80,0.95), 0 0 0 8px rgba(220,38,38,0.35), 0 0 25px rgba(220,38,38,0.8), 0 0 55px rgba(200,0,0,0.55), 0 0 90px rgba(180,0,0,0.35), 0 0 130px rgba(160,0,0,0.15), 0 0 180px rgba(140,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.12)',
    background: 'radial-gradient(circle at 50% 40%, rgba(255,80,80,0.3) 0%, rgba(220,38,38,0.12) 50%, rgba(180,0,0,0.04) 75%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 5px rgba(255,150,150,0.7)) drop-shadow(0 0 18px rgba(220,38,38,0.6)) drop-shadow(0 0 30px rgba(200,0,0,0.3))' },
    heartbeatClass: 'animate-ring-breathe-3', heartbeatDuration: '1.8s', // 전설
  };
  if (cpm >= 600) return {
    label: '유물', rgb: '217,70,239',
    numberClass: 'text-white', unitClass: 'text-fuchsia-300',
    labelClass: 'text-fuchsia-400/80',
    boxShadow: '0 0 0 2px rgba(217,70,239,0.95), 0 0 0 8px rgba(217,70,239,0.35), 0 0 28px rgba(217,70,239,0.80), 0 0 60px rgba(217,70,239,0.50), 0 0 100px rgba(192,38,211,0.30), 0 0 150px rgba(192,38,211,0.14), inset 0 1px 0 rgba(255,255,255,0.18)',
    background: 'radial-gradient(circle at 50% 40%, rgba(240,171,252,0.22) 0%, rgba(217,70,239,0.1) 50%, rgba(192,38,211,0.04) 75%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 5px rgba(240,171,252,0.7)) drop-shadow(0 0 16px rgba(217,70,239,0.55)) drop-shadow(0 0 28px rgba(192,38,211,0.28))' },
    heartbeatClass: 'animate-ring-breathe-3', heartbeatDuration: '2.4s', // 프로
  };
  if (cpm >= 500) return {
    label: '신화', rgb: '220,230,255',
    numberClass: 'text-white', unitClass: 'text-blue-200',
    labelClass: 'text-slate-300/80',
    boxShadow: '0 0 0 2px rgba(255,255,255,0.92), 0 0 0 7px rgba(220,235,255,0.22), 0 0 22px rgba(210,225,255,0.6), 0 0 50px rgba(180,210,255,0.32), 0 0 85px rgba(150,185,255,0.18), 0 0 120px rgba(120,160,255,0.09), inset 0 1px 0 rgba(255,255,255,0.3)',
    background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.22) 0%, rgba(210,225,255,0.1) 50%, rgba(170,200,255,0.04) 75%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4)) drop-shadow(0 0 10px rgba(180,210,255,0.25))' },
    heartbeatClass: 'animate-ring-breathe-3', heartbeatDuration: '3.0s', // 고수
  };
  if (cpm >= 400) return { // 상위권 — 보라 (핑크의 55%)
    label: '전설', rgb: '167,139,250',
    numberClass: 'text-violet-100', unitClass: 'text-violet-300',
    labelClass: 'text-violet-300/80',
    boxShadow: '0 0 0 2px rgba(167,139,250,0.52), 0 0 0 6px rgba(167,139,250,0.15), 0 0 18px rgba(167,139,250,0.41), 0 0 40px rgba(167,139,250,0.22), 0 0 65px rgba(139,92,246,0.13), inset 0 1px 0 rgba(255,255,255,0.08)',
    background: 'radial-gradient(circle at 50% 35%, rgba(167,139,250,0.14) 0%, rgba(139,92,246,0.04) 60%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.35))' },
    heartbeatClass: 'animate-ring-breathe', heartbeatDuration: '2.2s', // 상위권
  };
  if (cpm >= 300) return { // 실력자 — 주황 (핑크의 38%)
    label: '영웅', rgb: '251,146,60',
    numberClass: 'text-orange-100', unitClass: 'text-orange-300',
    labelClass: 'text-orange-300/80',
    boxShadow: '0 0 0 2px rgba(251,146,60,0.43), 0 0 0 6px rgba(251,146,60,0.13), 0 0 18px rgba(251,146,60,0.34), 0 0 38px rgba(251,146,60,0.18), 0 0 65px rgba(234,88,12,0.11), inset 0 1px 0 rgba(255,255,255,0.08)',
    background: 'radial-gradient(circle at 50% 35%, rgba(251,146,60,0.14) 0%, rgba(234,88,12,0.04) 60%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 4px rgba(251,146,60,0.35))' },
    heartbeatClass: 'animate-ring-breathe', heartbeatDuration: '2.8s', // 실력자
  };
  if (cpm >= 200) return { // 클럽원 — 파랑 (핑크의 24%)
    label: '희귀', rgb: '96,165,250',
    numberClass: 'text-blue-100', unitClass: 'text-blue-300',
    labelClass: 'text-blue-300/80',
    boxShadow: '0 0 0 1.5px rgba(96,165,250,0.27), 0 0 0 5px rgba(96,165,250,0.08), 0 0 14px rgba(96,165,250,0.21), 0 0 30px rgba(96,165,250,0.11), inset 0 1px 0 rgba(255,255,255,0.06)',
    background: 'radial-gradient(circle at 50% 35%, rgba(96,165,250,0.1) 0%, rgba(59,130,246,0.03) 60%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 3px rgba(96,165,250,0.28))' },
    heartbeatClass: 'animate-ring-breathe', heartbeatDuration: '3.5s', // 클럽원
  };
  if (cpm >= 100) return { // 입문자 — 초록 (핑크의 13%)
    label: '고급', rgb: '78,201,176',
    numberClass: 'text-emerald-100', unitClass: 'text-emerald-300',
    labelClass: 'text-emerald-300/80',
    boxShadow: '0 0 0 1.5px rgba(78,201,176,0.19), 0 0 0 4px rgba(78,201,176,0.06), 0 0 12px rgba(78,201,176,0.15), 0 0 24px rgba(78,201,176,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
    background: 'radial-gradient(circle at 50% 35%, rgba(78,201,176,0.09) 0%, transparent 60%)',
    numberStyle: { filter: 'drop-shadow(0 0 3px rgba(78,201,176,0.22))' },
    heartbeatClass: 'animate-ring-breathe-1', heartbeatDuration: '2.5s', // 입문자
  };
  return { // 완주 — 그레이
    label: '일반', rgb: '148,163,184',
    numberClass: 'text-slate-200', unitClass: 'text-slate-400',
    labelClass: 'text-slate-400/80',
    boxShadow: '0 0 0 1.5px rgba(148,163,184,0.38), 0 0 0 4px rgba(148,163,184,0.10), 0 0 16px rgba(148,163,184,0.28), 0 0 32px rgba(148,163,184,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
    background: 'radial-gradient(circle at 50% 35%, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.05) 60%, transparent 100%)',
    numberStyle: { filter: 'drop-shadow(0 0 4px rgba(148,163,184,0.45))' },
    heartbeatClass: 'animate-ring-breathe-1', heartbeatDuration: '3.0s', // 완주
  };
};


// 번역 캐시 — 페이지 새로고침 전까지 유지 (같은 코드 재번역 방지)
const translationCache = new Map();

export default function TypingPractice({ code, onClose, onComplete, onResetBest, onRestart, isNewRecord = false, previousBest = null }) {

  // ── 한글 → 영문 번역 (gpt-4.1-nano) ──────────────────────────────────────
  const [resolvedCode, setResolvedCode] = useState(code);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  useEffect(() => {
    const KOREAN_RE = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]+/g;
    const matches = [...new Set((code || '').match(KOREAN_RE) || [])];
    if (matches.length === 0) { setResolvedCode(code); return; }

    // 캐시 히트 — 같은 코드 재번역 방지 (F4 닫기 후 재진입 시 토큰 절약)
    if (translationCache.has(code)) {
      setResolvedCode(translationCache.get(code));
      return;
    }

    setIsTranslating(true);
    const prompt =
      `다음 한국어 단어/문장 목록을 코드에 쓰기 적합한 짧은 영어로 번역해줘.\n` +
      `JSON 형식으로만 답해: {"원문": "번역"}\n\n` +
      matches.map(m => `"${m}"`).join(', ');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELS.CHAT, messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 200 }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        const raw = data.choices?.[0]?.message?.content?.trim() || '{}';
        const map = JSON.parse(raw.replace(/```json|```/g, '').trim());
        let result = code;
        for (const [ko, en] of Object.entries(map)) result = result.replaceAll(ko, en);
        translationCache.set(code, result); // 캐시 저장
        setResolvedCode(result);
      })
      .catch(() => setTranslateError(true))
      .finally(() => { clearTimeout(timeoutId); setIsTranslating(false); });
  }, [code]);

  // 코드 파싱: package / import / 상단 빈 줄을 prefix, 나머지를 target
  const { prefix, target } = useMemo(() => {
    const lines = (resolvedCode || '').replace(/\r\n/g, '\n').split('\n');
    const prefixLines = [];
    let i = 0;
    for (; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.startsWith('package') ||
        trimmed.startsWith('import') ||
        trimmed === ''
      ) {
        prefixLines.push(lines[i]);
      } else {
        break;
      }
    }
    const rawTarget = lines.slice(i).join('\n');
    return { prefix: prefixLines.join('\n'), target: rawTarget };
  }, [resolvedCode]);


  // 진입 화면 — 키 확인 후 Enter 2번 → 시작
  const [ready, setReady] = useState(false);
  const enterCountRef = useRef(0);
  const [enterCount, setEnterCount] = useState(0); // UI 업데이트용
  // 'idle' | 'ok' | 'ko' — 키 확인 인풋 결과
  const [keyCheck, setKeyCheck] = useState('idle');
  const keyCheckInputRef = useRef(null);

  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [wrongCount, setWrongCount] = useState(0);
const [capsLockSuspect, setCapsLockSuspect] = useState(false);
  const capsLockSuspectRef = useRef(false); // ESC 핸들러에서 최신값 참조용
  const consecWrongRef = useRef(0); // 연속 오타 카운트
  const [finishMessage, setFinishMessage] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRef = useRef(null);
  const completedRef = useRef(false);
  const enterStreakRef = useRef({ count: 0, lastTime: 0 }); // 3연타 추적

  const isDone = endTime !== null;

  // 완료 시점에 멘트 뽑기
  // - 일반 완료: 바로 FINISH_MESSAGES 풀에서 1개
  // - 나중에 isNewRecord 가 true 로 올라오면 (Firestore 응답 후) NEW_RECORD_MESSAGES 로 한 번 더 교체
  //   → 그래서 꽃가루와 멘트가 같이 업그레이드되는 연출
  const recordUpgradedRef = useRef(false);
  useEffect(() => {
    if (!isDone) return;
    if (!finishMessage) {
      // 최초 뽑기
      const pool = isNewRecord ? NEW_RECORD_MESSAGES : FINISH_MESSAGES;
      setFinishMessage(pool[Math.floor(Math.random() * pool.length)]);
      if (isNewRecord) recordUpgradedRef.current = true;
    } else if (isNewRecord && !recordUpgradedRef.current) {
      // 완료 후 isNewRecord 가 뒤늦게 true 로 오면 NEW_RECORD 풀로 교체
      recordUpgradedRef.current = true;
      setFinishMessage(
        NEW_RECORD_MESSAGES[Math.floor(Math.random() * NEW_RECORD_MESSAGES.length)]
      );
    }
  }, [isDone, isNewRecord, finishMessage]);

  // 실시간 tick — 진행 중에만 250ms 마다 now 업데이트
  useEffect(() => {
    if (startTime === null || endTime !== null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startTime, endTime]);

  // 실시간 통계 — 시작 전 / 진행 중 / 완료 후 모두 동일한 식으로 계산
  const stats = useMemo(() => {
    if (startTime === null) {
      return { cpm: 0, accuracy: 100, seconds: 0 };
    }
    const endMs = endTime ?? now;
    const elapsed = Math.max(0, (endMs - startTime) / 1000);
    const cpm = elapsed > 0 ? Math.round((input.length / elapsed) * 60) : 0;
    const totalTyped = input.length + wrongCount;
    const accuracy = totalTyped > 0
      ? Math.max(0, Math.round((input.length / totalTyped) * 100))
      : 100;
    return { cpm, accuracy, seconds: elapsed };
  }, [startTime, endTime, now, input.length, wrongCount]);

  const progress = target.length > 0 ? input.length / target.length : 0;
  const typingTier = getTypingTier(stats.cpm);

  // 완료 시 부모에게 결과 전달 (한 번만)
  useEffect(() => {
    if (isDone && !completedRef.current) {
      completedRef.current = true;
      onComplete?.({
        cpm: stats.cpm,
        accuracy: stats.accuracy,
        seconds: stats.seconds,
        chars: target.length,
        wrongCount,
      });
    }
  }, [isDone, stats.cpm, stats.accuracy, stats.seconds, target.length, wrongCount, onComplete]);

  // 다시하기
  const restart = () => {
    onRestart?.(); // 부모의 isNewRecord/previousBest 상태 초기화
    setInput('');
    setStartTime(null);
    setEndTime(null);
    setNow(Date.now());
    setWrongCount(0);
setCapsLockSuspect(false); capsLockSuspectRef.current = false;
    consecWrongRef.current = 0;
    setFinishMessage('');
    completedRef.current = false;
    recordUpgradedRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (ready) inputRef.current?.focus();
  }, [ready]);

  // 진입 화면 키 핸들러 — Enter 2번 → 타자 시작, Esc → 닫기
  useEffect(() => {
    if (ready) return;
    const onKey = (e) => {
      if (e.code === 'Escape') { e.preventDefault(); onClose?.(); return; }
      if (isTranslating) return;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (keyCheck !== 'ok') return; // 영문 확인 전엔 시작 불가
        enterCountRef.current += 1;
        setEnterCount(enterCountRef.current);
        if (enterCountRef.current >= 2) {
          enterCountRef.current = 0;
          setEnterCount(0);
          setReady(true);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ready, isTranslating, keyCheck, onClose]);


  // F2 다시하기 / Esc 닫기 / 결과화면에서 Enter → 다시하기 (전역 가로채기)
  useEffect(() => {
    const onKey = (e) => {
      // 결과 오버레이가 떠 있는 동안 에디터 단축키 전부 차단
      if (isDone) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (e.code === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        restart();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (capsLockSuspectRef.current) {
          setCapsLockSuspect(false); capsLockSuspectRef.current = false;
          consecWrongRef.current = 0;
          return;
        }
        onClose?.();
      } else if (isDone && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        const s = enterStreakRef.current;
        if (now - s.lastTime > 800) s.count = 0; // 간격 초과 시 리셋
        s.count += 1;
        s.lastTime = now;
        if (s.count >= 3) {
          s.count = 0;
          restart();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, isDone]);

  // Caps Lock 해제 감지 — 키 누를 때마다 상태 확인, 꺼져 있으면 경고 즉시 제거
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'CapsLock' || !e.getModifierState('CapsLock')) {
        setCapsLockSuspect(false); capsLockSuspectRef.current = false;
        consecWrongRef.current = 0;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // 입력 처리
  const handleInput = (e) => {
    if (!ready) return; // 진입화면 중 입력 차단
    const val = e.target.value;
    if (startTime === null && val.length > 0) {
      setStartTime(Date.now());
    }
    if (val.length > input.length) {
      const newChar = val[val.length - 1];
      const targetChar = target[val.length - 1];
      if (newChar !== targetChar) {
        setWrongCount((c) => c + 1);
        // 소문자 알파벳 오타만 카운트 (대문자·공백·특수문자 제외)
        if (/[a-z]/.test(targetChar)) {
          consecWrongRef.current += 1;
          if (consecWrongRef.current >= 10) { setCapsLockSuspect(true); capsLockSuspectRef.current = true; }
        }
      } else {
        // 소문자 알파벳이 맞을 때만 리셋
        if (/[a-z]/.test(newChar)) {
          consecWrongRef.current = 0;
          setCapsLockSuspect(false); capsLockSuspectRef.current = false;
        }
      }
    }
    setInput(val);
    if (target.length > 0 && val.length >= target.length) {
      setEndTime(Date.now());
    }
  };

  // Tab 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const { selectionStart, selectionEnd, value } = el;
      const next =
        value.slice(0, selectionStart) + '    ' + value.slice(selectionEnd);
      if (startTime === null) setStartTime(Date.now());
      let addedWrong = 0;
      for (let i = 0; i < 4; i++) {
        if (target[selectionStart + i] !== ' ') addedWrong += 1;
      }
      if (addedWrong > 0) setWrongCount((c) => c + addedWrong);
      setInput(next);
      if (next === target && target.length > 0) setEndTime(Date.now());
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#0d1117]/95 backdrop-blur-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">⌨️</span>
          <span className="text-white font-bold text-sm">타자연습</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={restart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 text-amber-200 text-[11px] font-bold hover:bg-amber-500/20 transition-all"
            title="F2"
          >
            <span>↻</span>
            <span>다시하기</span>
            <span className="text-[9px] font-black opacity-70 bg-amber-400/20 px-1 py-0.5 rounded">
              F2
            </span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-gray-300 text-[11px] font-bold hover:bg-white/10 hover:text-white transition-all"
            title="Esc"
          >
            <span>×</span>
            <span>닫기</span>
            <span className="text-[9px] font-black opacity-70 bg-white/10 px-1 py-0.5 rounded">
              Esc
            </span>
          </button>
        </div>
      </div>

      {/* Caps Lock 경고 — 레이아웃 밀림 없이 절대 오버레이 */}
      {/* 본문 flex-row — 좌측 타이핑 + 우측 사이드 기록 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 타이핑 메인 영역 */}
        <div
          className="relative flex-1 min-w-0 overflow-auto px-6 py-5 font-mono text-[13px] leading-[1.65] cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {/* 코드창 중앙 — Caps Lock 경고 + F2 힌트 묶음 */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-end gap-1.5 transition-opacity duration-300 ${capsLockSuspect ? 'opacity-100' : 'opacity-0'}`}>
            {/* Caps Lock 경고 */}
            <div>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[13px] font-bold shadow-lg shadow-amber-900/30 backdrop-blur-sm whitespace-nowrap">
                <span className="text-base">⇪</span>
                <span>Caps Lock 켜져 있어요 — 확인해주세요!!</span>
              </div>
            </div>
            {/* F2 힌트 */}
            <div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-gray-300 text-[11px] font-bold whitespace-nowrap backdrop-blur-sm shadow-[0_0_12px_rgba(255,255,255,0.08)]">
                <span>↻</span>
                <span>다시하기</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px]">F2</span>
              </div>
            </div>
          </div>

          {/* prefix (비활성, Night Owl 신택스 색칠) */}
          {prefix && (
            <pre className="whitespace-pre-wrap mb-3 select-none border-l-2 border-gray-700/50 pl-3">
              {tokenizeJavaPrefix(prefix).map((tok, i) => (
                <span key={i} style={tok.color ? { color: tok.color } : undefined}>
                  {tok.t}
                </span>
              ))}
            </pre>
          )}

          {/* 본문 (타이핑 대상) */}
          <pre className="whitespace-pre-wrap text-gray-500">
            {target.split('').map((ch, i) => {
              const iLen = input.length;
              const isCursor = iLen === i;
              let cls;
              if (i < iLen) {
                cls = input[i] === ch ? 'text-emerald-400' : 'text-red-300 bg-red-500/25 rounded-sm';
              } else if (isCursor) {
                cls = 'text-white bg-amber-400/40 rounded-sm';
              } else {
                cls = 'text-gray-600';
              }
              if (ch === '\n') {
                return (
                  <span key={i} className={cls}>
                    {isCursor ? '↵\n' : '\n'}
                  </span>
                );
              }
              return (
                <span key={i} className={`relative ${cls}`}>
                  {isCursor && (
                    <span className="absolute -left-[1px] top-0 bottom-0 w-[2px] bg-amber-400 animate-pulse rounded-full" />
                  )}
                  {ch}
                </span>
              );
            })}
          </pre>
        </div>

        {/* 우측 사이드 기록 패널 (한컴타자 느낌) */}
        <aside className="w-[240px] shrink-0 border-l border-white/10 bg-[#0a0f14] px-5 py-6 flex flex-col gap-6 overflow-y-auto">
          {/* BEST — 이전 최고기록 (REAL-TIME 과 대조되는 골드/앰버 톤) */}
          <div className="-mx-5 -mt-6 px-5 pt-6 pb-5 bg-gradient-to-b from-amber-500/[0.08] to-transparent border-b border-amber-400/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px]">🏆</span>
                <span className="text-[11px] font-black tracking-[0.15em] text-amber-300/80">
                  최고기록
                </span>
              </div>
              {onResetBest && previousBest && (previousBest.bestCpm > 0 || previousBest.bestAccuracy > 0) && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="text-gray-600 hover:text-rose-300 text-[9px] font-bold tracking-wider transition-colors"
                  title="최고기록 초기화"
                >
                  기록초기화
                </button>
              )}
            </div>
            {previousBest && (previousBest.bestCpm > 0 || previousBest.bestAccuracy > 0) ? (
              <div className="flex items-end gap-4">
                <div>
                  <div className="flex items-baseline gap-1 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                    <span className="text-amber-200 text-[44px] font-black leading-none tracking-tight tabular-nums">
                      {previousBest.bestCpm || 0}
                    </span>
                    <span className="text-[#bc9e3d] text-base font-bold">타</span>
                  </div>
                </div>
                <div>
                  <div className="text-fuchsia-300 text-xl font-black leading-none tracking-tight tabular-nums">
                    {Math.max(0, 100 - (previousBest.bestAccuracy || 0))}%
                  </div>
                  <div className="text-fuchsia-300/50 text-[10px] font-bold tracking-[0.1em] mt-1">
                    오타율
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="text-amber-300/80 text-[12px] font-black tracking-tight">
                  아직 기록이 없어요 🔥
                </div>
                <div className="text-gray-400 text-[10px] font-semibold leading-snug">
                  <span className="text-rose-300 font-black">최고기록</span>을 <span className="text-rose-300 font-black">갱신</span>하시면<br/>
                  <span className="text-rose-300 font-black">프로필</span>에 <span className="text-rose-300 font-black">배찌</span>를 달아드립니다!!
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.15em] text-gray-400">
              실시간
            </span>
          </div>

          {/* 타수 (대표 지표 — 가장 큰 숫자) */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-emerald-300 text-[60px] font-black leading-none tracking-tight tabular-nums">
                {stats.cpm}
              </span>
              <span className="text-emerald-300/70 text-xl font-bold">타</span>
            </div>
          </div>

          {/* 오타율 */}
          <div>
            <div className="text-fuchsia-300 text-3xl font-black leading-none tracking-tight tabular-nums">
              {Math.max(0, 100 - stats.accuracy)}%
            </div>
            <div className="text-gray-400 text-[10px] font-bold tracking-[0.1em] mt-1.5">
              오타율
            </div>
          </div>

          {/* 경과 시간 */}
          <div>
            <div className="text-amber-200 text-3xl font-black leading-none tracking-tight tabular-nums">
              {formatClock(stats.seconds)}
            </div>
            <div className="text-gray-400 text-[10px] font-bold tracking-[0.1em] mt-1.5">
              경과 시간
            </div>
          </div>

          {/* 오타 개수 */}
          <div>
            <div className="text-rose-300 text-3xl font-black leading-none tracking-tight tabular-nums">
              {wrongCount}
            </div>
            <div className="text-gray-400 text-[10px] font-bold tracking-[0.1em] mt-1.5">
              오타 개수
            </div>
          </div>

          {/* 진행 게이지 */}
          <div className="mt-auto">
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-gray-400 text-[10px] font-bold tracking-[0.1em]">
                진행률
              </span>
              <span className="text-gray-300 text-[11px] font-black tabular-nums">
                {input.length} / {target.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-200 ease-out"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* 숨김 입력 필드 */}
      <textarea
        ref={inputRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onBlur={() => {
          if (!ready) return; // 진입화면 중엔 포커스 빼앗지 않음
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      {/* 진입 화면 — 코드 블러 배경 + 중앙 카드 */}
      {!ready && (
        <div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 backdrop-blur-xl"
          style={{ background: 'rgba(13,17,23,0.95)' }}
        >
          {/* 뒤로가기 — 우상단 고정 */}
          <button
            onClick={onClose}
            className="absolute top-6 right-8 flex items-center gap-2 text-gray-400 hover:text-white text-[18px] font-bold transition-colors"
            title="Esc"
          >
            ↩ 뒤로
          </button>

          <div className="flex flex-col gap-5 px-10 pt-8 pb-5 rounded-2xl border border-white/10 bg-[#0d1117]/80 shadow-2xl w-[400px]">
            {translateError ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex items-center gap-2 text-red-400 text-[13px] font-bold">
                  <span>⚠️</span>
                  <span>번역 실패 — 시작할 수 없습니다</span>
                </div>
                <p className="text-[11px] text-gray-500 text-center">API 키를 확인하거나<br/>한글 없는 코드로 다시 시도해주세요</p>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-[12px] font-bold hover:bg-white/10 transition-all"
                >
                  닫기 (Esc)
                </button>
              </div>
            ) : (
              <>
                {/* 안내 — 2열 라운드 그리드 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl px-3 py-3 flex flex-col items-center justify-center gap-1 text-center" style={{ background: 'rgba(210,98,99,0.08)', border: '1px solid rgba(210,98,99,0.22)' }}>
                    <span className="text-[18px] leading-none">🌐</span>
                    <span className="text-[12px] font-bold leading-tight" style={{ color: '#d26263' }}>한글 지원 불가</span>
                  </div>
                  <div className="rounded-xl px-3 py-3 flex flex-col items-center justify-center gap-1 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-[11px] text-gray-400 leading-tight">한글 코드는</span>
                    <span className="text-[12px] font-bold text-white leading-tight">영문 자동 번역</span>
                  </div>
                </div>

                {/* 키 확인 타일 */}
                <div className="rounded-xl px-4 py-3 flex flex-col gap-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <div className="text-[13px] text-white text-center">
                    ⌨️ 아무 키나 눌러서 <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold text-white" style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }}>영문(EN)</kbd> <span className="text-emerald-400">모드 확인</span>
                  </div>
                  {/* 입력창 */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border font-mono text-[13px] transition-all"
                    style={{
                      borderColor: keyCheck === 'ok' ? 'rgba(52,211,153,0.6)' : keyCheck === 'ko' ? 'rgba(248,113,113,0.6)' : keyCheck === 'num' ? 'rgba(250,204,21,0.5)' : 'rgba(255,255,255,0.35)',
                      background: keyCheck === 'ok' ? 'rgba(52,211,153,0.07)' : keyCheck === 'ko' ? 'rgba(248,113,113,0.07)' : keyCheck === 'num' ? 'rgba(250,204,21,0.05)' : 'rgba(255,255,255,0.04)',
                      boxShadow: keyCheck === 'ok' ? '0 0 12px rgba(52,211,153,0.25), inset 0 0 8px rgba(52,211,153,0.05)' : keyCheck === 'ko' ? '0 0 12px rgba(248,113,113,0.25), inset 0 0 8px rgba(248,113,113,0.05)' : keyCheck === 'num' ? '0 0 12px rgba(250,204,21,0.2)' : '0 0 0 1px rgba(255,255,255,0.08), 0 0 16px rgba(255,255,255,0.06)',
                    }}
                  >
                    <input
                      ref={keyCheckInputRef}
                      autoFocus
                      maxLength={1}
                      className="flex-1 bg-transparent outline-none text-white text-[13px] font-mono placeholder-gray-600"
                      placeholder="아무 키나... (숫자 제외)"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const isKorean = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(val);
                        if (isKorean) { setKeyCheck('ko'); e.target.value = ''; return; }
                        if (/[a-zA-Z]/.test(val)) { setKeyCheck('ok'); e.target.value = ''; return; }
                        // 숫자·특수문자 전부 무시
                        setKeyCheck('num'); e.target.value = '';
                      }}
                      onCompositionEnd={(e) => {
                        // 한글 IME 조합 완료 시 — onChange 안 터질 때 보완
                        const composed = e.data || e.target.value;
                        if (!composed) return;
                        const isKorean = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(composed);
                        setKeyCheck(isKorean ? 'ko' : 'ok');
                        e.target.value = '';
                      }}
                    />
                    {keyCheck === 'ok' && <span className="text-emerald-400 text-[13px] font-black">✓ EN</span>}
                    {keyCheck === 'ko' && <span className="text-red-400 text-[13px] font-black">✗ KO</span>}
                    {keyCheck === 'num' && <span className="text-yellow-400 text-[13px] font-black">숫자</span>}
                    {keyCheck === 'idle' && <span className="text-gray-600 text-[11px]">—</span>}
                  </div>
                  {/* 상태 메시지 */}
                  {keyCheck === 'ko' && (
                    <p className="text-[12px] text-red-400 text-center flex items-center justify-center gap-1.5 flex-wrap">
                      <span>한글 모드입니다 —</span>
                      <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-200"
                        style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }}
                      >한/영</kbd>
                      <span>키로 전환 후 다시 눌러보세요</span>
                    </p>
                  )}
                  {keyCheck === 'num' && (
                    <p className="text-[12px] text-yellow-400 text-center">알파벳 키만 인식합니다 — a~z 중 하나를 눌러주세요</p>
                  )}
                </div>

                {/* 시작 타일 */}
                <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  {keyCheck !== 'ok' ? (
                    <div className="flex items-center justify-center gap-1.5 text-[12px]">
                      <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold text-gray-200"
                        style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }}
                      >영문(EN)</kbd>
                      <span className="text-emerald-400">확인 후 시작할 수 있습니다</span>
                    </div>
                  ) : enterCount === 0 ? (
                    <div className="flex items-center justify-center gap-2 text-[13px] text-gray-400">
                      <kbd style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }} className="px-3 py-1 rounded text-white text-[12px] font-bold">Enter</kbd>
                      <kbd style={{ background: 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }} className="px-3 py-1 rounded text-white text-[12px] font-bold">Enter</kbd>
                      <span>눌러서 시작</span>
                    </div>
                  ) : (
                    <div className="text-[13px] text-emerald-300 font-bold animate-pulse">
                      <kbd className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded text-emerald-200 text-[12px] font-bold mr-2">Enter</kbd>
                      한 번 더 →
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 결과 오버레이 — 뒤의 타이핑+스테이터스 패널까지 전부 블러 */}
      {isDone && (
        <div
          className="absolute inset-0 flex items-center justify-center backdrop-blur-xl z-40 animate-fade-in-up"
          style={{ background: `rgba(13,17,23,0.97)` }}
        >
          {/* 배경 글로우 — 숨쉬듯 은은하게 */}
          <div
            className="absolute inset-0 pointer-events-none animate-ring-breathe-1"
            style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(${typingTier.rgb},0.18) 0%, transparent 80%)` }}
          />
          <div
            className="relative flex flex-col items-center gap-4 px-5 pt-7 pb-6 rounded-2xl border shadow-2xl"
            style={{
              background: `radial-gradient(ellipse at 50% 10%, rgba(${typingTier.rgb},0.15) 0%, rgba(${typingTier.rgb},0.04) 55%, #111520 100%)`,
              borderColor: `rgba(${typingTier.rgb}, 0.75)`,
              borderWidth: isNewRecord ? '2px' : '1px',
              boxShadow: isNewRecord
                ? `0 0 0 1px rgba(${typingTier.rgb},0.2), 0 0 40px rgba(${typingTier.rgb},0.35), 0 25px 50px rgba(0,0,0,0.5)`
                : `0 0 0 1px rgba(${typingTier.rgb},0.15), 0 0 30px rgba(${typingTier.rgb},0.25), 0 25px 50px rgba(0,0,0,0.5)`,
            }}
          >
            {/* 계급명 — 항상 팡팡 */}
            <div className="flex items-center justify-center h-10 relative -top-2">
              {isNewRecord ? (
                <span
                  className="inline-block text-3xl font-black bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(100deg, rgba(${typingTier.rgb},0.7) 0%, rgba(${typingTier.rgb},0.7) 42%, #ffffff 48%, rgba(${typingTier.rgb},1) 50%, #ffffff 52%, rgba(${typingTier.rgb},0.7) 58%, rgba(${typingTier.rgb},0.7) 100%)`,
                    backgroundSize: '250% 100%',
                    backgroundRepeat: 'no-repeat',
                    animation: 'char-bang 0.45s cubic-bezier(0.2,0.8,0.3,1) forwards, led-sweep 2s linear infinite',
                    opacity: 0,
                  }}
                >
                  {typingTier.label}
                </span>
              ) : (
                typingTier.label.split('').map((char, i) => (
                  <span
                    key={i}
                    className="inline-block text-3xl font-black animate-char-bang"
                    style={{
                      color: `rgba(${typingTier.rgb}, 1)`,
                      textShadow: `0 0 20px rgba(${typingTier.rgb},0.8), 0 0 40px rgba(${typingTier.rgb},0.4)`,
                      animationDelay: `${i * 0.22}s`,
                      opacity: 0,
                    }}
                  >
                    {char}
                  </span>
                ))
              )}
            </div>
            {isNewRecord && (
              <div
                className="text-[10px] font-black tracking-[0.3em] uppercase relative -top-4 -mb-3 bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(100deg, rgba(${typingTier.rgb},0.7) 0%, rgba(${typingTier.rgb},0.7) 42%, #ffffff 48%, rgba(${typingTier.rgb},1) 50%, #ffffff 52%, rgba(${typingTier.rgb},0.7) 58%, rgba(${typingTier.rgb},0.7) 100%)`,
                  backgroundSize: '250% 100%',
                  backgroundRepeat: 'no-repeat',
                  animation: 'fade-in-up 0.6s ease-out forwards, led-sweep 2s linear infinite',
                }}
              >
                신기록
              </div>
            )}
            {/* 타수 원형 */}
            <div className="flex justify-center">
              <div
                className={`w-[108px] h-[108px] rounded-full flex flex-col items-center justify-center relative ${typingTier.heartbeatClass ?? 'animate-ring-breathe-1'}`}
                style={{
                  background: typingTier.background ?? `radial-gradient(circle at 50% 35%, rgba(${typingTier.rgb},0.18) 0%, rgba(${typingTier.rgb},0.04) 60%, transparent 100%)`,
                  boxShadow: typingTier.boxShadow ?? `0 0 0 1.5px rgba(${typingTier.rgb},0.55), 0 0 0 5px rgba(${typingTier.rgb},0.08), 0 0 24px rgba(${typingTier.rgb},0.18), inset 0 1px 0 rgba(255,255,255,0.08)`,
                  animationDuration: typingTier.heartbeatDuration ?? '3s',
                }}
              >
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span
                    className={`${typingTier.numberClass} text-[26px] font-black tabular-nums leading-none`}
                    style={typingTier.numberStyle ?? { filter: `drop-shadow(0 0 8px rgba(${typingTier.rgb},0.4))` }}
                  >{stats.cpm}</span>
                  <span className={`${typingTier.unitClass} text-xs font-bold`}>타</span>
                </div>
                {previousBest?.bestCpm > 0 && (
                  <div className="text-gray-300/80 text-[10px] font-semibold tabular-nums leading-none mt-2">
                    이전 {previousBest.bestCpm}타
                  </div>
                )}
              </div>
            </div>
            {/* 계급 인디케이터 — 현재 계급 중앙, 앞뒤로 흐리게 */}
            {(() => {
              const TIERS = [0, 100, 200, 300, 400, 500, 600, 700].map(cpm => ({ rgb: getTypingTier(cpm).rgb }));
              const idx = getTierIndex(stats.cpm);
              return (
                <div className="flex items-center gap-2">
                  {TIERS.map((t, i) => {
                    const dist = Math.abs(i - idx);
                    const isCurrent = i === idx;
                    const size = isCurrent ? 10 : dist === 1 ? 7 : dist === 2 ? 5 : 4;
                    const opacity = isCurrent ? 1 : dist === 1 ? 0.45 : dist === 2 ? 0.25 : 0.12;
                    return (
                      <div
                        key={i}
                        style={{
                          width: size, height: size,
                          borderRadius: '50%',
                          backgroundColor: `rgba(${t.rgb},${opacity})`,
                          boxShadow: isCurrent
                          ? `0 0 8px rgba(${t.rgb},0.9), 0 0 16px rgba(${t.rgb},0.4)`
                          : (() => { const g = Math.min(i, 5); return `0 0 ${1 + g * 0.6}px rgba(${t.rgb},${0.04 + g * 0.025})`; })(),
                          transition: 'all 0.3s',
                        }}
                      />
                    );
                  })}
                </div>
              );
            })()}
            {/* 나머지 스탯들 — 원 아래에 3열 */}
            <div className="grid grid-cols-3 gap-10 text-sm">
              <div className="text-center">
                <div className="text-fuchsia-300 text-2xl font-black tabular-nums leading-none">{Math.max(0, 100 - stats.accuracy)}%</div>
                <div className="text-gray-500 text-[10px] font-bold tracking-wider mt-2">오타율</div>
              </div>
              <div className="text-center">
                <div className="text-amber-200 text-2xl font-black tabular-nums leading-none">
                  {stats.seconds.toFixed(1)}초
                </div>
                <div className="text-gray-500 text-[10px] font-bold tracking-wider mt-2">경과 시간</div>
              </div>
              <div className="text-center">
                <div className="text-rose-300 text-2xl font-black tabular-nums leading-none">{wrongCount}</div>
                <div className="text-gray-500 text-[10px] font-bold tracking-wider mt-2">오타 개수</div>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={restart}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={isNewRecord ? {
                  background: `rgba(${typingTier.rgb},0.08)`,
                  border: `1px solid rgba(${typingTier.rgb},0.5)`,
                  color: `rgba(${typingTier.rgb},0.9)`,
                  boxShadow: `0 0 8px rgba(${typingTier.rgb},0.2)`,
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                }}
                title="F2"
              >
                <span>↻</span>
                <span>다시하기</span>
                <span className="text-[9px] font-black opacity-50 px-1.5 py-0.5 rounded bg-white/10">
                  F2
                </span>
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all"
                style={isNewRecord ? {
                  background: `rgba(${typingTier.rgb},0.08)`,
                  border: `1px solid rgba(${typingTier.rgb},0.5)`,
                  color: `rgba(${typingTier.rgb},0.9)`,
                  boxShadow: `0 0 8px rgba(${typingTier.rgb},0.2)`,
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                }}
                title="Esc"
              >
                <span>닫기</span>
                <span className="text-[9px] font-black opacity-70 px-1.5 py-0.5 rounded bg-white/10">
                  Esc
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기록초기화 확인 모달 — window.confirm 금지 약속에 따라 커스텀 모달 사용 */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e2030] border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl w-[320px]">
            <p className="text-white font-bold text-base">최고기록을 초기화할까요?</p>
            <p className="text-gray-400 text-sm text-center">저장된 기록이 전부 사라져요.<br/><span className="text-amber-300">획득한 뱃지도 함께 초기화</span>되며<br/>되돌릴 수 없습니다.</p>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetBest?.();
                }}
                className="flex-1 py-2 rounded-lg bg-rose-500/80 text-white text-sm font-bold hover:bg-rose-500 transition-all"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
