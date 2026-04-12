/**
 * PlacementQuiz — 과목 배치고사
 * 10문제 / 3하트 / 적응형 난이도 / 레벨 점프
 * XP_SYSTEM.md 기준: 쉬움×2=10pt, 보통×6=60pt, 어려움×2=50pt, 만점120pt
 */
import { useState, useEffect, useRef } from 'react';
import { getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, GEMINI_CHAT_URL } from '../../lib/aiConfig';

// ─── 상수 ────────────────────────────────────────────
const SCORE_MAP = { easy: 5, normal: 10, hard: 25 };
const MAX_SCORE = 120; // 2×5 + 6×10 + 2×25

const DIFF = {
  easy:   { label: '쉬움',   emoji: '🟢', color: '#4ec9b0' },
  normal: { label: '보통',   emoji: '🟡', color: '#fbbf24' },
  hard:   { label: '어려움', emoji: '🔴', color: '#ef4444' },
};

const TIERS = [
  { id: 'iron',     label: '아이언',   color: '#9ca3af' },
  { id: 'bronze',   label: '브론즈',   color: '#CD7F32' },
  { id: 'silver',   label: '실버',     color: '#C0C0C0' },
  { id: 'gold',     label: '골드',     color: '#FFD700',  glow: '0 0 8px rgba(255,215,0,0.5)' },
  { id: 'platinum', label: '플래티넘', color: '#E5E4E2',  glow: '0 0 8px rgba(229,228,226,0.4)' },
  { id: 'diamond',  label: '다이아',   color: '#67E8F9',  glow: '0 0 12px rgba(103,232,249,0.6)' },
];

const getLevelJump = (score) => {
  if (score >= 108) return { jump: 5, label: '+5 레벨 점프', color: '#a78bfa', icon: '🚀' };
  if (score >= 96)  return { jump: 4, label: '+4 레벨 점프', color: '#60a5fa', icon: '⚡' };
  if (score >= 84)  return { jump: 3, label: '+3 레벨 점프', color: '#34d399', icon: '✨' };
  if (score >= 72)  return { jump: 2, label: '+2 레벨',      color: '#fbbf24', icon: '⬆️' };
  if (score >= 60)  return { jump: 1, label: '+1 레벨',      color: '#9ca3af', icon: '▲' };
  return { jump: 0, label: '실패 — 재도전 가능', color: '#ef4444', icon: '💪' };
};

// ─── Gemini 호출 ─────────────────────────────────────
const callGemini = async (prompt) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API 키 없음');
  const url = `${GEMINI_CHAT_URL(MODELS.GEMINI_QUIZ)}?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const buildPrompt = (code) => `
아래 코드/내용을 기반으로 배치고사 문제 10개를 만들어라.

[구성 — 반드시 순서대로]
- 쉬움(easy) 2문제: 기초 개념, 변수/타입/기본 문법 수준
- 보통(normal) 6문제: 제어문, 메서드, 클래스 수준
- 어려움(hard) 2문제: 상속, 다형성, 복잡한 로직 수준

[규칙]
1. 모두 4지선다로만 출제 (fill_blank 금지)
2. 정답이 명확하고 애매하지 않을 것
3. package/import 관련 문제 금지
4. 각 선택지는 "①...", "②...", "③...", "④..." 형식

[코드]
\`\`\`
${code.substring(0, 3000)}
\`\`\`

[출력 — JSON만, 다른 텍스트 없이]
{"questions":[
  {"difficulty":"easy","question":"문제 텍스트","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트 (①... 포함)","explanation":"해설"},
  ...10개...
]}`;

// ─── 하트 표시 ────────────────────────────────────────
const Hearts = ({ count, restored }) => (
  <div className="flex items-center gap-1">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="text-lg leading-none transition-all duration-300"
        style={{
          filter: i < count ? (restored && i > 0 ? 'drop-shadow(0 0 6px #ef4444)' : 'none') : 'grayscale(1) opacity(0.3)',
          transform: restored && i > 0 ? 'scale(1.2)' : 'scale(1)',
        }}
      >❤️</span>
    ))}
  </div>
);

