import { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getApiKey } from '../../lib/apiKey';
import { MODELS, OPENAI_CHAT_URL } from '../../lib/aiConfig';
import Toast, { showToast } from '../../components/common/Toast';

const LANG_NAMES_D = ['python', 'java', 'javascript', 'js', 'sql', 'html', 'css', 'bash', 'c', 'cpp', 'kotlin'];
const renderQuestionD = (q) => {
  const codeMatch = q.match(/```(\w*)\n?([\s\S]*?)```/);
  if (codeMatch) {
    const before = q.substring(0, codeMatch.index).trim();
    const lang = codeMatch[1] || 'java';
    const body = codeMatch[2].trim();
    const after = q.substring(codeMatch.index + codeMatch[0].length).trim();
    return (<>
      {before && <p className="text-white font-bold text-[15px] leading-relaxed mb-3">{before}</p>}
      <div className="rounded-xl overflow-hidden mb-2 border border-white/[0.06]"><SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin:0, padding:'1rem', fontSize:'12px', background:'#1e1e1e', borderRadius:'0.75rem' }} wrapLongLines>{body}</SyntaxHighlighter></div>
      {after && <p className="text-white font-bold text-[15px] leading-relaxed">{after}</p>}
    </>);
  }
  const langRe = new RegExp(`^([\\s\\S]*?)\\n(${LANG_NAMES_D.join('|')})\\n([\\s\\S]+)$`, 'i');
  const langMatch = q.match(langRe);
  if (langMatch) {
    const before = langMatch[1].trim();
    const lang = langMatch[2].toLowerCase() === 'js' ? 'javascript' : langMatch[2].toLowerCase();
    const code = langMatch[3].trim();
    return (<>
      {before && <p className="text-white font-bold text-[15px] leading-relaxed mb-3">{before}</p>}
      <div className="rounded-xl overflow-hidden border border-white/[0.06]"><SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin:0, padding:'1rem', fontSize:'12px', background:'#1e1e1e', borderRadius:'0.75rem' }} wrapLongLines>{code}</SyntaxHighlighter></div>
    </>);
  }
  const isPy = /(def |for .* in |if .*:|print\(|import )/.test(q);
  const isJava = /[{};]/.test(q);
  if ((isPy || isJava) && q.includes('\n')) {
    const lines = q.split('\n'); const tl = [], cl = []; let started = false;
    for (const l of lines) {
      if (!started && /^[가-힣\s?!.,]*$/.test(l.trim())) tl.push(l);
      else { started = true; cl.push(l); }
    }
    return (<>
      {tl.length > 0 && <p className="text-white font-bold text-[15px] leading-relaxed mb-3">{tl.join('\n')}</p>}
      <div className="rounded-xl overflow-hidden border border-white/[0.06]"><SyntaxHighlighter language={isPy ? 'python' : 'java'} style={vscDarkPlus} customStyle={{ margin:0, padding:'1rem', fontSize:'12px', background:'#1e1e1e', borderRadius:'0.75rem' }} wrapLongLines>{cl.join('\n') || q}</SyntaxHighlighter></div>
    </>);
  }
  return <p className="text-white font-bold text-[15px] leading-relaxed">{q}</p>;
};

// ─── GPT 호출 ──────────────────────────────────────
const callGPT = async (apiKey, systemPrompt, userMsg) => {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODELS.CHAT,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
};

// ─── 파일 1개 코드 fetch ────────────────────────────
const fetchCode = async (file) => {
  try {
    const r = await fetch(file.downloadUrl);
    const text = await r.text();
    return text.substring(0, 800);
  } catch {
    return '';
  }
};

