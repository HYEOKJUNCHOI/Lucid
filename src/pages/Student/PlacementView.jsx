import { useState, useEffect, useRef } from 'react';
import { getApiKey } from '../../lib/apiKey';
import Toast, { showToast } from '../../components/common/Toast';

// ─── 배점 ──────────────────────────────────────────
const SCORE_MAP = { easy: 5, normal: 10, hard: 15 };
const MAX_SCORE = 100; // 5×2 + 10×6 + 15×2

// ─── 점수 → 배치 ───────────────────────────────────
const getPlacement = (score, totalFiles) => {
  if (score === MAX_SCORE) return { type: 'free', label: '만점 — 원하는 곳 자유 선택 🎉', color: '#fbbf24', idx: null };
  const ratio =
    score >= 70 ? 0.70 :
    score >= 45 ? 0.40 :
    score >= 20 ? 0.20 : 0.00;
  const idx = Math.min(Math.floor(totalFiles * ratio), totalFiles - 1);
  const label =
    score >= 70 ? '후반 챕터 배치 추천' :
    score >= 45 ? '중반 챕터 배치 추천' :
    score >= 20 ? '초반 챕터 배치 추천' : '처음부터 시작 추천';
  return { type: 'auto', label, color: '#4ec9b0', idx };
};

// ─── GPT 호출 ──────────────────────────────────────
const callGPT = async (apiKey, messages, systemPrompt) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1-nano',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

