import { useState, useEffect, useRef } from 'react';
import { getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, GEMINI_CHAT_URL } from '../../lib/aiConfig';

// ─── 토큰 → Monaco 색상 매핑 ─────────────────────
const JAVA_KEYWORDS = new Set([
  'private','public','protected','static','final','abstract','synchronized',
  'void','int','long','double','float','boolean','char','byte','short',
  'class','interface','extends','implements','new','return','this','super',
  'if','else','for','while','do','switch','case','break','continue','default',
  'try','catch','finally','throw','throws','null','true','false','instanceof',
  'import','package','enum','var',
]);
const getTokenColor = (token) => {
  const base = token.replace(/\(\)$/, '').trim();
  if (token.endsWith('()'))          return '#dcdcaa'; // 메서드 — 노란
  if (JAVA_KEYWORDS.has(base))       return '#569cd6'; // 키워드 — 파랑
  if (/^[A-Z]/.test(base))           return '#4ec9b0'; // 클래스/타입 — 청록
  return '#9cdcfe';                                     // 변수 — 연파랑
};

// ─── 객관식 보기 Monaco 스타일 토크나이저 ─────────
const tokenizeCode = (text) => {
  const tokens = [];
  const regex = /"[^"]*"|'[^']*'|\/\/.*|(\b\w+\b)|([^\w\s])/g;
  let last = 0, m, key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push({ key: key++, text: text.slice(last, m.index), color: '#d4d4d4' });
    const t = m[0];
    let color = '#d4d4d4';
    if (t.startsWith('"') || t.startsWith("'"))  color = '#ce9178'; // 문자열
    else if (t.startsWith('//'))                  color = '#6a9955'; // 주석
    else if (/^\d+$/.test(t))                     color = '#b5cea8'; // 숫자
    else if (JAVA_KEYWORDS.has(t))                color = '#569cd6'; // 키워드
    else if (/^[A-Z]/.test(t))                    color = '#4ec9b0'; // 클래스
    else if (text[m.index + t.length] === '(')    color = '#dcdcaa'; // 메서드
    else if (/^[a-z_$]/.test(t))                  color = '#9cdcfe'; // 변수
    tokens.push({ key: key++, text: t, color });
    last = m.index + t.length;
  }
  if (last < text.length) tokens.push({ key: key++, text: text.slice(last), color: '#d4d4d4' });
  return tokens;
};

const CodeOption = ({ text }) => (
  <span className="font-mono text-[12px]">
    {tokenizeCode(text).map(t => (
      <span key={t.key} style={{ color: t.color }}>{t.text}</span>
    ))}
  </span>
);

// ─── 코드 토큰 파싱 렌더러 ────────────────────────
const QuestionText = ({ text, onHighlightToken }) => {
  if (!text) return null;
  const regex = /'([^']+)'|`([^`]+)`/g;
  let lastIndex = 0;
  let match;
  const elements = [];
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const token = match[1] || match[2];
    elements.push(
      <code
        key={key++}
        className="code-token-clickable text-[11px] bg-white/[0.08] px-1.5 py-0.5 rounded font-mono"
        style={{ color: getTokenColor(token), cursor: onHighlightToken ? 'pointer' : undefined }}
        title={onHighlightToken ? '클릭하면 에디터에서 찾기' : undefined}
        onClick={() => { if (onHighlightToken) onHighlightToken(token); }}
      >{token}</code>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    elements.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return <span>{elements}</span>;
};