// ─── GitHub 챕터 파일 목록 fetch ──────────────────────
const fetchChapterFiles = async (teacher, repoName, chapterPath) => {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${teacher.githubUsername}/${repoName}/contents/${chapterPath}`
    );
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter(f => f.name.endsWith('.java') || f.name.endsWith('.js') || f.name.endsWith('.py'))
      .map(f => ({ name: f.name, downloadUrl: f.download_url, path: f.path }));
  } catch {
    return [];
  }
};

// ─── 챕터별 점수 → 레벨 평가 ─────────────────────────
const getOverallEval = (ratio) => {
  if (ratio >= 0.9) return { label: '최상 — 심화 챕터 도전 추천', color: '#ffd700', icon: '🏆' };
  if (ratio >= 0.7) return { label: '양호 — 현재 진도 유지', color: '#4ec9b0', icon: '✅' };
  if (ratio >= 0.5) return { label: '보통 — 약한 챕터 복습 필요', color: '#fbbf24', icon: '📚' };
  return { label: '기초 부족 — 처음부터 재학습 추천', color: '#ef4444', icon: '🔄' };
};

// ─── 메인 컴포넌트 ─────────────────────────────────
const DiagnosisView = ({ teacher, repo, chapters, chapterFilesMap, onBack }) => {
  const [phase, setPhase] = useState('intro'); // intro | loading | quiz | result
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0); // 0~100
  const [questions, setQuestions] = useState([]); // { chapter, question, options, answer, explanation }
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // { chapterName, correct }
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, explanation }
  const feedbackTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(feedbackTimerRef.current), []);

  // ─── 진단 시작 ─────────────────────────────────────
  const startDiagnosis = async () => {
    const apiKey = getApiKey();
    if (!apiKey) { showToast('API 키가 설정되지 않았습니다.', 'warn'); return; }
    if (!chapters || chapters.length === 0) { showToast('챕터를 먼저 불러와주세요.', 'warn'); return; }

    setPhase('loading');
    setLoadingProgress(0);

    const questionsPerChapter = chapters.length <= 5 ? 2 : 1;
    const targetChapters = chapters.slice(0, 20); // 최대 20챕터

    try {
      // 챕터별 파일 수집
      setLoadingMsg('챕터별 파일 불러오는 중...');
      const chapterData = await Promise.all(
        targetChapters.map(async (ch, i) => {
          let files = chapterFilesMap[ch.name] || [];
          if (files.length === 0) {
            files = await fetchChapterFiles(teacher, repo.name, ch.path || ch.name);
          }
          setLoadingProgress(Math.round(((i + 1) / targetChapters.length) * 40));
          return { chapter: ch.name, files };
        })
      );

      // 파일 없는 챕터 제거
      const valid = chapterData.filter(c => c.files.length > 0);
      if (valid.length === 0) {
        showToast('파일을 불러올 수 없습니다. 챕터를 먼저 열어주세요.', 'warn');
        setPhase('intro');
        return;
      }

      // 챕터별 랜덤 파일 1개 선택 + 코드 fetch
      setLoadingMsg('코드 읽어오는 중...');
      const withCode = await Promise.all(
        valid.map(async ({ chapter, files }) => {
          const picked = files[Math.floor(Math.random() * files.length)];
          const code = await fetchCode(picked);
          return { chapter, fileName: picked.name, code };
        })
      );
      setLoadingProgress(60);

      // 챕터별 문제 생성 (병렬)
      setLoadingMsg(`${valid.length}개 챕터 문제 출제 중...`);
      const allQuestions = [];
      await Promise.all(
        withCode.map(async ({ chapter, fileName, code }, i) => {
          if (!code) return;
          const systemPrompt = `너는 Java 코딩 교육 전문가야. 아래 코드를 바탕으로 객관식 문제 ${questionsPerChapter}개를 출제해줘.

[코드 파일: ${fileName}]
${code}

[출력 형식 — 반드시 유효한 JSON만]
{"questions":[{"question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설 1문장"}]}

[규칙]
1. package/import 문제 금지.
2. JSON 외 다른 텍스트 출력 금지.
3. 정답은 options 중 하나와 정확히 동일해야 함.`;

          try {
            const raw = await callGPT(apiKey, systemPrompt, `${questionsPerChapter}문제 출제해줘.`);
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) return;
            const parsed = JSON.parse(match[0]);
            (parsed.questions || []).forEach(q => {
              if (q.question && q.options?.length >= 2 && q.answer) {
                allQuestions.push({ chapter, ...q });
              }
            });
          } catch {}
          setLoadingProgress(60 + Math.round(((i + 1) / withCode.length) * 38));
        })
      );

      if (allQuestions.length < 3) {
        showToast('문제 생성에 실패했습니다. 다시 시도해주세요.', 'error');
        setPhase('intro');
        return;
      }

      setLoadingProgress(100);
      setQuestions(allQuestions);
      setQIdx(0);
      setAnswers([]);
      setSelectedAnswer(null);
      setFeedback(null);
      setPhase('quiz');
    } catch (e) {
      console.error('전체 레벨 진단 실패:', e);
      showToast('진단 생성에 실패했습니다. 다시 시도해주세요.', 'error');
      setPhase('intro');
    }
  };

  // ─── 답안 제출 ─────────────────────────────────────
  const handleAnswer = (opt) => {
    if (selectedAnswer || feedback) return;
    const q = questions[qIdx];
    const isCorrect = opt === q.answer;
    setSelectedAnswer(opt);
    setFeedback({ correct: isCorrect, explanation: q.explanation });
    setAnswers(prev => [...prev, { chapterName: q.chapter, correct: isCorrect }]);

    feedbackTimerRef.current = setTimeout(() => {
      if (qIdx + 1 >= questions.length) {
        setPhase('result');
      } else {
        setQIdx(prev => prev + 1);
        setSelectedAnswer(null);
        setFeedback(null);
      }
    }, 1600);
  };

  // ─── RENDER ────────────────────────────────────────
  const renderPhase = () => {

  // ─── INTRO ─────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#569cd6]/25 to-[#4ec9b0]/15 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(86,156,214,0.2)]">
            <span className="text-2xl">🔬</span>
          </div>
          <h2 className="text-xl font-black text-white mb-2">전체 레벨 진단</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            모든 챕터에서 문제를 출제해 강점과 약점을 분석합니다
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-6 space-y-3">
          {[
            ['📚', `${chapters?.length || 0}개 챕터`, '각 챕터에서 파일 1개 샘플링'],
            ['📝', `챕터당 ${chapters?.length <= 5 ? 2 : 1}문제`, '총 최대 20문제'],
            ['📊', '챕터별 점수 분석', '강점/약점 챕터 한눈에 확인'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-lg shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-white/[0.08] text-gray-400 text-sm font-bold hover:text-white hover:border-white/20 transition-all"
          >
            돌아가기
          </button>
          <button
            onClick={startDiagnosis}
            className="flex-1 py-3 rounded-xl bg-[#569cd6] hover:bg-[#4a87be] text-white text-sm font-black transition-all shadow-[0_0_20px_rgba(86,156,214,0.25)]"
          >
            진단 시작
          </button>
        </div>
      </div>
    </div>
  );

  // ─── LOADING ───────────────────────────────────────
  if (phase === 'loading') return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
      <div className="max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#569cd6]/15 flex items-center justify-center mx-auto mb-6">
          <div className="w-7 h-7 border-[3px] border-[#569cd6]/30 border-t-[#569cd6] rounded-full animate-spin" />
        </div>
        <p className="text-white font-bold text-sm mb-2">{loadingMsg}</p>
        <div className="w-full bg-white/[0.05] rounded-full h-1.5 mb-2">
          <div
            className="h-1.5 rounded-full bg-[#569cd6] transition-all duration-500"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
        <p className="text-gray-600 text-xs">{loadingProgress}%</p>
      </div>
    </div>
  );

  // ─── QUIZ ──────────────────────────────────────────
  if (phase === 'quiz') {
    const q = questions[qIdx];
    const total = questions.length;
    const chapterNum = [...new Set(questions.slice(0, qIdx + 1).map(x => x.chapter))].length;
    const totalChapters = [...new Set(questions.map(x => x.chapter))].length;

    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d] p-4">
        <div className="max-w-xl w-full">
          {/* 상단 진행 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#569cd6] bg-[#569cd6]/10 px-2 py-0.5 rounded-full border border-[#569cd6]/20">
                {q.chapter.replace('ch', 'ch.')}
              </span>
              <span className="text-xs text-gray-500">{chapterNum} / {totalChapters} 챕터</span>
            </div>
            <span className="text-xs text-gray-500">{qIdx + 1} / {total}</span>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full bg-white/[0.05] rounded-full h-1 mb-6">
            <div
              className="h-1 rounded-full bg-[#569cd6] transition-all duration-300"
              style={{ width: `${((qIdx + 1) / total) * 100}%` }}
            />
          </div>

          {/* 문제 카드 */}
          <div className="bg-[#111] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-5 border-b border-white/[0.06]">
              {renderQuestionD(q.question)}
            </div>

            <div className="p-4 grid grid-cols-1 gap-2">
              {q.options.map((opt, i) => {
                let style = 'border-white/[0.08] bg-white/[0.02] text-gray-300 hover:border-[#569cd6]/40 hover:bg-[#569cd6]/[0.05]';
                if (selectedAnswer) {
                  if (opt === q.answer) style = 'border-[#4ec9b0]/60 bg-[#4ec9b0]/[0.08] text-[#4ec9b0]';
                  else if (opt === selectedAnswer && !feedback?.correct) style = 'border-[#ef4444]/60 bg-[#ef4444]/[0.08] text-[#ef4444]';
                  else style = 'border-white/[0.04] bg-transparent text-gray-600';
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!selectedAnswer}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${style}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-sm ${feedback.correct ? 'bg-[#4ec9b0]/[0.08] border border-[#4ec9b0]/20 text-[#4ec9b0]' : 'bg-[#ef4444]/[0.08] border border-[#ef4444]/20 text-[#ef4444]'}`}>
                <span className="font-bold mr-2">{feedback.correct ? '✅ 정답!' : '❌ 오답'}</span>
                <span className="text-white/70">{feedback.explanation}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT ────────────────────────────────────────
  if (phase === 'result') {
    // 챕터별 집계
    const chapterNames = [...new Set(questions.map(q => q.chapter))];
    const chapterStats = chapterNames.map(ch => {
      const chAnswers = answers.filter(a => a.chapterName === ch);
      const correct = chAnswers.filter(a => a.correct).length;
      const total = chAnswers.length;
      return { ch, correct, total, ratio: total > 0 ? correct / total : 0 };
    });

    const totalCorrect = answers.filter(a => a.correct).length;
    const totalQ = answers.length;
    const overallRatio = totalQ > 0 ? totalCorrect / totalQ : 0;
    const evaluation = getOverallEval(overallRatio);

    const strongest = [...chapterStats].sort((a, b) => b.ratio - a.ratio)[0];
    const weakest = [...chapterStats].sort((a, b) => a.ratio - b.ratio)[0];

    return (
      <div className="w-full h-full overflow-y-auto bg-[#0d0d0d] p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* 종합 결과 */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl"
              style={{ background: `${evaluation.color}18`, border: `2px solid ${evaluation.color}40`, boxShadow: `0 0 20px ${evaluation.color}25` }}>
              {evaluation.icon}
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: evaluation.color }}>
              {Math.round(overallRatio * 100)}%
            </div>
            <p className="text-sm font-bold" style={{ color: evaluation.color }}>{evaluation.label}</p>
            <p className="text-xs text-gray-500 mt-1">{totalCorrect} / {totalQ} 정답</p>
          </div>

          {/* 강점 / 약점 */}
          {chapterStats.length >= 2 && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-xl border border-[#4ec9b0]/20 bg-[#4ec9b0]/[0.05] p-4">
                <p className="text-[10px] font-bold text-[#4ec9b0] mb-1">💪 가장 강한 챕터</p>
                <p className="text-white font-black">{strongest.ch.replace('ch', 'ch.')}</p>
                <p className="text-[#4ec9b0] text-sm font-bold">{Math.round(strongest.ratio * 100)}%</p>
              </div>
              <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/[0.05] p-4">
                <p className="text-[10px] font-bold text-[#ef4444] mb-1">📌 복습 필요 챕터</p>
                <p className="text-white font-black">{weakest.ch.replace('ch', 'ch.')}</p>
                <p className="text-[#ef4444] text-sm font-bold">{Math.round(weakest.ratio * 100)}%</p>
              </div>
            </div>
          )}

          {/* 챕터별 상세 */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-bold text-gray-400">챕터별 정답률</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {chapterStats.map(({ ch, correct, total, ratio }) => {
                const color = ratio >= 0.7 ? '#4ec9b0' : ratio >= 0.5 ? '#fbbf24' : '#ef4444';
                return (
                  <div key={ch} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-xs text-gray-400 w-16 shrink-0">{ch.replace('ch', 'ch.')}</span>
                    <div className="flex-1 bg-white/[0.05] rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${ratio * 100}%`, background: color }}
                      />
                    </div>
                    <span className="text-xs font-bold w-14 text-right shrink-0" style={{ color }}>
                      {correct}/{total} ({Math.round(ratio * 100)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPhase('intro');
                setQuestions([]);
                setAnswers([]);
                setQIdx(0);
              }}
              className="flex-1 py-3 rounded-xl border border-white/[0.08] text-gray-400 text-sm font-bold hover:text-white hover:border-white/20 transition-all"
            >
              다시 진단
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-3 rounded-xl bg-[#569cd6] hover:bg-[#4a87be] text-white text-sm font-black transition-all"
            >
              학습 시작
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

export default DiagnosisView;