// ─── 메인 컴포넌트 ─────────────────────────────────
const PlacementView = ({ teacher, repo, chapters, chapterFilesMap, onBack, onPlaced }) => {
  const [phase, setPhase] = useState('intro'); // intro | loading | quiz | result
  const [loadingMsg, setLoadingMsg] = useState('');
  const [questions, setQuestions] = useState([]); // 총 10문제
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState([]); // { q, selected, correct, difficulty }
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, explanation }
  const [placement, setPlacement] = useState(null);
  const [allFiles, setAllFiles] = useState([]); // 레포 전체 파일 (flat)
  const feedbackTimerRef = useRef(null);

  // 전체 파일 목록 수집 (chapterFilesMap에서 flat)
  useEffect(() => {
    const flat = [];
    Object.values(chapterFilesMap || {}).forEach(files => {
      if (Array.isArray(files)) files.forEach(f => flat.push(f));
    });
    setAllFiles(flat);
  }, [chapterFilesMap]);

  // ─── 배치고사 시작 ─────────────────────────────────
  const startPlacement = async () => {
    const apiKey = getApiKey();
    if (!apiKey) { showToast('API 키가 설정되지 않았습니다.', 'warn'); return; }

    setPhase('loading');
    setLoadingMsg('랜덤 파일 선택 중...');

    try {
      // 1. 파일 풀 구성 (chapterFilesMap or GitHub API)
      let pool = [...allFiles];

      // chapterFilesMap이 비어있으면 chapters에서 직접 로드
      if (pool.length === 0 && chapters?.length > 0) {
        setLoadingMsg('파일 목록 불러오는 중...');
        for (const ch of chapters.slice(0, 5)) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${ch.path || ch.name}`
            );
            const items = await res.json();
            if (Array.isArray(items)) {
              const javaFiles = items.filter(f => f.name.endsWith('.java'));
              javaFiles.forEach(f => pool.push({ name: f.name, downloadUrl: f.download_url, path: f.path }));
            }
          } catch {}
        }
      }

      if (pool.length === 0) {
        showToast('파일을 불러올 수 없습니다. 챕터를 먼저 열어주세요.', 'warn');
        setPhase('intro');
        return;
      }

      // 2. 랜덤 파일 최대 4개 선택 (중복 없이)
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(4, shuffled.length));

      // 3. 파일 내용 fetch
      setLoadingMsg('코드 읽어오는 중...');
      const codeSnippets = await Promise.all(
        picked.map(async (f) => {
          try {
            const r = await fetch(f.downloadUrl);
            const text = await r.text();
            return `// 파일: ${f.name}\n${text.substring(0, 800)}`;
          } catch {
            return `// ${f.name}: 불러오기 실패`;
          }
        })
      );
      const combinedCode = codeSnippets.join('\n\n---\n\n');

      // 4. GPT로 10문제 생성 (쉬움2/보통6/어려움2)
      setLoadingMsg('배치고사 문제 출제 중...');
      const systemPrompt = `너는 코딩 교육 전문가야. 아래 Java 코드를 바탕으로 배치고사 문제를 출제해줘.

[요구사항]
- 쉬움(easy) 2문제: 기본 개념 확인, 변수/타입/출력 수준
- 보통(normal) 6문제: 제어문, 메서드, 클래스 수준
- 어려움(hard) 2문제: 상속, 다형성, 복잡한 로직 수준

[코드]
${combinedCode}

[출력 형식 — 반드시 유효한 JSON만]
{"questions":[
  {"difficulty":"easy","type":"multiple_choice","question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"},
  {"difficulty":"easy","type":"ox","question":"문제","options":["⭕ 맞다","❌ 틀리다"],"answer":"⭕ 맞다 또는 ❌ 틀리다","explanation":"해설"},
  ...
]}

[규칙]
1. 쉬움 2개, 보통 6개, 어려움 2개 정확히.
2. package/import 관련 문제 금지.
3. type은 "multiple_choice" 또는 "ox"만.
4. JSON 외 다른 텍스트 출력 금지.`;

      const raw = await callGPT(apiKey, [{ role: 'user', content: '10문제를 출제해줘.' }], systemPrompt);

      // JSON 파싱
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON 파싱 실패');
      const parsed = JSON.parse(jsonMatch[0]);
      const qs = parsed.questions || [];

      if (qs.length < 5) throw new Error('문제 수 부족');

      // 순서: 쉬움 → 보통 → 어려움
      const order = ['easy', 'normal', 'hard'];
      const sorted = order.flatMap(d => qs.filter(q => q.difficulty === d));

      setQuestions(sorted);
      setQIdx(0);
      setScore(0);
      setAnswers([]);
      setSelectedAnswer(null);
      setFeedback(null);
      setPhase('quiz');
    } catch (e) {
      console.error('배치고사 생성 실패:', e);
      showToast('문제 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      setPhase('intro');
    }
  };

  // ─── 답안 제출 ─────────────────────────────────────
  const handleAnswer = (opt) => {
    if (selectedAnswer || feedback) return;
    const q = questions[qIdx];
    const isCorrect = opt === q.answer;
    const gained = isCorrect ? SCORE_MAP[q.difficulty] : 0;

    setSelectedAnswer(opt);
    setFeedback({ correct: isCorrect, explanation: q.explanation });
    setScore(prev => prev + gained);
    setAnswers(prev => [...prev, { q: q.question, selected: opt, correct: isCorrect, difficulty: q.difficulty }]);

    feedbackTimerRef.current = setTimeout(() => {
      if (qIdx + 1 >= questions.length) {
        // 퀴즈 종료 → 결과 (placement는 result 렌더 시 answers로 재계산)
        setPhase('result');
      } else {
        setQIdx(prev => prev + 1);
        setSelectedAnswer(null);
        setFeedback(null);
      }
    }, 1800);
  };

  // 언마운트 시 타이머 정리
  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  // ─── 난이도 뱃지 ───────────────────────────────────
  const DiffBadge = ({ d }) => {
    const map = { easy: ['쉬움', '#4ec9b0'], normal: ['보통', '#fbbf24'], hard: ['어려움', '#ef4444'] };
    const [label, color] = map[d] || ['?', '#888'];
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>
        {label}
      </span>
    );
  };

  // ─── RENDER ────────────────────────────────────────
  const renderPhase = () => {

  // ─── INTRO ─────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <div className="max-w-md w-full mx-4">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f59e0b]/25 to-[#f97316]/15 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <span className="text-2xl">🎯</span>
          </div>
          <h2 className="text-xl font-black text-white mb-2">배치고사</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            실력에 맞는 학습 위치를 찾아드립니다
          </p>
        </div>

        {/* 문제 구성 */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 mb-6">
          <p className="text-[11px] text-gray-500 font-bold mb-3 tracking-widest">문제 구성</p>
          <div className="space-y-2.5">
            {[
              { d: 'easy',   label: '쉬움', count: 2, pt: 5,  color: '#4ec9b0' },
              { d: 'normal', label: '보통', count: 6, pt: 10, color: '#fbbf24' },
              { d: 'hard',   label: '어려움', count: 2, pt: 15, color: '#ef4444' },
            ].map(({ label, count, pt, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color }}>{label}</span>
                  <span className="text-xs text-gray-500">{count}문제</span>
                </div>
                <span className="text-xs text-gray-400">{pt}점 × {count} = <span className="font-bold text-white">{pt * count}점</span></span>
              </div>
            ))}
            <div className="border-t border-[#222] pt-2 mt-2 flex justify-between">
              <span className="text-xs text-gray-500">총 만점</span>
              <span className="text-sm font-black text-[#fbbf24]">100점</span>
            </div>
          </div>
        </div>

        {/* 배치 기준 */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5 mb-6">
          <p className="text-[11px] text-gray-500 font-bold mb-3 tracking-widest">배치 기준</p>
          <div className="space-y-1.5 text-xs text-gray-400">
            <div className="flex justify-between"><span>100점 (만점)</span><span className="text-[#fbbf24] font-bold">원하는 곳 자유 선택 🎉</span></div>
            <div className="flex justify-between"><span>70~99점</span><span className="text-gray-300">후반 챕터 추천</span></div>
            <div className="flex justify-between"><span>45~69점</span><span className="text-gray-300">중반 챕터 추천</span></div>
            <div className="flex justify-between"><span>20~44점</span><span className="text-gray-300">초반 챕터 추천</span></div>
            <div className="flex justify-between"><span>0~19점</span><span className="text-gray-300">처음부터 추천</span></div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl text-sm font-bold border border-[#333] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            돌아가기
          </button>
          <button
            onClick={startPlacement}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 hover:bg-[#f59e0b]/25 transition-all"
          >
            시작하기 →
          </button>
        </div>
      </div>
    </div>
  );

  // ─── LOADING ───────────────────────────────────────
  if (phase === 'loading') return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#f59e0b]/30 border-t-[#f59e0b] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-400">{loadingMsg}</p>
      </div>
    </div>
  );

  // ─── QUIZ ──────────────────────────────────────────
  if (phase === 'quiz') {
    const q = questions[qIdx];
    if (!q) return null;
    const optColors = ['#4ec9b0', '#569cd6', '#dcdcaa', '#c586c0'];

    return (
      <div className="w-full h-full flex flex-col bg-[#0d0d0d]">
        {/* 상단 진행바 */}
        <div className="px-6 py-3 border-b border-[#1a1a1a] flex items-center gap-3">
          <button onClick={onBack} className="text-gray-600 hover:text-gray-300 transition-colors text-xs">← 나가기</button>
          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] rounded-full transition-all duration-500"
              style={{ width: `${((qIdx) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-500 font-bold">{qIdx + 1} / {questions.length}</span>
        </div>

        {/* 문제 영역 */}
        <div className="flex-1 overflow-auto flex items-start justify-center px-4 py-8">
          <div className="w-full max-w-lg">
            {/* 난이도 + 점수 */}
            <div className="flex items-center gap-2 mb-4">
              <DiffBadge d={q.difficulty} />
              <span className="text-[10px] text-gray-600">+{SCORE_MAP[q.difficulty]}점</span>
              <span className="ml-auto text-[11px] text-gray-500 font-bold">누적 {score}점</span>
            </div>

            {/* 문제 텍스트 */}
            <p className="text-sm text-gray-200 font-semibold mb-6 leading-relaxed">{q.question}</p>

            {/* 선택지 */}
            <div className="space-y-2.5">
              {q.options?.map((opt, i) => {
                const color = optColors[i % optColors.length];
                let bg = 'bg-white/[0.03]';
                let border = 'border-white/10';
                let textColor = 'text-gray-300';
                if (selectedAnswer) {
                  if (opt === q.answer) { bg = 'bg-[#4ec9b0]/10'; border = 'border-[#4ec9b0]/50'; textColor = 'text-[#4ec9b0]'; }
                  else if (opt === selectedAnswer) { bg = 'bg-red-500/10'; border = 'border-red-500/40'; textColor = 'text-red-400'; }
                  else { textColor = 'text-gray-600'; }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!selectedAnswer}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${bg} ${border} ${textColor} ${!selectedAnswer ? 'hover:-translate-y-0.5 hover:bg-white/[0.06] cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="font-bold mr-2" style={{ color: selectedAnswer ? undefined : color }}>
                      {['①', '②', '③', '④'][i]}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* 피드백 */}
            {feedback && (
              <div className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${
                feedback.correct
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0]'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <span className="font-bold mr-1">{feedback.correct ? '✅ 정답!' : '❌ 오답'}</span>
                {feedback.explanation}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT ────────────────────────────────────────
  if (phase === 'result') {
    const finalScore = answers.reduce((acc, a) => acc + (a.correct ? SCORE_MAP[a.difficulty] : 0), 0);
    const pl = placement || getPlacement(finalScore, allFiles.length || 20);
    const correct = answers.filter(a => a.correct).length;
    const pct = Math.round((finalScore / MAX_SCORE) * 100);

    return (
      <div className="w-full h-full overflow-auto bg-[#0d0d0d] flex items-center justify-center">
        <div className="max-w-md w-full mx-4 py-8">
          {/* 점수 원 */}
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center mx-auto mb-4"
              style={{ borderColor: pl.color, boxShadow: `0 0 30px ${pl.color}40` }}>
              <span className="text-2xl font-black text-white">{finalScore}</span>
            </div>
            <p className="text-lg font-black text-white">{correct} / {questions.length} 정답</p>
            <p className="text-sm text-gray-400 mt-1">{pct}% 달성</p>
          </div>

          {/* 배치 결과 */}
          <div className="rounded-2xl border p-5 mb-6 text-center"
            style={{ background: `${pl.color}0d`, borderColor: `${pl.color}30` }}>
            <p className="text-[11px] text-gray-500 mb-2 font-bold tracking-widest">배치 결과</p>
            <p className="text-base font-black" style={{ color: pl.color }}>{pl.label}</p>
            {pl.type === 'free' && (
              <p className="text-xs text-gray-400 mt-2">아래 버튼으로 원하는 챕터를 선택하세요</p>
            )}
          </div>

          {/* 오답 요약 */}
          {answers.some(a => !a.correct) && (
            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-6">
              <p className="text-[11px] text-gray-500 font-bold mb-3 tracking-widest">틀린 문제</p>
              <div className="space-y-2">
                {answers.filter(a => !a.correct).map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <DiffBadge d={a.difficulty} />
                    <span className="leading-relaxed line-clamp-2">{a.q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl text-sm font-bold border border-[#333] text-gray-400 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              홈으로
            </button>
            <button
              onClick={() => onPlaced({ score: finalScore, placement: pl })}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
              style={{ background: `${pl.color}20`, color: pl.color, border: `1px solid ${pl.color}40` }}
            >
              {pl.type === 'free' ? '챕터 선택하기 →' : '배치 적용하기 →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
  }; // end renderPhase

  return (
    <>
      <Toast />
      {renderPhase()}
    </>
  );
};

export default PlacementView;