// ─── 메인 컴포넌트 ─────────────────────────────────────
export default function PlacementQuiz({ subjectLabel, subjectColor, subjectIcon, code, onDone, onBack }) {
  const [phase, setPhase]           = useState('intro');
  const [questions, setQuestions]   = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [hearts, setHearts]         = useState(3);
  const [score, setScore]           = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback]     = useState(null); // { correct, explanation, gameOver? }
  const [answers, setAnswers]       = useState([]);
  const [heartRestored, setHeartRestored] = useState(false);
  const [screenFlash, setScreenFlash]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (phase === 'quiz') panelRef.current?.focus();
  }, [phase, currentIdx]);

  // ─── 퀴즈 시작 ────────────────────────────────────
  const startQuiz = async () => {
    setPhase('loading');
    setErrorMsg('');
    const msgs = ['코드 분석 중...', '난이도 조정 중...', '문제 출제 중...'];
    let mi = 0;
    setLoadingMsg(msgs[mi]);
    const interval = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadingMsg(msgs[mi]); }, 900);
    try {
      const raw = await callGemini(buildPrompt(code));
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr.match(/\{[\s\S]*\}/)?.[0] || jsonStr);
      const qs = (parsed.questions || []).slice(0, 10);
      if (qs.length < 8) throw new Error('문제 수 부족');
      setQuestions(qs);
      setCurrentIdx(0);
      setHearts(3);
      setScore(0);
      setAnswers([]);
      setSelectedAnswer(null);
      setFeedback(null);
      setHeartRestored(false);
      setPhase('quiz');
    } catch (e) {
      setErrorMsg('문제 생성 실패. 다시 시도해주세요.');
      setPhase('intro');
    } finally {
      clearInterval(interval);
    }
  };

  // ─── 답 선택 ──────────────────────────────────────
  const handleAnswer = (opt) => {
    if (selectedAnswer || feedback) return;
    const q = questions[currentIdx];
    const isCorrect = opt === q.answer;
    setSelectedAnswer(opt);

    const newAnswers = [...answers, { correct: isCorrect, difficulty: q.difficulty, question: q.question }];
    setAnswers(newAnswers);

    if (isCorrect) {
      setScore(s => s + (SCORE_MAP[q.difficulty] || 10));
      if (hearts === 1) {
        setHearts(3);
        setHeartRestored(true);
        setTimeout(() => setHeartRestored(false), 1800);
      }
      setFeedback({ correct: true, explanation: q.explanation });
    } else {
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 350);
      if (newHearts === 0) {
        setFeedback({ correct: false, explanation: q.explanation, gameOver: true });
      } else {
        setFeedback({ correct: false, explanation: q.explanation });
      }
    }
  };

  // ─── 다음 문제 ────────────────────────────────────
  const goNext = () => {
    if (feedback?.gameOver || currentIdx >= questions.length - 1) {
      setPhase('result');
      return;
    }
    setCurrentIdx(i => i + 1);
    setSelectedAnswer(null);
    setFeedback(null);
  };

  // ─── 키보드 ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (phase !== 'quiz') return;
      if (feedback) {
        if (e.key === 'Enter') goNext();
        return;
      }
      const q = questions[currentIdx];
      if (!q) return;
      const numIdx = ['1', '2', '3', '4'].indexOf(e.key);
      if (numIdx >= 0 && numIdx < (q.options || []).length) {
        handleAnswer(q.options[numIdx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, feedback, currentIdx, questions, hearts, answers, score]);

  // ══════════════════════════════════════════════════
  // INTRO
  if (phase === 'intro') return (
    <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ overflowY: 'auto' }}>
      <div className="w-full max-w-md">
        {/* 과목 헤더 */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl"
            style={{ background: `${subjectColor}18`, border: `1px solid ${subjectColor}40`, boxShadow: `0 0 24px ${subjectColor}20` }}
          >
            {subjectIcon}
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              🎯 배치고사
            </span>
          </div>
          <h2 className="text-2xl font-black text-white mt-2">{subjectLabel}</h2>
          <p className="text-[13px] text-gray-400 mt-1">실력을 확인하고 레벨을 점프하세요</p>
        </div>

        {/* 문제 구성 */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#111', border: '1px solid #222' }}>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-3">문제 구성 (총 10문제 / 만점 120점)</p>
          <div className="space-y-2">
            {[
              { d: 'easy',   count: 2, pt: 5  },
              { d: 'normal', count: 6, pt: 10 },
              { d: 'hard',   count: 2, pt: 25 },
            ].map(({ d, count, pt }) => {
              const { emoji, label, color } = DIFF[d];
              return (
                <div key={d} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{emoji}</span>
                    <span className="text-[12px] font-bold" style={{ color }}>{label}</span>
                    <span className="text-[11px] text-gray-600">{count}문제</span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {pt}점 × {count} = <span className="font-bold text-white">{pt * count}점</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 레벨 점프 기준 */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#111', border: '1px solid #222' }}>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-3">레벨 점프 기준</p>
          <div className="space-y-1.5 text-[11px]">
            {[
              { range: '108~120점', jump: '+5 레벨', color: '#a78bfa' },
              { range: '96~107점',  jump: '+4 레벨', color: '#60a5fa' },
              { range: '84~95점',   jump: '+3 레벨', color: '#34d399' },
              { range: '72~83점',   jump: '+2 레벨', color: '#fbbf24' },
              { range: '60~71점',   jump: '+1 레벨', color: '#9ca3af' },
              { range: '60점 미만', jump: '실패',    color: '#ef4444' },
            ].map(({ range, jump, color }) => (
              <div key={range} className="flex justify-between">
                <span className="text-gray-400">{range}</span>
                <span className="font-bold" style={{ color }}>{jump}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 규칙 */}
        <div className="rounded-2xl p-4 mb-6" style={{ background: '#111', border: '1px solid #222' }}>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">규칙</p>
          <div className="space-y-1.5 text-[12px] text-gray-400">
            <p>❤️ 하트 3개 — 3번 틀리면 <span className="text-[#ef4444]">강제 종료</span></p>
            <p>✨ 하트 1개 남을 때 정답 맞추면 <span className="text-[#fbbf24]">하트 전부 복구</span></p>
            <p>📈 맞출수록 <span className="text-white">점점 어려워지는</span> 문제</p>
          </div>
        </div>

        {errorMsg && (
          <div className="text-[11px] text-red-400 text-center mb-4 bg-red-500/10 rounded-xl px-4 py-2 border border-red-500/20">
            {errorMsg}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3.5 rounded-2xl text-[13px] font-bold text-gray-400 hover:text-white transition-all"
            style={{ border: '1px solid #333' }}
          >
            돌아가기
          </button>
          <button
            onClick={startQuiz}
            className="flex-1 py-3.5 rounded-2xl text-[14px] font-black text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${subjectColor}30, ${subjectColor}18)`,
              border: `1px solid ${subjectColor}50`,
              boxShadow: `0 0 20px ${subjectColor}15`,
            }}
          >
            시작하기 →
          </button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════
  // LOADING
  if (phase === 'loading') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 select-none">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-[3px] animate-spin"
          style={{ borderColor: `${subjectColor}20`, borderTopColor: subjectColor }} />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">{subjectIcon}</div>
      </div>
      <p className="text-[13px] text-gray-400 animate-pulse">{loadingMsg}</p>
    </div>
  );

  // ══════════════════════════════════════════════════
  // RESULT
  if (phase === 'result') {
    const finalScore = answers.filter(a => a.correct).reduce((acc, a) => acc + (SCORE_MAP[a.difficulty] || 0), 0);
    const { jump, label: jumpLabel, color: jumpColor, icon: jumpIcon } = getLevelJump(finalScore);
    const correctCount = answers.filter(a => a.correct).length;
    const pct = Math.round((finalScore / MAX_SCORE) * 100);
    const earlyEnd = hearts === 0;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ overflowY: 'auto' }}>
        <div className="w-full max-w-md">
          {/* 결과 헤더 */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{jump >= 3 ? '🏆' : jump >= 1 ? '🎯' : '💪'}</div>
            <p className="text-[22px] font-black text-white mb-1">{finalScore}점 / {MAX_SCORE}점</p>
            <p className="text-[13px] text-gray-500">{correctCount}/{answers.length}문제 정답 · {pct}%</p>
            {earlyEnd && (
              <p className="text-[12px] text-red-400 mt-2 font-bold">하트 소진으로 조기 종료</p>
            )}
          </div>

          {/* 진행 바 */}
          <div className="rounded-full h-2.5 mb-6 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${subjectColor}, ${jumpColor})` }}
            />
          </div>

          {/* 레벨 점프 결과 */}
          <div
            className="rounded-2xl p-5 mb-4 text-center"
            style={{ background: `${jumpColor}12`, border: `1px solid ${jumpColor}35`, boxShadow: jump >= 3 ? `0 0 24px ${jumpColor}20` : 'none' }}
          >
            <p className="text-3xl mb-2">{jumpIcon}</p>
            <p className="text-[20px] font-black" style={{ color: jumpColor }}>{jumpLabel}</p>
            {jump > 0 && (
              <p className="text-[12px] text-gray-400 mt-1">다음 문제지옥부터 상위 레벨 문제가 출제됩니다</p>
            )}
            {jump === 0 && (
              <p className="text-[12px] text-gray-400 mt-1">60점 이상이면 레벨 점프가 가능합니다</p>
            )}
          </div>

          {/* 난이도별 결과 */}
          <div className="rounded-2xl p-4 mb-6" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-3">난이도별 결과</p>
            {(['easy', 'normal', 'hard']).map(d => {
              const total = answers.filter(a => a.difficulty === d).length;
              const correct = answers.filter(a => a.difficulty === d && a.correct).length;
              if (total === 0) return null;
              const { emoji, label, color } = DIFF[d];
              return (
                <div key={d} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span>{emoji}</span>
                    <span className="text-[12px] font-bold" style={{ color }}>{label}</span>
                  </div>
                  <span className="text-[12px] text-gray-400">
                    <span className="text-white font-bold">{correct}</span> / {total}
                    <span className="ml-2 font-mono" style={{ color: correct === total ? '#4ec9b0' : '#9ca3af' }}>
                      +{correct * (SCORE_MAP[d] || 0)}점
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-3.5 rounded-2xl text-[13px] font-bold text-gray-400 hover:text-white transition-all"
              style={{ border: '1px solid #333' }}
            >
              과목 선택
            </button>
            {jump === 0 && (
              <button
                onClick={() => {
                  setPhase('intro');
                  setQuestions([]);
                  setAnswers([]);
                }}
                className="flex-1 py-3.5 rounded-2xl text-[13px] font-black text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}
              >
                🔄 재도전
              </button>
            )}
            {jump > 0 && (
              <button
                onClick={() => onDone?.({ score: finalScore, jump })}
                className="flex-1 py-3.5 rounded-2xl text-[13px] font-black text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, ${subjectColor}30, ${subjectColor}18)`,
                  border: `1px solid ${subjectColor}50`,
                }}
              >
                퀴즈 시작 →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // QUIZ
  const q = questions[currentIdx];
  if (!q) return null;
  const { emoji: diffEmoji, label: diffLabel, color: diffColor } = DIFF[q.difficulty] || DIFF.normal;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className={`flex-1 flex flex-col outline-none transition-colors duration-200 ${screenFlash ? 'bg-red-500/[0.07]' : ''}`}
    >
      {/* 상단 바: 하트 + 진행 + 난이도 */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Hearts count={hearts} restored={heartRestored} />

        {/* 진행 바 */}
        <div className="flex-1 mx-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-600">{currentIdx + 1} / {questions.length}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((currentIdx + 1) / questions.length) * 100}%`, background: `linear-gradient(90deg, ${subjectColor}, ${diffColor})` }}
            />
          </div>
        </div>

        {/* 난이도 뱃지 */}
        <span className="text-[10px] font-black px-2.5 py-1 rounded-full shrink-0"
          style={{ background: `${diffColor}18`, color: diffColor, border: `1px solid ${diffColor}35` }}>
          {diffEmoji} {diffLabel}
        </span>
      </div>

      {/* 문제 영역 */}
      <div className="flex-1 flex flex-col px-5 py-5 max-w-2xl mx-auto w-full" style={{ overflowY: 'auto' }}>
        {/* 점수 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] text-gray-600">현재 점수</span>
          <span className="text-[13px] font-black" style={{ color: subjectColor }}>{score}점</span>
        </div>

        {/* 문제 */}
        <div className="rounded-2xl p-5 mb-5 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[14px] text-white font-bold leading-relaxed">{q.question}</p>
        </div>

        {/* 선택지 */}
        <div className="flex flex-col gap-2.5 mb-4">
          {(q.options || []).map((opt, i) => {
            const isSelected = selectedAnswer === opt;
            const isCorrect = feedback && opt === q.answer;
            const isWrong = feedback && isSelected && !feedback.correct;
            const numKey = ['1', '2', '3', '4'][i];

            let style = {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.75)',
            };
            if (isCorrect) style = { background: 'rgba(78,201,176,0.12)', border: '1px solid rgba(78,201,176,0.5)', color: '#4ec9b0' };
            else if (isWrong) style = { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' };
            else if (isSelected) style = { background: `${subjectColor}15`, border: `1px solid ${subjectColor}50`, color: subjectColor };

            return (
              <button
                key={i}
                onClick={() => handleAnswer(opt)}
                disabled={!!selectedAnswer}
                className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-default"
                style={style}
              >
                <kbd className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>
                  {numKey}
                </kbd>
                <span className="text-[13px] font-medium leading-snug">{opt}</span>
                {isCorrect && <span className="ml-auto text-[#4ec9b0] font-black shrink-0">✓</span>}
                {isWrong && <span className="ml-auto text-[#ef4444] shrink-0">✗</span>}
              </button>
            );
          })}
        </div>

        {/* 피드백 */}
        {feedback && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{
              background: feedback.correct ? 'rgba(78,201,176,0.07)' : 'rgba(239,68,68,0.07)',
              border: `1px solid ${feedback.correct ? 'rgba(78,201,176,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            <p className="text-[12px] font-black mb-1.5" style={{ color: feedback.correct ? '#4ec9b0' : '#ef4444' }}>
              {feedback.correct ? '✓ 정답!' : feedback.gameOver ? '💔 하트 소진 — 배치고사 종료' : `✗ 오답 — 하트 ${hearts}개 남음`}
              {heartRestored && <span className="ml-2 text-[#fbbf24]">❤️ 하트 복구!</span>}
            </p>
            {feedback.explanation && (
              <p className="text-[12px] text-gray-400 leading-relaxed">{feedback.explanation}</p>
            )}
          </div>
        )}

        {/* 다음 버튼 */}
        {feedback && (
          <button
            onClick={goNext}
            className="w-full py-3 rounded-xl text-[13px] font-black text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: feedback.gameOver
                ? 'rgba(239,68,68,0.15)'
                : `linear-gradient(135deg, ${subjectColor}25, ${subjectColor}15)`,
              border: `1px solid ${feedback.gameOver ? 'rgba(239,68,68,0.35)' : `${subjectColor}40`}`,
            }}
          >
            {feedback.gameOver ? '결과 확인 →' : currentIdx >= questions.length - 1 ? '결과 확인 →' : '다음 문제 →'}
            <span className="ml-2 text-[10px] opacity-50">(Enter)</span>
          </button>
        )}
      </div>
    </div>
  );
}