// ─── 주관식 코드 블록 토큰 렌더러 ───────────────
const CodeWithBlank = ({ code, onHighlightToken }) => {
  if (!code) return null;
  // 단어/기호 단위로 분리 (공백·줄바꿈 유지)
  const parts = code.split(/(\s+|[(){}[\];,.])/);
  return (
    <>
      {parts.map((part, i) => {
        const isBlank = part === '___';
        const isClickable = onHighlightToken && part.trim().length > 1 && !isBlank && !/^\s+$/.test(part);
        if (isBlank) {
          return <span key={i} className="text-[#e0be7a] font-bold">___</span>;
        }
        if (isClickable) {
          return (
            <span
              key={i}
              className="cursor-pointer hover:text-white hover:underline underline-offset-2 transition-colors"
              onClick={() => onHighlightToken(part.trim())}
              title="클릭하면 에디터에서 찾기"
            >{part}</span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

// ─── 해설 하이라이트 렌더러 ──────────────────────
const ExplanationText = ({ text, onHighlightToken }) => {
  if (!text) return null;
  const regex = /'([^']+)'|`([^`]+)`/g;
  let lastIndex = 0;
  let match;
  const elements = [];
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const token = match[1] || match[2];
    elements.push(
      <code
        key={key++}
        className="text-[11px] bg-[#e0be7a]/10 px-1.5 py-0.5 rounded font-mono font-bold"
        style={{ color: '#e0be7a', cursor: onHighlightToken ? 'pointer' : undefined }}
        title={onHighlightToken ? '클릭하면 에디터에서 찾기' : undefined}
        onClick={() => { if (onHighlightToken) onHighlightToken(token); }}
      >{token}</code>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    elements.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return <span>{elements}</span>;
};

// ─── Gemini 호출 ─────────────────────────────────
const callGemini = async (prompt) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API 키 없음');
  const url = `${GEMINI_CHAT_URL(MODELS.GEMINI_QUIZ)}?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

// ─── 문제 생성 프롬프트 ──────────────────────────
const buildQuizPrompt = (code, usedQuestions = [], count = 3) => {
  // 문제 구성: 4지선다 / 빈칸 교대, 마지막은 무조건 빈칸
  const composition = Array.from({ length: count }, (_, i) =>
    i === count - 1 ? `${i + 1}번: 빈칸 채우기` : `${i + 1}번: ${i % 2 === 0 ? '4지선다' : '빈칸 채우기'}`
  ).join('\n');

  const jsonTypes = Array.from({ length: count }, (_, i) =>
    i === count - 1 || i % 2 !== 0
      ? `  {"type":"fill_blank","question":"문제 설명","code_with_blank":"코드에서 가져온 줄 (___가 빈칸)","answer":"정답 코드","explanation":"해설"}`
      : `  {"type":"multiple_choice","question":"문제 텍스트","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"}`
  ).join(',\n');

  return `
아래 코드를 읽고 확인 문제 ${count}개를 만들어라.

[코드]
\`\`\`
${code.substring(0, 3000)}
\`\`\`
${usedQuestions.length > 0 ? `
[이미 출제된 문제 — 절대 중복 출제 금지]
${usedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
위 문제와 유사하거나 같은 내용의 문제를 만들지 마라.
` : ''}
[규칙]
- 코딩/프로그래밍과 전혀 무관한 내용이라면 {"error":"not_coding"} 만 반환하라.
- 위 코드에 실제로 존재하는 내용만 다뤄라.
- package, import 관련 문제 금지. 정답이 애매한 문제 금지.
- 빈칸 채우기는 위 코드에서 한 줄을 그대로 가져와 핵심 토큰 하나만 ___로 바꿔라. ___를 정답으로 채웠을 때 원본 줄과 완전히 일치해야 한다. 존재하지 않는 토큰을 빈칸으로 만들지 마라.
- 문제 텍스트에서 코드 식별자·메서드명·키워드는 반드시 홑따옴표로 감싸라. 예: 'getInstance()', 'private', 'count'

[문제 구성 — 반드시 ${count}개]
${composition}

[JSON 형식으로만 응답]:
{"concept":"이 코드의 핵심 개념","questions":[
${jsonTypes}
]}`;
};

// ─── 결과 분석 프롬프트 ──────────────────────────
const buildResultPrompt = (concept, results) => {
  const wrong = results.filter(r => !r.correct);
  if (wrong.length === 0) return null;
  return `학생이 "${concept}" 개념 퀴즈를 풀었습니다.
틀린 문제: ${wrong.map(r => `"${r.question}" (학생 답: ${r.studentAnswer}, 정답: ${r.correctAnswer})`).join(' / ')}

위 결과를 보고, 수업 중 선생님처럼 아쉬운 부분을 한두 문장으로 짚어줘.
그리고 자연스럽게 한 문제 더 풀어볼 것을 제안해줘. 딱딱하지 않게, 친근하게.
두 문장 이내로.`;
};

const LOADING_MSGS = [
  '코드에서 개념 파악 중...',
  '핵심 개념 추출 중...',
  '문제 구성 중...',
  '실력 확인 준비 중...',
  '문제 다듬는 중...',
];
const pickMsg = () => LOADING_MSGS[Math.floor(Math.random() * LOADING_MSGS.length)];

// ═══════════════════════════════════════════════════
export default function FreeStudyQuiz({ getCodeContext, onSendToTutor, onHighlightToken, activeTab, defaultCount = 5, isActive = true }) {
  const [phase, setPhase]             = useState('idle'); // idle | generating | active | result
  const [questions, setQuestions]     = useState([]);
  const [concept, setConcept]         = useState('');
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback]       = useState(null); // null | { correct }
  const [hearts, setHearts]           = useState(5);
  const [heartLostIdx, setHeartLostIdx] = useState(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const [fillAnswer, setFillAnswer]   = useState('');
  const [results, setResults]         = useState([]);
  const [loadingMsg, setLoadingMsg]   = useState('');
  const [resultSuggestion, setResultSuggestion] = useState('');
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [resultEnterCount, setResultEnterCount] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0); // 현재 문제 오답 횟수
  const [usedQuestions, setUsedQuestions] = useState([]); // 이미 출제된 문제 텍스트 목록
  const [reviewMode, setReviewMode]     = useState(false); // 복습 모드 (하트 잠금)
  const [quizSession, setQuizSession]   = useState(0);     // 퀴즈 세션 ID (교차 오탐 방지)
  const [reportConfirm, setReportConfirm] = useState(false); // 문제 이상 신고 확인 UI
  const [replacingQuestion, setReplacingQuestion] = useState(false); // 문제 교체 로딩
  const [questionCount, setQuestionCount] = useState(defaultCount); // 문제 개수 (5~15)

  const panelRef        = useRef(null);
  const fillInputRef    = useRef(null);
  const feedbackTimerRef = useRef(null);
  const curQ = questions[currentIdx];

  // ─── 문제 생성 ────────────────────────────────
  const startQuiz = async () => {
    const code = getCodeContext?.() || '';
    if (!code.trim()) {
      showError('에디터에 코드를 먼저 입력해주세요');
      return;
    }
    setPhase('generating');
    setLoadingMsg(pickMsg());
    setErrorMsg('');
    try {
      const raw = await callGemini(buildQuizPrompt(code, usedQuestions, questionCount));
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.error === 'not_coding') {
        setPhase('idle');
        showError('코딩 관련 주제가 아닌 것 같아요 😅');
        return;
      }
      const newQs = parsed.questions || [];
      setConcept(parsed.concept || '');
      setQuestions(newQs);
      setUsedQuestions(prev => [...prev, ...newQs.map(q => q.question)]);
      setCurrentIdx(0);
      setSelectedAnswer(null);
      setFeedback(null);
      setFillAnswer('');
      setHearts(5);
      setResults([]);
      setResultSuggestion('');
      setWrongAttempts(0);
      setReviewMode(false);
      setQuizSession(prev => prev + 1);
      setPhase('active');
    } catch (e) {
      console.error('퀴즈 생성 실패:', e);
      setPhase('idle');
      showError('문제 생성에 실패했어요. 다시 시도해주세요');
    }
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  // ─── 문제 교체 ────────────────────────────────
  const replaceQuestion = async () => {
    if (!curQ) return;
    setReportConfirm(false);
    setReplacingQuestion(true);
    const code = getCodeContext?.() || '';
    const typeLabel = curQ.type === 'fill_blank' ? '빈칸 채우기' : '4지선다';
    const prompt = `아래 코드를 읽고 "${typeLabel}" 유형의 문제 1개를 새로 만들어라.

[코드]
\`\`\`
${code.substring(0, 3000)}
\`\`\`

[제외할 문제 — 이 문제와 유사하거나 같은 내용 금지]
${curQ.question}

[규칙]
- 위 코드에 실제로 존재하는 내용만 다뤄라.
- package, import 관련 문제 금지. 정답이 애매한 문제 금지.
- 빈칸 채우기: 위 코드에서 한 줄을 그대로 가져와 핵심 토큰 하나만 ___로 바꿔라. ___를 정답으로 채웠을 때 원본 줄과 완전히 일치해야 한다.
- 문제 텍스트에서 코드 식별자·키워드는 홑따옴표로 감싸라.

[JSON 형식으로만 응답]:
${curQ.type === 'fill_blank'
  ? '{"type":"fill_blank","question":"문제 설명","code_with_blank":"코드에서 가져온 줄 (___가 빈칸)","answer":"정답 코드","explanation":"해설"}'
  : '{"type":"multiple_choice","question":"문제 텍스트","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"}'}`;
    try {
      const raw = await callGemini(prompt);
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const newQ = JSON.parse(jsonStr);
      setQuestions(prev => {
        const next = [...prev];
        next[currentIdx] = { ...newQ, replaced: true };
        return next;
      });
      setUsedQuestions(prev => [...prev, newQ.question]);
      setSelectedAnswer(null);
      setFeedback(null);
      setFillAnswer('');
      setWrongAttempts(0);
    } catch {
      showError('문제 교체에 실패했어요. 다시 시도해주세요');
    } finally {
      setReplacingQuestion(false);
    }
  };

  // ─── 답 선택 ──────────────────────────────────
  const handleAnswer = (answer) => {
    if (feedback || !curQ) return;
    const normalize = (s) => s.trim().toLowerCase().replace(/;+$/, '').replace(/\s+/g, ' ');
    // fill_blank: AI가 answer를 토큰만("num2") 또는 전체 줄("System.out.println(num2);")로 줄 수 있음
    // 두 경우 모두 처리: 직접 비교 OR code_with_blank의 ___를 user 답으로 채운 결과와 비교
    const isCorrect = curQ.type === 'fill_blank'
      ? normalize(answer) === normalize(curQ.answer)
        || (curQ.code_with_blank && normalize(curQ.code_with_blank.replace('___', answer)) === normalize(curQ.answer))
      : answer === curQ.answer;
    const semiHint = isCorrect && curQ.type === 'fill_blank'
      && curQ.answer.trim().endsWith(';') && !answer.trim().endsWith(';');

    setSelectedAnswer(answer);
    setFeedback({ correct: isCorrect, semiHint });
    if (!reviewMode) {
      setResults(prev => {
        const next = [...prev];
        const prevEntry = next[currentIdx];
        const hadPreviousWrong = prevEntry != null
          && prevEntry.session === quizSession
          && !prevEntry.correct;
        next[currentIdx] = {
          question:      curQ.question,
          studentAnswer: answer,
          correctAnswer: curQ.answer,
          correct:       isCorrect,
          attempt:       (wrongAttempts > 0 || hadPreviousWrong) ? 2 : 1,
          type:          curQ.type,
          replaced:      curQ.replaced ?? false,
          session:       quizSession,
        };
        return next;
      });
    }

    if (!isCorrect && !reviewMode) {
      setHeartLostIdx(hearts - 1);
      setScreenFlash(true);
      setTimeout(() => { setHeartLostIdx(null); setScreenFlash(false); }, 600);
      setHearts(prev => prev - 1);
      setWrongAttempts(prev => prev + 1);
    } else if (!isCorrect && reviewMode) {
      setWrongAttempts(prev => prev + 1);
    }
    // 1차 오답만 5초 타이머 (재시도 가능 → feedback 클리어)
    // 2차 오답은 타이머 없음 — 기존대로 Enter로 다음 문제
    if (!isCorrect && wrongAttempts === 0) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => dismissWrongFeedback(true), 5000);
    }
    setTimeout(() => panelRef.current?.focus(), 50);
  };

  // ─── 다음 문제 or 결과 ────────────────────────
  const goNext = () => {
    clearTimeout(feedbackTimerRef.current);
    if (!feedback) return;
    const isLast = currentIdx + 1 >= questions.length;
    if (reviewMode) {
      if (isLast) {
        setPhase('result');
      } else {
        setCurrentIdx(prev => prev + 1);
        setSelectedAnswer(null);
        setFeedback(null);
        setFillAnswer('');
        setWrongAttempts(0);
      }
      return;
    }
    if (isLast || hearts <= 0) {
      goResult();
    } else {
      setCurrentIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setFeedback(null);
      setFillAnswer('');
      setWrongAttempts(0);
    }
  };

  // ─── 오답 피드백 자동 해제 (goNext 이후에 선언) ──
  // canRetry: 재시도 가능 → feedback만 클리어 / false → 다음 문제
  const dismissWrongFeedback = (canRetry) => {
    clearTimeout(feedbackTimerRef.current);
    if (canRetry) {
      setFeedback(null);
      setSelectedAnswer(null);
      setTimeout(() => fillInputRef.current?.focus(), 50);
    } else {
      goNext();
    }
  };

  // ─── 이전 문제 ───────────────────────────────
  const goPrev = () => {
    if (currentIdx === 0) return;
    setCurrentIdx(prev => prev - 1);
    setSelectedAnswer(null);
    setFeedback(null);
    setFillAnswer('');
    setWrongAttempts(0);
  };

  // ─── 결과 화면 전환 ───────────────────────────
  const goResult = async (early = false) => {
    setPhase('result');
    const allResults = results.filter(Boolean);
    const prompt = buildResultPrompt(concept, allResults);
    if (!prompt) {
      setResultSuggestion(early ? '다음엔 끝까지 풀어봐요~ 💪' : '모두 정답이에요! 훌륭해요 🎉');
      return;
    }
    setSuggestionLoading(true);
    try {
      const msg = await callGemini(prompt);
      setResultSuggestion(msg.trim());
    } catch {
      setResultSuggestion('수고하셨어요! 한 문제 더 풀어볼까요?');
    } finally {
      setSuggestionLoading(false);
    }
  };

  // ─── Enter → 다음 / 한 문제 더 + 1~4 객관식 선택 ──
  useEffect(() => {
    const handler = (e) => {
      if (!isActive) return;
      // Enter
      if (e.key === 'Enter') {
        if (e.nativeEvent?.isComposing || e.isComposing) return;
        if (phase === 'active' && feedback && (feedback.correct || wrongAttempts >= 2)) {
          e.preventDefault();
          goNext();
        } else if (phase === 'result' && !suggestionLoading) {
          e.preventDefault();
          if (resultEnterCount === 0) {
            setResultEnterCount(1);
            setTimeout(() => setResultEnterCount(0), 2000);
          } else {
            setResultEnterCount(0);
            startQuiz();
          }
        }
        return;
      }
      // 1~4 숫자키 (일반 + 넘버패드) → 객관식 선택
      const numMap = {
        '1': 0, '2': 1, '3': 2, '4': 3,
        'Numpad1': 0, 'Numpad2': 1, 'Numpad3': 2, 'Numpad4': 3,
      };
      const idx = numMap[e.key] ?? numMap[e.code];
      if (idx !== undefined && phase === 'active' && !feedback && curQ?.type === 'multiple_choice') {
        const opt = curQ.options?.[idx];
        if (opt) { e.preventDefault(); handleAnswer(opt); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, feedback, currentIdx, hearts, questions.length, suggestionLoading, curQ, resultEnterCount, wrongAttempts, isActive]);

  // ─── fill_blank 입력창 자동 포커스 ────────────
  useEffect(() => {
    if (phase === 'active' && curQ?.type === 'fill_blank' && !feedback) {
      setTimeout(() => fillInputRef.current?.focus(), 80);
    }
  }, [currentIdx, phase, feedback]);

  // ─── 오답 1회: 1.5초 후 자동 재시도 / 2회: 유지 ──
  useEffect(() => {
    if (feedback && !feedback.correct && wrongAttempts === 1) {
      const timer = setTimeout(() => {
        setFeedback(null);
        setSelectedAnswer(null);
        setFillAnswer('');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [feedback, wrongAttempts]);

  // ══════════════════════════════════════════════
  // IDLE
  if (phase === 'idle') {
    const isAiTab = activeTab === 'ai';
    const srcEmoji = isAiTab ? '🖥️' : '💻';
    const srcLabel = isAiTab ? 'AI 생성코드' : '코드노트';
    const srcColor = isAiTab ? 'text-cyan-300' : 'text-pink-300';
    const descLine1 = isAiTab
      ? <><span className="text-cyan-300">AI 생성코드</span><span className="text-gray-400">의 개념을 </span><span className="text-amber-300">AI</span><span className="text-gray-400">가 파악해서</span></>
      : <><span className="text-pink-300">코드노트</span><span className="text-gray-400">의 개념을 </span><span className="text-amber-300">AI</span><span className="text-gray-400">가 파악해서</span></>;

    return (
      <div className="flex-1 flex flex-col items-center select-none pt-4 md:pt-10 pb-6 md:pb-14">
        {errorMsg && (
          <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-center">
            {errorMsg}
          </div>
        )}
        {/* 플로우 일러스트 */}
        <div className="flex flex-col items-center gap-4 mt-6 md:mt-[100px] mb-4 md:mb-[50px]">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
              <span className="text-[22px]">{srcEmoji}</span>
              <span className={`${srcColor} font-medium text-[10px]`}>{srcLabel}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-gray-500">
              <span className="text-[10px]">✨</span>
              <span className="text-[15px]">→</span>
              <span className="text-[10px]">✨</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
              <span className="text-[22px]">🤖</span>
              <span className="text-amber-300 font-medium text-[10px]">AI 분석</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 text-gray-500">
              <span className="text-[10px]">🚀</span>
              <span className="text-[15px]">→</span>
              <span className="text-[10px]"> </span>
            </div>
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
              <span className="text-[22px]">🎯</span>
              <span className="text-violet-300 font-medium text-[10px]">문제 생성</span>
            </div>
          </div>
          <p className="font-bold text-center leading-[2.2] tracking-wide" style={{ textShadow: '0 0 16px rgba(255,255,255,0.2)' }}>
            <span className="text-[13px] block">{descLine1}</span>
            <span className="text-[13px] block">
              <span className="text-gray-400">새로운 </span>
              <span className="text-violet-300">시험 문제</span>
              <span className="text-gray-400">를 만들어줍니다.</span>
            </span>
          </p>
        </div>
        {/* 슬라이더 — 설명 바로 아래 */}
        <div className="flex flex-col items-center gap-1.5 w-48 mt-5">
          <span className="text-[9px] font-light text-white/60 tracking-widest uppercase mb-0.5">문제 횟수 선택</span>
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[10px] text-gray-500">MIN</span>
            <span className="text-[13px] font-bold" style={{
              color: `rgb(${Math.round(255)}, ${Math.round(255 - ((questionCount - 5) / 10) * 235)}, ${Math.round(255 - ((questionCount - 5) / 10) * 255)})`
            }}>{questionCount}문제</span>
            <span className="text-[10px] text-gray-500">MAX</span>
          </div>
          <input
            type="range"
            min={5} max={15} step={1}
            value={questionCount}
            onChange={e => setQuestionCount(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, rgba(167,139,250,0.7) 0%, rgba(167,139,250,0.7) ${((questionCount - 5) / 10) * 100}%, rgba(255,255,255,0.1) ${((questionCount - 5) / 10) * 100}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>
        {/* 버튼 */}
        <div className="mt-8">
          <button
            onClick={startQuiz}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30 hover:text-violet-100 transition-all"
            style={{ boxShadow: '0 0 16px rgba(167,139,250,0.35)' }}
          >
            🎯 문제 생성
          </button>
        </div>
      </div>
    );
  }

  // GENERATING
  if (phase === 'generating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 select-none">
        <div className="w-14 h-14 border-[3px] border-violet-400/20 border-t-violet-400 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-medium animate-pulse">{loadingMsg}</p>
      </div>
    );
  }

  // RESULT
  if (phase === 'result') {
    const correctCount = results.filter(r => r?.correct).length;
    return (
      <div className="flex-1 flex flex-col overflow-y-auto relative">
        <button
          onClick={() => setPhase('idle')}
          className="absolute top-3 right-3 z-10 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-white/[0.04] border border-white/10 text-gray-400 hover:bg-white/[0.08] hover:text-white transition-all"
          title="문제 출제 선택 화면으로"
        >
          ↩ 돌아가기
        </button>
        <div className="flex-1 flex flex-col gap-3 p-4 mx-auto w-full max-w-[520px]">
          <div className="text-center pt-2">
            <div className="text-4xl mb-2">
              {correctCount === results.length ? '🏆' : correctCount >= 2 ? '👏' : '💪'}
            </div>
            <p className="text-white font-black text-lg">{correctCount} / {results.length} 정답</p>
            {concept && (
              <p className="text-gray-500 text-[11px] mt-1">개념: {concept}</p>
            )}
          </div>

          {/* 문제별 결과 */}
          <div className="flex flex-col gap-2">
            {results.filter(Boolean).map((r, i) => {
              const isRetry = r.correct && r.attempt === 2;
              return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                  r.correct
                    ? isRetry
                      ? 'bg-amber-500/[0.07] border-amber-500/25'
                      : 'bg-emerald-500/[0.06] border-emerald-500/20'
                    : 'bg-red-500/[0.06] border-red-500/20'
                }`}
              >
                <span className="text-base shrink-0 mt-0.5">
                  {r.correct ? (isRetry ? '🌀' : '✅') : '❌'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-white/75 leading-snug">{r.question}</p>
                  {r.correct && isRetry && (
                    <p className="text-[10px] text-amber-400/70 mt-0.5">두 번째 시도에 정답</p>
                  )}
                  {!r.correct && (
                    <p className="text-[11px] text-red-400/60 mt-1">
                      내 답: {r.studentAnswer} → 정답: {r.correctAnswer}
                    </p>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* AI 제안 */}
          <div
            className="rounded-xl border border-violet-400/40 bg-violet-500/[0.08] px-4 py-3 text-[13px] text-white font-semibold leading-relaxed min-h-[52px]"
            style={{ boxShadow: '0 0 18px rgba(139,92,246,0.25), 0 0 6px rgba(139,92,246,0.15), inset 0 0 12px rgba(139,92,246,0.06)' }}
          >
            {suggestionLoading
              ? <span className="text-gray-500 animate-pulse text-[12px]">분석 중...</span>
              : resultSuggestion}
          </div>

          {/* 복습 버튼 — 틀린 문제 있을 때만 */}
          {results.filter(r => r && !r.correct).length > 0 && (
            <button
              onClick={() => {
                setReviewMode(true);
                setCurrentIdx(0);
                setSelectedAnswer(null);
                setFeedback(null);
                setFillAnswer('');
                setWrongAttempts(0);
                setPhase('active');
              }}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-red-500/[0.08] border border-red-400/50 text-red-300 hover:bg-red-500/[0.14] hover:text-red-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              👉 틀린 문제를 한 번 더 살펴볼 수 있어요
            </button>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={startQuiz}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-violet-500/15 border border-violet-400/30 text-violet-200 hover:bg-violet-500/25 transition-all"
            >
              <span className="flex flex-col items-center gap-1.5">
                <span>{resultEnterCount === 1 ? '한 번 더!' : `${questionCount}문제 더 풀어보기`}</span>
                <span className="flex items-center gap-1.5">
                  <kbd style={{ background: resultEnterCount === 1 ? 'linear-gradient(180deg, #4a3a1a 0%, #2a1a00 100%)' : 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)', border: resultEnterCount === 1 ? '1px solid #e0be7a' : '1px solid #555', boxShadow: '0 2px 0 #111, 0 3px 0 #000' }} className="px-2 py-0.5 rounded text-white text-[11px] font-bold transition-all">Enter</kbd>
                  <span
                    className="text-[12px] font-black tabular-nums transition-all duration-300"
                    style={{ color: resultEnterCount === 1 ? '#e0be7a' : '#7c6fcd', textShadow: resultEnterCount === 1 ? '0 0 10px rgba(224,190,122,0.9)' : '0 0 6px rgba(124,111,205,0.6)' }}
                  >×{resultEnterCount === 1 ? '1' : '2'}</span>
                </span>
                <span className={`text-[9px] font-normal transition-colors ${resultEnterCount === 1 ? 'text-[#e0be7a]' : 'text-violet-300/50'}`}>
                  {resultEnterCount === 1 ? '한 번 더 누르면 시작!' : '엔터를 두 번 눌러주세요'}
                </span>
              </span>
            </button>
            <button
              onClick={() => onSendToTutor?.({ concept, results })}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/[0.04] border border-white/10 text-gray-200 hover:bg-white/[0.07] hover:text-white transition-all"
            >
              <span className="flex flex-col items-center gap-1">
                <span>💬 AI 선생님께 질문</span>
                <span className="text-[9px] text-gray-400 font-normal leading-snug">방금 배운 코드 바로 질문 가능해요</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE
  if (!curQ) return null;
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`flex-1 flex flex-col outline-none transition-colors duration-150 ${screenFlash ? 'bg-red-500/[0.08]' : ''}`}
    >
      {/* 헤더: 하트 + 진행 */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          {currentIdx > 0 && (
            <button
              onClick={goPrev}
              className="text-[18px] text-gray-600 hover:text-gray-300 transition-colors px-1 leading-none"
              title="이전 문제"
            >←</button>
          )}
          {reviewMode ? (
            <button
              onClick={() => setPhase('result')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200 hover:bg-white/[0.07] transition-all"
            >
              <span>🔍</span> 결과로 돌아가기
            </button>
          ) : (
            <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className={`text-[15px] transition-all duration-300 ${
                  i >= hearts ? 'opacity-20 scale-75' : 'heart-beat'
                } ${heartLostIdx === i ? 'animate-ping' : ''}`}
                style={i < hearts ? { filter: 'drop-shadow(0 0 4px rgba(255,80,80,0.7))' } : undefined}
              >❤️</span>
            ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-300 ${
                i < currentIdx  ? 'w-3 bg-violet-400' :
                i === currentIdx ? 'w-3 bg-violet-300' :
                                   'w-2.5 bg-white/10'
              }`}
            />
          ))}
          <span className="text-[10px] text-gray-600 ml-1 tabular-nums">
            {currentIdx + 1}/{questions.length}
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex flex-col overflow-y-auto py-4 gap-4">
        <div className="flex flex-col gap-4 mx-auto w-full max-w-[520px] px-4">

        {/* 문제 텍스트 */}
        <p className="text-[15px] text-white leading-relaxed font-bold">
          <QuestionText text={curQ.question} onHighlightToken={onHighlightToken} />
        </p>

        {/* fill_blank */}
        {curQ.type === 'fill_blank' && (
          <div className="flex flex-col gap-2">
            <pre className="text-[12px] bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2.5 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {curQ.code_with_blank.split('___').map((part, i, arr) => (
                <span key={i}>
                  <CodeOption text={part} />
                  {i < arr.length - 1 && (
                    <span style={{ color: '#e0be7a' }} className="font-black">___</span>
                  )}
                </span>
              ))}
            </pre>
            <input
              ref={fillInputRef}
              type="text"
              value={fillAnswer}
              onChange={e => setFillAnswer(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && !feedback && fillAnswer.trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAnswer(fillAnswer.trim());
                }
              }}
              disabled={!!feedback}
              placeholder="빈칸에 들어갈 코드를 입력하세요"
              className="w-full bg-white/[0.04] border border-white/15 rounded-lg px-4 py-3 text-[13px] text-white placeholder:text-gray-500 focus:outline-none focus:border-[#62593f] disabled:opacity-50 font-mono"
            />
            {!feedback && fillAnswer.trim() && (
              <button
                onClick={() => handleAnswer(fillAnswer.trim())}
                className="self-end px-4 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500/20 border border-violet-400/30 text-violet-200 hover:bg-violet-500/30 transition-all"
              >
                제출 ↵
              </button>
            )}
          </div>
        )}

        {/* OX: 나란히 / 객관식: 세로 */}
        {(curQ.type === 'ox' || curQ.type === 'multiple_choice') && (
          <div className={`${curQ.type === 'ox' ? 'flex flex-row gap-3' : 'flex flex-col gap-2'}`}>
            {curQ.options?.map((opt, i) => {
              const isSelected = selectedAnswer === opt;
              const isCorrectOpt = opt === curQ.answer;
              const showResult = !!feedback;
              let cls = 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:bg-white/[0.06]';
              if (showResult) {
                if ((feedback.correct || wrongAttempts >= 2) && isCorrectOpt) cls = 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200';
                else if (isSelected)                  cls = 'border-red-400/50 bg-red-500/[0.08] text-red-300';
                else                                  cls = 'border-white/[0.05] bg-transparent text-gray-600';
              } else if (isSelected) {
                cls = 'border-violet-400/60 bg-violet-500/10 text-violet-200';
              }
              return (
                <button
                  key={i}
                  onClick={() => !feedback && handleAnswer(opt)}
                  disabled={!!feedback}
                  className={`${curQ.type === 'ox' ? 'flex-1 text-center py-5' : 'w-full text-left py-2.5'} px-4 rounded-xl border text-[13px] font-semibold transition-all duration-150 ${cls} disabled:cursor-default`}
                >
                  {showResult ? opt : <CodeOption text={opt} />}
                </button>
              );
            })}
          </div>
        )}

        {/* 피드백 */}
        {feedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-[12px] leading-relaxed cursor-pointer ${
              feedback.correct
                ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200'
                : 'border-red-500/25 bg-red-500/[0.06] text-red-200'
            }`}
            onClick={() => { if (!feedback.correct && wrongAttempts < 2) dismissWrongFeedback(true); }}
          >
            <p className="font-bold mb-1 text-[13px]">
              {feedback.correct ? '✅ 정답!' : '❌ 오답'}
            </p>
            <p className="text-gray-200 font-semibold"><ExplanationText text={curQ.explanation} onHighlightToken={onHighlightToken} /></p>
            {feedback.semiHint && (
              <p className="mt-1.5 text-[11px] text-amber-400/80">💡 정확히는 <code className="bg-white/10 px-1 rounded font-mono">{curQ.answer.trim()}</code> 처럼 <code className="bg-white/10 px-1 rounded font-mono">;</code>까지 써야 해요</p>
            )}
            {(feedback.correct || wrongAttempts >= 2) && (() => {
              const isLast = currentIdx + 1 >= questions.length;
              return (
                <div className="mt-3 flex justify-end">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-[11px] text-gray-300 font-medium" style={{ boxShadow: '0 0 12px rgba(255,255,255,0.08), 0 0 4px rgba(255,255,255,0.05)' }}>
                    <kbd className="inline-flex flex-col items-center justify-center bg-white/10 px-2 py-1 rounded font-mono gap-0.5 leading-none">
                      <span className="text-[11px]">↵</span>
                      <span className="text-[8px] font-bold tracking-wide">Enter</span>
                    </kbd>
                    {isLast ? '결과 보기' : '다음 문제'}
                  </span>
                </div>
              );
            })()}
            {!feedback.correct && wrongAttempts < 2 && (
              <p className="mt-2 text-[10px] text-red-400/60 animate-pulse">다시 시도할게요...</p>
            )}
          </div>
        )}
        {/* 하단 액션 행: 종료 + 신고 */}
        {!feedback && !replacingQuestion && (
          <div className="flex justify-between items-center">
            <button
              onClick={() => goResult(true)}
              className="text-[10px] text-white/70 px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:text-white transition-all"
            >✕ 종료</button>
            {reportConfirm ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-gray-500">새로운 문제로 교체해드릴까요?</span>
                <button
                  onClick={replaceQuestion}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 hover:bg-amber-500/25 transition-all font-bold"
                >교체</button>
                <button
                  onClick={() => setReportConfirm(false)}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-gray-500 hover:text-gray-300 transition-all"
                >취소</button>
              </div>
            ) : (
              <button
                onClick={() => setReportConfirm(true)}
                className="text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
              >🚩 문제가 이상해요</button>
            )}
          </div>
        )}
        {replacingQuestion && (
          <div className="flex justify-end">
            <span className="text-[10px] text-gray-600 animate-pulse">문제 교체 중...</span>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
