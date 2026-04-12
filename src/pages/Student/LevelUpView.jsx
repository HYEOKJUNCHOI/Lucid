import { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, GEMINI_CHAT_URL } from '../../lib/aiConfig';
import { auth } from '../../lib/firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { addDailyXPCapped } from '../../services/userStateService';
import { GiAnvilImpact, GiSilverBullet, GiGoldBar, GiDiamondTrophy, GiLaurelCrown } from 'react-icons/gi';

// ─── 과목 목록 ───────────────────────────────────
const SUBJECTS = [
  { id: 'oop',        label: '객체지향',       sub: 'Java로 배우는', color: '#4ec9b0', icon: '☕' },
  { id: 'script',     label: '스크립트/자동화', sub: 'Python으로 배우는', color: '#3b82f6', icon: '🐍' },
  { id: 'web',        label: '웹 기초',        sub: 'HTML/CSS/JS', color: '#f97316', icon: '🌐' },
  { id: 'frontend',   label: '프론트엔드',     sub: 'React', color: '#06b6d4', icon: '⚛️' },
  { id: 'backend',    label: '백엔드',         sub: '서블릿 → 스프링부트', color: '#22c55e', icon: '🖥️' },
  { id: 'database',   label: '데이터베이스',   sub: 'MySQL', color: '#a855f7', icon: '🗄️' },
];

const BONUS_SUBJECTS = [
  { id: 'git',    label: 'Git/GitHub', color: '#9ca3af', icon: '🔀' },
  { id: 'docker', label: 'Docker',     color: '#2563eb', icon: '🐳' },
  { id: 'jegi',   label: '정보처리기사', color: '#f59e0b', icon: '📝' },
];

// ─── 티어 정의 ───────────────────────────────────
const TIERS = [
  { id: 'bronze',   label: '브론즈',   icon: GiAnvilImpact,    minXP: 0,    color: '#d97706', desc: '배우는 중',              glow: 'tier-glow-bronze' },
  { id: 'silver',   label: '실버',     icon: GiSilverBullet,   minXP: 500,  color: '#9ca3af', desc: '수업 따라가는 수준',     glow: 'tier-glow-silver' },
  { id: 'gold',     label: '골드',     icon: GiGoldBar,        minXP: 1500, color: '#eab308', desc: '혼자 짤 수 있는 수준',   glow: 'tier-glow-gold' },
  { id: 'platinum', label: '플래티넘', icon: GiLaurelCrown,    minXP: 3500, color: '#06b6d4', desc: '취업 가능 수준',         glow: 'tier-glow-platinum' },
  { id: 'diamond',  label: '다이아',   icon: GiDiamondTrophy,  minXP: 7000, color: '#a855f7', desc: '가르칠 수 있는 수준',    glow: 'tier-glow-diamond' },
];

const getTier = (xp) => {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (xp >= t.minXP) tier = t;
  }
  return tier;
};

const getNextTier = (xp) => {
  for (const t of TIERS) {
    if (xp < t.minXP) return t;
  }
  return null;
};

// ─── 세션 단계별 XP (XP_SYSTEM.md 기준) ──────────
// 예열(1~15문제) 5XP / 본게임(16~25문제) 10XP / 마무리(26~) 25XP
const getQuizXP = (attemptNum) => {
  if (attemptNum <= 15) return 5;   // 🟢 쉬움 예열
  if (attemptNum <= 25) return 10;  // 🟡 보통 본게임
  return 25;                        // 🔴 어려움 마무리
};
const getQuizPhase = (attemptNum) => {
  if (attemptNum <= 15) return { label: '예열', emoji: '🟢', color: '#4ec9b0' };
  if (attemptNum <= 25) return { label: '본게임', emoji: '🟡', color: '#fbbf24' };
  return { label: '마무리', emoji: '🔴', color: '#ef4444' };
};

// ─── AI 문제 생성 프롬프트 ────────────────────────
const SUBJECT_CONTEXT = {
  oop: 'Java 객체지향 프로그래밍',
  script: 'Python 스크립트 및 자동화',
  web: 'HTML, CSS, JavaScript 웹 기초',
  frontend: 'React 프론트엔드 개발',
  backend: 'Java 서블릿과 Spring Boot 백엔드',
  database: 'MySQL 데이터베이스',
  git: 'Git과 GitHub 버전관리',
  docker: 'Docker 컨테이너',
  jegi: '정보처리기사 기출',
};

const DIFFICULTY_MAP = {
  bronze: '매우 기초적인 (변수 선언, 출력문 수준)',
  silver: '기초~중급 (조건문, 반복문, 배열 활용)',
  gold: '중급 (클래스, 상속, 컬렉션, 예외처리)',
  platinum: '중~고급 (제네릭, 람다, 스트림, 디자인패턴)',
  diamond: '고급 응용 (복합 문제, 코드 분석, 아키텍처)',
};

const buildQuizPrompt = (subject, tier, level, wrongHistory) => {
  const formatInstruction = level <= 10
    ? '객관식 4지선다로 출제하세요.'
    : level <= 25
    ? '객관식, 빈칸 채우기, 실행 결과 예측 중 하나로 출제하세요.'
    : '객관식, 빈칸 채우기, 실행 결과 예측, 코드 작성(짧은 주관식) 중 하나로 출제하세요.';

  return `당신은 국비교육 코딩 학원의 미니테스트 출제 선생님입니다.

과목: ${SUBJECT_CONTEXT[subject] || subject}
난이도: ${DIFFICULTY_MAP[tier] || '기초'}
현재 레벨: ${level}

${formatInstruction}

규칙:
1. 문제는 1개만 출제
2. 실제 국비 수업에서 나올 법한 실용적 문제
3. 코드가 포함된 문제라면 실행 가능한 코드로
4. ${wrongHistory.length > 0 ? `학생이 최근 틀린 개념: ${wrongHistory.slice(-3).join(', ')}. 이 부분을 보강하는 문제를 내세요.` : ''}
5. 10% 확률로 암기형 문제를 섞으세요 (정처기 빈출: int 최대값, 접근제어자 범위, 예외 계층구조, SQL 키워드 등)
6. 정답이 여러 개일 수 있는 애매한 문제는 절대 내지 마세요
7. package, import 관련 문제 금지

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "question": "문제 텍스트 (코드 포함 가능)",
  "type": "choice|fill|result|short",
  "options": ["①선택지1", "②선택지2", "③선택지3", "④선택지4"],
  "answer": "정답 (선택지 번호 또는 텍스트)",
  "explanation": "해설 (왜 이게 정답인지, 핵심 개념 설명)",
  "concept": "이 문제의 핵심 개념 (한 단어, 예: 상속, 반복문, SELECT)",
  "codeHint": "코드가 어려울 경우 해석 힌트 (없으면 빈 문자열)"
}

options는 type이 choice일 때만 필수, 나머지는 빈 배열 [].`;
};

// 배치고사 10문제 일괄 생성 프롬프트
const buildPlacementBatchPrompt = (subject, tier) => {
  return `당신은 국비교육 코딩 학원의 미니테스트 출제 선생님입니다.

과목: ${SUBJECT_CONTEXT[subject] || subject}
난이도: ${DIFFICULTY_MAP[tier] || '기초'}

아래 조건으로 서로 다른 개념/주제의 문제 10개를 출제하세요:
- 각 문제는 반드시 서로 다른 개념을 다뤄야 합니다 (중복 금지)
- 객관식 4지선다(choice), 빈칸채우기(fill), 실행결과예측(result) 을 골고루 섞으세요
- 실제 수업에서 나올 법한 실용적 문제
- 코드 포함 문제는 실행 가능한 코드로
- 정답이 애매한 문제 금지
- package, import 관련 문제 금지

반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "question": "문제 텍스트",
    "type": "choice|fill|result",
    "options": ["①선택지1", "②선택지2", "③선택지3", "④선택지4"],
    "answer": "정답",
    "explanation": "해설",
    "concept": "핵심개념",
    "codeHint": ""
  },
  ...
]

options는 type이 choice일 때만 필수, 나머지는 빈 배열 [].`;
};

// ─── 코드 하이라이팅 렌더러 ──────────────────────
const LANG_NAMES = ['python', 'java', 'javascript', 'js', 'sql', 'html', 'css', 'bash', 'c', 'cpp', 'kotlin'];
const renderQuestion = (q, textClass = 'text-sm text-gray-200') => {
  // 1. ``` 코드블록
  const codeMatch = q.match(/```(\w*)\n?([\s\S]*?)```/);
  if (codeMatch) {
    const before = q.substring(0, codeMatch.index).trim();
    const lang = codeMatch[1] || 'java';
    const body = codeMatch[2].trim();
    const after = q.substring(codeMatch.index + codeMatch[0].length).trim();
    return (<>
      {before && <p className={`${textClass} whitespace-pre-wrap leading-relaxed mb-3`}>{before}</p>}
      <div className="rounded-xl overflow-hidden mb-2 border border-white/[0.06]">
        <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', fontSize: '12px', background: '#1e1e1e', borderRadius: '0.75rem' }} wrapLongLines>{body}</SyntaxHighlighter>
      </div>
      {after && <p className={`${textClass} whitespace-pre-wrap leading-relaxed`}>{after}</p>}
    </>);
  }
  // 2. "python\n코드" 패턴 (GPT가 ``` 없이 언어명만 붙이는 경우)
  const langRe = new RegExp(`^([\\s\\S]*?)\\n(${LANG_NAMES.join('|')})\\n([\\s\\S]+)$`, 'i');
  const langMatch = q.match(langRe);
  if (langMatch) {
    const before = langMatch[1].trim();
    const lang = langMatch[2].toLowerCase() === 'js' ? 'javascript' : langMatch[2].toLowerCase();
    const code = langMatch[3].trim();
    return (<>
      {before && <p className={`${textClass} whitespace-pre-wrap leading-relaxed mb-3`}>{before}</p>}
      <div className="rounded-xl overflow-hidden border border-white/[0.06]">
        <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', fontSize: '12px', background: '#1e1e1e', borderRadius: '0.75rem' }} wrapLongLines>{code}</SyntaxHighlighter>
      </div>
    </>);
  }
  // 3. 코드 패턴 자동 감지 (Java: {;} / Python: def/for/if/print)
  // 한국어 비율 높으면 코드로 인식하지 않음
  const koreanRatio = (q.match(/[가-힣]/g) || []).length / Math.max(q.length, 1);
  const isPythonLike = /(def |for .* in |if .*:|while .*:|print\(|import )/.test(q);
  const isJavaLike = /[{};]/.test(q);
  if ((isPythonLike || isJavaLike) && q.includes('\n') && koreanRatio < 0.25) {
    const lines = q.split('\n');
    const tl = [], cl = [];
    let started = false;
    for (const l of lines) {
      if (!started && /^[가-힣\s?!.,·①②③④()\d.]*$/.test(l.trim())) tl.push(l);
      else { started = true; cl.push(l); }
    }
    const code = cl.join('\n').trim();
    if (!code) return <p className={`${textClass} whitespace-pre-wrap leading-relaxed`}>{q}</p>;
    const lang = isPythonLike ? 'python' : 'java';
    return (<>
      {tl.length > 0 && <p className={`${textClass} whitespace-pre-wrap leading-relaxed mb-3`}>{tl.join('\n')}</p>}
      <div className="rounded-xl overflow-x-auto border border-white/[0.06]">
        <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', fontSize: '12px', background: '#1e1e1e', borderRadius: '0.75rem' }} wrapLongLines>{code}</SyntaxHighlighter>
      </div>
    </>);
  }
  return <p className={`${textClass} whitespace-pre-wrap leading-relaxed`}>{q}</p>;
};

// ─── 코드 패널 감지 ──────────────────────────────
const CODE_OPT_RE = /[;{}()]|^\s*(int|String|double|float|boolean|void|def|var|let|const|return|import|public|private|class|function)\b/;
const detectQuizCodePanel = (quiz) => {
  if (!quiz) return { show: false };
  // 질문에 코드블록이 있으면 → 왼쪽에 코드, 오른쪽에 질문 텍스트+선택지
  const cm = quiz.question.match(/```(\w*)\n?([\s\S]*?)```/);
  if (cm) {
    const lang = cm[1] || 'java';
    const code = cm[2].trim();
    const textBefore = quiz.question.substring(0, cm.index).trim();
    const textAfter = quiz.question.substring(cm.index + cm[0].length).trim();
    return { show: true, type: 'question', lang, code, textBefore, textAfter };
  }
  // 선택지 2개 이상이 코드처럼 생겼으면 → 왼쪽에 선택지 코드
  if (quiz.type === 'choice' && quiz.options?.length >= 2) {
    const codeCount = quiz.options.filter(opt => {
      const s = opt.replace(/^[①②③④⑤\d\.\s]+/, '').trim();
      return CODE_OPT_RE.test(s);
    }).length;
    if (codeCount >= 2) {
      const allOpts = quiz.options.join(' ');
      const lang = /def |print\(|import /.test(allOpts) ? 'python'
                 : /SELECT|FROM|WHERE/i.test(allOpts) ? 'sql'
                 : 'java';
      return { show: true, type: 'options', lang };
    }
  }
  // 질문에 백틱 없이 인라인 코드가 있는 경우 (renderQuestion 자동감지와 동일 로직)
  const koreanRatio = (quiz.question.match(/[가-힣]/g) || []).length / Math.max(quiz.question.length, 1);
  const isPythonLike = /(def |for .* in |if .*:|while .*:|print\(|import )/.test(quiz.question);
  const isJavaLike = /[{};]/.test(quiz.question);
  if ((isPythonLike || isJavaLike) && quiz.question.includes('\n') && koreanRatio < 0.25) {
    // 텍스트 부분과 코드 부분 분리
    const lines = quiz.question.split('\n');
    const textLines = [], codeLines = [];
    let started = false;
    for (const l of lines) {
      if (!started && /^[가-힣\s?!.,·①②③④()\d.]*$/.test(l.trim())) textLines.push(l);
      else { started = true; codeLines.push(l); }
    }
    const code = codeLines.join('\n').trim();
    if (code) {
      const lang = isPythonLike ? 'python' : 'java';
      return { show: true, type: 'question', lang, code, textBefore: textLines.join('\n').trim(), textAfter: '' };
    }
  }
  return { show: false };
};

// ─── 배치고사 localStorage 헬퍼 ─────────────────
const getPlacementKey = (uid, subjectId) => `placement_${uid}_${subjectId}`;
const savePlacementState = (uid, subjectId, state) => {
  try { localStorage.setItem(getPlacementKey(uid, subjectId), JSON.stringify(state)); } catch {}
};
const loadPlacementState = (uid, subjectId) => {
  try { const raw = localStorage.getItem(getPlacementKey(uid, subjectId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const clearPlacementState = (uid, subjectId) => {
  try { localStorage.removeItem(getPlacementKey(uid, subjectId)); } catch {}
};

// ─── 컴포넌트 ────────────────────────────────────
const LevelUpView = ({ userData, onBack }) => {
  const [phase, setPhase] = useState('select'); // select | quiz | testout | result
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [feedback, setFeedback] = useState(null); // { correct, explanation }
  const [level, setLevel] = useState(1);
  const [subjectXP, setSubjectXP] = useState(0);
  const [streak, setStreak] = useState(0); // 연속 정답
  const [wrongStreak, setWrongStreak] = useState(0); // 틀린 후 연속 정답 카운트 (2연속 필요)
  const [needTwoCorrect, setNeedTwoCorrect] = useState(false); // 틀림 → 2연속 모드
  const [wrongHistory, setWrongHistory] = useState([]); // 틀린 개념 기록
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [showCodeHint, setShowCodeHint] = useState(false);
  const [sessionXP, setSessionXP] = useState(0); // 이번 세션 획득 XP
  const [testoutTarget, setTestoutTarget] = useState(null); // 테스트아웃 목표 레벨
  const [testoutCorrect, setTestoutCorrect] = useState(0); // 테스트아웃 맞춘 수
  const [testoutTotal, setTestoutTotal] = useState(0); // 테스트아웃 총 문제
  const [testoutRequired] = useState(5); // 5문제 모두 맞춰야 통과
  const inputRef = useRef(null);
  const [testoutModal, setTestoutModal] = useState(false);
  const [testoutInput, setTestoutInput] = useState('');
  const [toast, setToast] = useState(null); // { msg, type: 'error'|'info' }
  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── 배치고사 상태 ────────────────────────────────
  const [placementLP, setPlacementLP] = useState(50);
  const [placementTierIdx, setPlacementTierIdx] = useState(1); // 실버부터 시작
  const [placementGamesLeft, setPlacementGamesLeft] = useState(10);
  const [placementMode, setPlacementMode] = useState('normal'); // normal | promotion | demotion
  const [placementSeriesWins, setPlacementSeriesWins] = useState(0);
  const [placementSeriesLosses, setPlacementSeriesLosses] = useState(0);
  const [placementSeriesGames, setPlacementSeriesGames] = useState(0);
  const [placementHistory, setPlacementHistory] = useState([]); // [{correct, tierIdx}]
  const [placementDone, setPlacementDone] = useState(false);
  const [placementStarted, setPlacementStarted] = useState(false);
  const [placementDevNotice, setPlacementDevNotice] = useState(false);
  const [placementQuizQueue, setPlacementQuizQueue] = useState([]); // 미리 생성된 문제 큐
  const [placementResume, setPlacementResume] = useState(null); // 저장된 진행 상태

  // 과목별 XP 로드
  useEffect(() => {
    if (selectedSubject && userData) {
      const saved = userData?.subjectTiers?.[selectedSubject] || { xp: 0, level: 1 };
      setSubjectXP(saved.xp);
      setLevel(saved.level);
    }
  }, [selectedSubject, userData]);

  // 문제 생성
  const generateQuiz = async () => {
    setLoading(true);
    setFeedback(null);
    setUserAnswer('');
    setSelectedOption(null);
    setShowCodeHint(false);

    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        showToast('API 키가 설정되지 않았습니다.');
        setLoading(false);
        return;
      }

      const tier = getTier(subjectXP);
      const prompt = buildQuizPrompt(selectedSubject, tier.id, level, wrongHistory);

      const res = await fetch(`${GEMINI_CHAT_URL(MODELS.GEMINI_QUIZ)}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8 },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // JSON 파싱 (코드블록 래핑 제거)
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const quiz = JSON.parse(jsonStr);
      setCurrentQuiz(quiz);
    } catch (e) {
      console.error('문제 생성 실패:', e);
      showToast('문제 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 배치고사 10문제 일괄 생성
  const generatePlacementQuiz = async (queue = []) => {
    // 큐에 문제 남아있으면 바로 꺼내서 사용
    if (queue.length > 0) {
      setCurrentQuiz(queue[0]);
      setPlacementQuizQueue(queue.slice(1));
      setFeedback(null);
      setUserAnswer('');
      setSelectedOption(null);
      setShowCodeHint(false);
      return;
    }
    // 큐 비어있으면 10문제 새로 생성
    setLoading(true);
    setFeedback(null);
    setUserAnswer('');
    setSelectedOption(null);
    setShowCodeHint(false);
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) { showToast('API 키가 설정되지 않았습니다.'); setLoading(false); return; }
      const tier = TIERS[placementTierIdx];
      const prompt = buildPlacementBatchPrompt(selectedSubject, tier.id);
      const res = await fetch(`${GEMINI_CHAT_URL(MODELS.GEMINI_QUIZ)}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const quizList = JSON.parse(jsonStr);
      if (!Array.isArray(quizList) || quizList.length === 0) throw new Error('빈 배열');
      setCurrentQuiz(quizList[0]);
      setPlacementQuizQueue(quizList.slice(1));
    } catch (e) {
      console.error('배치 문제 생성 실패:', e);
      showToast('문제 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 과목 선택 → 배치고사 or 문제 시작
  const handleSubjectSelect = (subjectId) => {
    const existing = userData?.subjectTiers?.[subjectId];
    setSelectedSubject(subjectId);
    setTotalCorrect(0);
    setTotalAttempts(0);
    setSessionXP(0);
    setStreak(0);
    setWrongStreak(0);
    setNeedTwoCorrect(false);
    setWrongHistory([]);

    if (!existing) {
      // 처음 선택 → 배치고사 (이어하기 데이터 확인)
      const uid = auth.currentUser?.uid;
      const saved = uid ? loadPlacementState(uid, subjectId) : null;
      setPlacementLP(50);
      setPlacementTierIdx(0);
      setPlacementGamesLeft(10);
      setPlacementMode('normal');
      setPlacementSeriesWins(0);
      setPlacementSeriesLosses(0);
      setPlacementSeriesGames(0);
      setPlacementHistory([]);
      setPlacementDone(false);
      setPlacementStarted(false);
      setCurrentQuiz(null);
      setFeedback(null);
      setPlacementResume(saved);
      setPhase('placement');
    } else {
      setPhase('quiz');
    }
  };

  // 문제 시작 (phase가 quiz로 바뀌면)
  useEffect(() => {
    if (phase === 'quiz' && selectedSubject && !currentQuiz && !loading) {
      generateQuiz();
    }
  }, [phase, selectedSubject]);

  // 배치고사 문제 시작 (인트로 통과 후에만)
  useEffect(() => {
    // 첫 시작 시에만 (큐가 비어있고 문제도 없을 때) 배치 생성
    if (phase === 'placement' && placementStarted && selectedSubject && !currentQuiz && !loading && !placementDone && placementQuizQueue.length === 0) {
      generatePlacementQuiz([]);
    }
  }, [phase, placementStarted, selectedSubject, placementDone]);

  // 배치고사 제출
  const handlePlacementSubmit = async () => {
    if (!currentQuiz) return;
    const answer = currentQuiz.type === 'choice' ? selectedOption : userAnswer.trim();
    if (!answer) return;

    const correctAnswer = currentQuiz.answer;
    let isCorrect = false;
    if (currentQuiz.type === 'choice') {
      isCorrect = correctAnswer.replace(/[^0-9]/g, '') === answer.replace(/[^0-9]/g, '');
    } else {
      isCorrect = answer.toLowerCase().replace(/\s/g, '') === correctAnswer.toLowerCase().replace(/\s/g, '');
    }

    setFeedback({ correct: isCorrect, explanation: currentQuiz.explanation });

    // LP 로직 (local vars로 계산 후 setState)
    let lp = placementLP;
    let tierIdx = placementTierIdx;
    let mode = placementMode;
    let sWins = placementSeriesWins;
    let sLosses = placementSeriesLosses;
    let sGames = placementSeriesGames;
    let gamesLeft = placementGamesLeft - 1;
    let done = false;

    if (mode === 'normal') {
      if (isCorrect) {
        lp = Math.min(lp + 25, 100);
        if (lp >= 100 && tierIdx < TIERS.length - 1) {
          mode = 'promotion'; sWins = 0; sLosses = 0; sGames = 0;
        } else if (lp >= 100) {
          done = true; // 다이아 달성
        }
      } else {
        lp = Math.max(lp - 20, 0);
        if (lp <= 0 && tierIdx > 0) {
          mode = 'demotion'; sWins = 0; sLosses = 0; sGames = 0;
        } else if (lp <= 0) {
          done = true; // 브론즈 최저
        }
      }
    } else if (mode === 'promotion') {
      sGames++;
      if (isCorrect) sWins++; else sLosses++;
      if (sWins >= 2) { // 승급 성공
        tierIdx = Math.min(tierIdx + 1, TIERS.length - 1);
        mode = 'normal'; lp = 50; sWins = 0; sLosses = 0; sGames = 0;
      } else if (sLosses >= 2 || sGames >= 3) { // 승급 실패
        mode = 'normal'; lp = 70; sWins = 0; sLosses = 0; sGames = 0;
      }
    } else if (mode === 'demotion') {
      sGames++;
      if (!isCorrect) sLosses++; else sWins++;
      if (sLosses >= 2) { // 강등
        tierIdx = Math.max(tierIdx - 1, 0);
        mode = 'normal'; lp = 50; sWins = 0; sLosses = 0; sGames = 0;
      } else if (sWins >= 2 || sGames >= 3) { // 강등 방어
        mode = 'normal'; lp = 30; sWins = 0; sLosses = 0; sGames = 0;
      }
    }

    if (gamesLeft <= 0) done = true;

    setPlacementLP(lp);
    setPlacementTierIdx(tierIdx);
    setPlacementGamesLeft(gamesLeft);
    setPlacementMode(mode);
    setPlacementSeriesWins(sWins);
    setPlacementSeriesLosses(sLosses);
    setPlacementSeriesGames(sGames);
    setPlacementHistory(prev => [...prev, { correct: isCorrect, tierIdx: placementTierIdx }]);

    const uid = auth.currentUser?.uid;
    if (done) {
      const finalTier = TIERS[tierIdx];
      // 완료 → localStorage 가비지 삭제
      if (uid) clearPlacementState(uid, selectedSubject);
      try {
        if (uid) {
          await updateDoc(doc(db, 'users', uid), {
            [`subjectTiers.${selectedSubject}`]: { xp: finalTier.minXP, level: 1 },
            lastStudiedAt: serverTimestamp(),
          });
        }
      } catch (e) { console.warn('배치 저장 실패:', e); }
      setSubjectXP(finalTier.minXP);
      setLevel(1);
      setPlacementDone(true);
    } else {
      // 진행 중 → localStorage 저장
      if (uid) savePlacementState(uid, selectedSubject, {
        lp, tierIdx, gamesLeft, mode,
        sWins, sLosses, sGames,
        history: [...placementHistory, { correct: isCorrect, tierIdx: placementTierIdx }],
      });
      // 큐에서 다음 문제 꺼내기
      generatePlacementQuiz(placementQuizQueue);
    }
  };

  // 정답 제출
  const handleSubmit = async () => {
    if (!currentQuiz) return;

    const answer = currentQuiz.type === 'choice' ? selectedOption : userAnswer.trim();
    if (!answer) return;

    // 정답 비교
    const correctAnswer = currentQuiz.answer;
    let isCorrect = false;

    if (currentQuiz.type === 'choice') {
      // 선택지 번호로 비교 (①, ②, ③, ④ 또는 1, 2, 3, 4)
      const answerNum = correctAnswer.replace(/[^0-9]/g, '');
      const selectedNum = answer.replace(/[^0-9]/g, '');
      isCorrect = answerNum === selectedNum;
    } else {
      // 텍스트 비교 (공백/대소문자 무시)
      isCorrect = answer.toLowerCase().replace(/\s/g, '') ===
                  correctAnswer.toLowerCase().replace(/\s/g, '');
    }

    setTotalAttempts(prev => prev + 1);

    if (isCorrect) {
      setTotalCorrect(prev => prev + 1);
      setStreak(prev => prev + 1);

      // 틀림 후 2연속 모드 체크
      if (needTwoCorrect) {
        const newWrongStreak = wrongStreak + 1;
        setWrongStreak(newWrongStreak);
        if (newWrongStreak >= 2) {
          setNeedTwoCorrect(false);
          setWrongStreak(0);
        }
      }

      // XP 획득 (세션 단계별 + 하루 상한 체크)
      const nextAttempt = totalAttempts + 1;
      const rawXP = getQuizXP(nextAttempt);
      const uid = auth.currentUser?.uid;
      const actualXP = uid ? await addDailyXPCapped(uid, 'levelup', rawXP, userData, true) : 0;
      const newXP = subjectXP + actualXP;
      setSubjectXP(newXP);
      setSessionXP(prev => prev + actualXP);

      // 레벨업 체크
      const newLevel = level + (needTwoCorrect ? 0 : 1);
      if (!needTwoCorrect) setLevel(newLevel);

      // Firebase 저장
      try {
        const uid = auth.currentUser?.uid;
        if (uid && actualXP > 0) {
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, {
            totalXP: increment(actualXP),
            [`subjectTiers.${selectedSubject}`]: { xp: newXP, level: newLevel },
            lastStudiedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('XP 저장 실패:', e);
      }

      setFeedback({ correct: true, explanation: currentQuiz.explanation });
    } else {
      // 오답
      setStreak(0);
      setNeedTwoCorrect(true);
      setWrongStreak(0);
      if (currentQuiz.concept) {
        setWrongHistory(prev => [...prev, currentQuiz.concept]);
      }
      setFeedback({ correct: false, explanation: currentQuiz.explanation });
    }
  };

  // 다음 문제
  const handleNext = () => {
    setCurrentQuiz(null);
    setFeedback(null);
    generateQuiz();
  };

  // 나가기 → 결과
  const handleExit = () => {
    setPhase('result');
  };

  // ─── 테스트아웃 ────────────────────────────────
  const startTestout = (targetLevel) => {
    setTestoutTarget(targetLevel);
    setTestoutCorrect(0);
    setTestoutTotal(0);
    setLevel(targetLevel); // 목표 레벨 난이도로 문제 생성
    setPhase('testout');
    setCurrentQuiz(null);
    setFeedback(null);
    generateQuiz();
  };

  const handleTestoutSubmit = async () => {
    if (!currentQuiz) return;
    const answer = currentQuiz.type === 'choice' ? selectedOption : userAnswer.trim();
    if (!answer) return;

    const correctAnswer = currentQuiz.answer;
    let isCorrect = false;
    if (currentQuiz.type === 'choice') {
      isCorrect = correctAnswer.replace(/[^0-9]/g, '') === answer.replace(/[^0-9]/g, '');
    } else {
      isCorrect = answer.toLowerCase().replace(/\s/g, '') === correctAnswer.toLowerCase().replace(/\s/g, '');
    }

    const newTotal = testoutTotal + 1;
    setTestoutTotal(newTotal);

    if (isCorrect) {
      const newCorrect = testoutCorrect + 1;
      setTestoutCorrect(newCorrect);
      setFeedback({ correct: true, explanation: currentQuiz.explanation });

      // 5문제 모두 맞추면 통과
      if (newCorrect >= testoutRequired) {
        // 레벨 점프 성공 — Firebase에 저장
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
              [`subjectTiers.${selectedSubject}`]: { xp: subjectXP, level: testoutTarget },
              lastStudiedAt: serverTimestamp(),
            });
          }
        } catch (e) { console.warn('테스트아웃 저장 실패:', e); }
      }
    } else {
      // 틀리면 테스트아웃 실패
      setFeedback({ correct: false, explanation: currentQuiz.explanation });
    }
  };

  const handleTestoutNext = () => {
    if (!feedback) return;
    if (!feedback.correct) {
      // 실패 → 원래 레벨로 복귀, 일반 퀴즈로
      const saved = userData?.subjectTiers?.[selectedSubject];
      setLevel(saved?.level || 1);
      setPhase('quiz');
      setCurrentQuiz(null);
      setFeedback(null);
      setTestoutTarget(null);
      generateQuiz();
      return;
    }
    if (testoutCorrect >= testoutRequired) {
      // 통과! → 일반 퀴즈로 전환 (새 레벨에서)
      setPhase('quiz');
      setCurrentQuiz(null);
      setFeedback(null);
      setTestoutTarget(null);
      generateQuiz();
      return;
    }
    // 다음 테스트아웃 문제
    setCurrentQuiz(null);
    setFeedback(null);
    generateQuiz();
  };

  // ─── 배치고사 화면 ────────────────────────────
  if (phase === 'placement') {
    const placementTier = TIERS[placementTierIdx];
    const subjectInfo2 = [...SUBJECTS, ...BONUS_SUBJECTS].find(s => s.id === selectedSubject);

    // 배치고사 인트로 화면
    if (!placementStarted) {
      const START_IDX = 0; // 브론즈
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden animate-fade-in-up px-6" style={{ background: '#0d0d0d' }}>
          <div className="shrink-0 pt-6">
            <button onClick={() => setPhase('select')}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-base font-semibold hover:bg-white/[0.04] px-3 py-2 rounded-lg transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              돌아가기
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-2xl text-center relative">
            <div className="text-4xl mb-3 placement-float placement-row-1">⚔️</div>
            <h2 className="text-5xl font-black text-white mb-3 tracking-tight placement-row-2">배치고사</h2>
            <p className="text-lg font-bold text-gray-200 mb-7 placement-row-3">{subjectInfo2?.label} · 어느 티어에 배치될까요?</p>

            {/* 티어 시각화 */}
            <div className="mb-7 placement-row-4">
              {/* 노드 + 설명 */}
              <div className="flex justify-between mb-4 px-1">
                {TIERS.map((t, i) => {
                  const isStart = i === START_IDX;
                  return (
                    <div key={t.id} className={`flex flex-col items-center gap-1.5 flex-1 placement-tier-${i}`}>
                      <span className="text-xs font-black h-4" style={{ color: isStart ? t.color : 'transparent' }}>▼</span>
                      <span className={t.glow} style={{ color: t.color }}>
                        <t.icon size={32} />
                      </span>
                      <span className="text-xs font-black" style={{ color: t.color }}>
                        {t.label}
                      </span>
                      <p className="text-[11px] font-medium leading-snug text-center px-1"
                        style={{ color: 'rgba(255,255,255,0.6)', wordBreak: 'keep-all' }}>
                        {t.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* LP 트랙 바 — 세그먼트 */}
              <div className="flex items-center h-5 mx-1">
                {TIERS.map((t, i) => {
                  const isActive = i <= START_IDX;
                  return (
                    <div
                      key={t.id}
                      className={`relative flex-1 h-full ${isActive ? 'placement-bar-fill' : ''}`}
                      style={{
                        borderRadius: '999px',
                        background: isActive ? t.color : `${t.color}28`,
                        boxShadow: isActive ? `0 0 10px ${t.color}80` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {placementResume ? (
              <div className="placement-row-5 flex flex-col gap-2">
                <button
                  onClick={() => {
                    const r = placementResume;
                    setPlacementLP(r.lp);
                    setPlacementTierIdx(r.tierIdx);
                    setPlacementGamesLeft(r.gamesLeft);
                    setPlacementMode(r.mode);
                    setPlacementSeriesWins(r.sWins);
                    setPlacementSeriesLosses(r.sLosses);
                    setPlacementSeriesGames(r.sGames);
                    setPlacementHistory(r.history || []);
                    setPlacementResume(null);
                    setPlacementStarted(true);
                  }}
                  className="w-full py-5 rounded-2xl font-black text-lg text-black transition-all hover:-translate-y-1 hover:scale-[1.02] placement-btn-shimmer"
                  style={{ boxShadow: '0 8px 32px rgba(234,179,8,0.45), 0 0 0 1px rgba(234,179,8,0.2)' }}
                >
                  이어하기 ({placementResume.gamesLeft}문제 남음) →
                </button>
                <button
                  onClick={() => {
                    const uid = auth.currentUser?.uid;
                    if (uid) clearPlacementState(uid, selectedSubject);
                    setPlacementResume(null);
                    setPlacementStarted(true);
                  }}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-gray-400 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition-all"
                >
                  처음부터 다시
                </button>
              </div>
            ) : (
              <>
                {placementDevNotice && (
                  <div
                    className="absolute z-20 flex flex-col items-center justify-center cursor-pointer"
                    style={{ top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100vw', background: 'rgba(160,0,0,0.35)', backdropFilter: 'blur(3px)' }}
                    onClick={() => setPlacementDevNotice(false)}
                  >
                    <p className="text-red-100 text-[11px] font-black tracking-[0.25em] uppercase mb-3">⚠ WARNING</p>
                    <p className="text-white font-black text-3xl mb-2" style={{ textShadow: '0 0 20px rgba(255,255,255,0.4)' }}>기능 준비중입니다</p>
                    <p className="text-white/70 text-sm">곧 만나요!</p>
                  </div>
                )}
                <button
                  onClick={() => { setPlacementDevNotice(true); setTimeout(() => setPlacementDevNotice(false), 2500); }}
                  className="placement-row-5 w-full py-5 rounded-2xl font-black text-lg text-black transition-all hover:-translate-y-1 hover:scale-[1.02] placement-btn-shimmer"
                  style={{ boxShadow: '0 8px 32px rgba(234,179,8,0.45), 0 0 0 1px rgba(234,179,8,0.2)' }}
                >
                  배치고사 시작 →
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      );
    }

    // 배치 완료 결과 화면
    if (placementDone) {
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-auto animate-fade-in-up px-4" style={{ background: '#0d0d0d' }}>
          <div className="w-full max-w-md text-center">
            <div className="mb-4 flex justify-center" style={{ color: placementTier.color }}><placementTier.icon size={56} /></div>
            <h2 className="text-2xl font-black text-white mb-1">배치 완료!</h2>
            <p className="text-sm mb-6" style={{ color: placementTier.color }}>{placementTier.label} 티어에서 시작합니다</p>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-gray-500 mb-3 font-semibold">배치 결과</p>
              <div className="flex items-center gap-2 flex-wrap">
                {placementHistory.map((h, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border ${h.correct ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/40 text-[#4ec9b0]' : 'bg-red-500/10 border-red-500/40 text-red-400'}`}>
                    {h.correct ? '○' : '×'}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 mt-3">
                {placementHistory.filter(h => h.correct).length} / {placementHistory.length} 정답
              </p>
            </div>
            <button
              onClick={() => { setPhase('quiz'); setCurrentQuiz(null); setFeedback(null); }}
              className="w-full py-4 rounded-2xl font-black text-base transition-all hover:-translate-y-1"
              style={{ background: `linear-gradient(135deg, ${placementTier.color}30, ${placementTier.color}15)`, color: placementTier.color, border: `1px solid ${placementTier.color}50`, boxShadow: `0 8px 30px ${placementTier.color}20` }}
            >
              문제지옥 시작하기 →
            </button>
          </div>
        </div>
      );
    }

    // 배치고사 진행 화면
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden relative" style={{ background: '#0d0d0d' }}>
        {/* 토스트 */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-semibold text-sm shadow-2xl flex items-center gap-3 animate-fade-in-up"
            style={{ background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(78,201,176,0.15)', border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(78,201,176,0.35)'}`, color: toast.type === 'error' ? '#fca5a5' : '#4ec9b0', backdropFilter: 'blur(12px)' }}>
            <span>{toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span>{toast.msg}</span>
          </div>
        )}
        {/* 헤더 */}
        <div className="shrink-0 px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setPhase('select')} className="text-gray-500 hover:text-white transition p-1 rounded-lg hover:bg-white/[0.06]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-sm font-bold text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-full">⚔ 배치고사</span>
              <span className="text-sm text-gray-400 font-medium">{subjectInfo2?.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">남은 게임</span>
              <span className="text-xl font-black text-white">{placementGamesLeft}</span>
              {placementMode !== 'normal' && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${placementMode === 'promotion' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-red-400/15 text-red-400'}`}>
                  {placementMode === 'promotion' ? `승급전 ${placementSeriesWins}/2` : `강등전 ${placementSeriesLosses}/2`}
                </span>
              )}
            </div>
          </div>
          {/* 현재 티어 + LP바 */}
          <div className="flex items-center gap-4">
            <span className={placementTier.glow} style={{ color: placementTier.color }}><placementTier.icon size={22} /></span>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1.5 font-semibold" style={{ color: placementTier.color }}>
                <span>{placementTier.label}</span>
                <span>{placementLP} LP</span>
              </div>
              <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${placementLP}%`, background: placementMode === 'promotion' ? '#eab308' : placementMode === 'demotion' ? '#ef4444' : placementTier.color, boxShadow: `0 0 8px ${placementTier.color}70` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 문제 영역 */}
        <div className="flex-1 overflow-auto px-4 py-6 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${placementTier.color}60`, borderTopColor: 'transparent' }} />
              <p className="text-sm text-gray-500">배치 문제 생성 중...</p>
            </div>
          ) : !currentQuiz && !placementDone ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-500">문제를 불러오지 못했습니다.</p>
              <button
                onClick={(e) => { e.stopPropagation(); generatePlacementQuiz([]); }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20 transition-all"
              >
                다시 시도
              </button>
            </div>
          ) : currentQuiz ? (() => {
            const cp = detectQuizCodePanel(currentQuiz);
            const OPT_LABELS = ['①', '②', '③', '④', '⑤'];
            return (
              <div key={currentQuiz.question} className={`flex gap-5 ${cp.show ? 'w-full max-w-5xl flex-row items-start' : 'w-full max-w-lg flex-col'}`}>
                {/* 코드 패널 (왼쪽) */}
                {cp.show && (
                  <div className="flex-1 min-w-0 quiz-code-panel-enter">
                    <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ background: '#1a1a1a' }}>
                      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f5680' }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e80' }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: '#27c93f80' }} />
                        </div>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {cp.lang}.{cp.lang === 'python' ? 'py' : cp.lang === 'sql' ? 'sql' : cp.lang === 'javascript' ? 'js' : 'java'}
                        </span>
                      </div>
                      {cp.type === 'question' ? (
                        <SyntaxHighlighter language={cp.lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.25rem', fontSize: '13px', background: 'transparent', lineHeight: '1.6' }} wrapLongLines>
                          {cp.code}
                        </SyntaxHighlighter>
                      ) : (
                        <div className="p-4 space-y-2">
                          {currentQuiz.options.map((opt, i) => {
                            const stripped = opt.replace(/^[①②③④⑤\d\.\s]+/, '').trim();
                            const isSelected = selectedOption === opt;
                            const answerNum = feedback ? currentQuiz.answer.replace(/[^0-9]/g, '') : null;
                            const isCorrectOpt = answerNum === String(i + 1);
                            const isWrongSelected = feedback && isSelected && !feedback.correct;
                            return (
                              <div key={i} onClick={() => !feedback && setSelectedOption(opt)}
                                className={`rounded-xl overflow-hidden border transition-all duration-200 ${!feedback ? 'cursor-pointer' : 'cursor-default'} ${isCorrectOpt && feedback ? 'border-[#4ec9b0]/50' : isWrongSelected ? 'border-red-500/50' : isSelected ? 'border-yellow-400/50' : 'border-white/[0.07] hover:border-white/20'}`}
                                style={isSelected && !feedback ? { boxShadow: '0 0 14px rgba(234,179,8,0.25)' } : {}}>
                                <div className={`px-3 py-1 text-[10px] font-bold border-b flex items-center gap-2 ${isCorrectOpt && feedback ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/20 text-[#4ec9b0]' : isWrongSelected ? 'bg-red-500/15 border-red-500/20 text-red-400' : isSelected ? 'bg-yellow-400/15 border-yellow-400/15 text-yellow-300' : 'bg-white/[0.03] border-white/[0.04] text-gray-500'}`}>
                                  <span>{OPT_LABELS[i]}</span>
                                  {isCorrectOpt && feedback && <span>✓ 정답</span>}
                                  {isWrongSelected && <span>✗</span>}
                                </div>
                                <SyntaxHighlighter language={cp.lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.6rem 1rem', fontSize: '12.5px', background: 'transparent' }} wrapLongLines>
                                  {stripped}
                                </SyntaxHighlighter>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 퀴즈 패널 (오른쪽 or 전체) */}
                <div className={`flex flex-col gap-4 ${cp.show ? 'w-72 shrink-0 quiz-panel-slide-right' : 'w-full'}`}>
                  <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ color: placementTier.color, background: `${placementTier.color}18`, border: `1px solid ${placementTier.color}30` }}>
                        {currentQuiz.type === 'choice' ? '객관식' : currentQuiz.type === 'fill' ? '빈칸 채우기' : currentQuiz.type === 'result' ? '실행 결과' : '주관식'}
                      </span>
                      {currentQuiz.codeHint && (
                        <button onClick={() => setShowCodeHint(!showCodeHint)} className="text-xs font-bold px-3 py-1 rounded-full transition-all" style={{ color: '#7b8cde', background: '#7b8cde20', border: '1px solid #7b8cde30' }}>
                          {showCodeHint ? '힌트 닫기' : '코드 해석'}
                        </button>
                      )}
                    </div>
                    {cp.show && cp.type === 'question'
                      ? <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{[cp.textBefore, cp.textAfter].filter(Boolean).join('\n') || currentQuiz.question.replace(/```[\s\S]*?```/g, '').trim()}</p>
                      : renderQuestion(currentQuiz.question)
                    }
                    {showCodeHint && currentQuiz.codeHint && (
                      <div className="mt-4 p-3 rounded-xl" style={{ background: '#7b8cde12', border: '1px solid #7b8cde25' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#7b8cde' }}>코드 해석</p>
                        <p className="text-xs text-gray-300 leading-relaxed">{currentQuiz.codeHint}</p>
                      </div>
                    )}
                  </div>

                  {!feedback ? (
                    <>
                      {currentQuiz.type === 'choice' && currentQuiz.options?.length > 0 ? (
                        cp.show && cp.type === 'options' ? (
                          <div className="space-y-2">
                            {currentQuiz.options.map((opt, i) => {
                              const isSelected = selectedOption === opt;
                              return (
                                <button key={i} onClick={() => setSelectedOption(opt)}
                                  className={`w-full py-3 rounded-xl border font-bold text-xl transition-all hover:-translate-y-0.5 ${isSelected ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                  style={isSelected ? { borderColor: 'rgba(234,179,8,0.6)', background: 'rgba(234,179,8,0.15)', boxShadow: '0 0 14px rgba(234,179,8,0.25)' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                  {OPT_LABELS[i]}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentQuiz.options.map((opt, i) => (
                              <button key={i} onClick={() => setSelectedOption(opt)}
                                className={`w-full text-left px-5 py-3.5 rounded-xl border text-sm font-medium transition-all ${selectedOption === opt ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                                style={selectedOption === opt ? { borderColor: `${placementTier.color}70`, background: `${placementTier.color}18`, boxShadow: `0 0 12px ${placementTier.color}20` } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )
                      ) : (
                        <input type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handlePlacementSubmit(); }}
                          placeholder="답을 입력하세요..."
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30 transition-all"
                          autoFocus />
                      )}
                      <button onClick={handlePlacementSubmit}
                        disabled={currentQuiz.type === 'choice' ? !selectedOption : !userAnswer.trim()}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5 bg-yellow-400 text-black">
                        제출
                      </button>
                    </>
                  ) : (
                    <div>
                      <div className={`p-5 rounded-2xl border mb-4 ${feedback.correct ? 'bg-[#4ec9b0]/[0.08] border-[#4ec9b0]/30' : 'bg-red-500/[0.08] border-red-500/30'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          {feedback.correct ? (
                            <><span className="text-lg">✅</span><span className="text-[#4ec9b0] font-bold">정답! +25 LP</span></>
                          ) : (
                            <><span className="text-lg">❌</span><span className="text-red-400 font-bold">오답 -20 LP</span></>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{feedback.explanation}</p>
                      </div>
                      <button onClick={() => { setCurrentQuiz(null); setFeedback(null); }} disabled={placementDone}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                        style={{ background: `${placementTier.color}20`, color: placementTier.color, border: `1px solid ${placementTier.color}40` }}>
                        다음 문제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : null}
        </div>
      </div>
    );
  }

  // ─── 과목 선택 화면 ────────────────────────────
  if (phase === 'select') {
    return (
      <div className="flex flex-col h-full animate-fade-in-up px-6">
        {/* 뒤로가기 */}
        <div className="shrink-0 pt-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white text-base font-semibold hover:bg-white/[0.04] px-3 py-2 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            돌아가기
          </button>
        </div>
        <div className="flex-1 overflow-auto">
        <div className="w-full max-w-2xl mx-auto py-4">

          <h2 className="text-2xl font-black text-white mb-1 text-center">레벨업 문제지옥</h2>
          <p className="text-sm text-gray-400 text-center mb-1">과목을 선택하면 티어에 맞는 문제가 출제됩니다</p>
          <p className="text-[10px] text-gray-600 text-center mb-4">처음 선택하는 과목은 배치고사로 시작 — 실력에 맞는 티어를 바로 찾아드려요</p>

          {/* 메인 과목 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {SUBJECTS.map((s) => {
              const saved = userData?.subjectTiers?.[s.id];
              const xp = saved?.xp || 0;
              const tier = getTier(xp);
              return (
                <button
                  key={s.id}
                  onClick={() => handleSubjectSelect(s.id)}
                  className="group relative rounded-2xl p-5 text-left hover:-translate-y-2 transition-all duration-300"
                  style={{ background: `linear-gradient(135deg, ${s.color}20 0%, ${s.color}0a 100%)`, border: `1px solid ${s.color}4d`, boxShadow: `0 4px 20px ${s.color}18` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.color + '99'; e.currentTarget.style.boxShadow = `0 14px 48px ${s.color}45, 0 0 0 1px ${s.color}30`; e.currentTarget.style.background = `linear-gradient(135deg, ${s.color}30 0%, ${s.color}12 100%)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = s.color + '4d'; e.currentTarget.style.boxShadow = `0 4px 20px ${s.color}18`; e.currentTarget.style.background = `linear-gradient(135deg, ${s.color}20 0%, ${s.color}0a 100%)`; }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${s.color}25, ${s.color}10)`, boxShadow: `0 0 14px ${s.color}20`, border: `1px solid ${s.color}30` }}>
                    {s.icon}
                  </div>
                  <h3 className="text-sm font-bold text-white mb-0.5">{s.label}</h3>
                  <p className="text-[10px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.sub}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={tier.glow} style={{ color: tier.color }}><tier.icon size={11} /></span>
                    <span className="text-[10px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 보너스 과목 */}
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-1">보너스</p>
          <div className="grid grid-cols-3 gap-3">
            {BONUS_SUBJECTS.map((s) => {
              const saved = userData?.subjectTiers?.[s.id];
              const xp = saved?.xp || 0;
              const tier = getTier(xp);
              return (
                <button
                  key={s.id}
                  onClick={() => handleSubjectSelect(s.id)}
                  className="group rounded-xl p-4 text-left hover:-translate-y-2 transition-all duration-300"
                  style={{ background: `linear-gradient(135deg, ${s.color}20 0%, ${s.color}0a 100%)`, border: `1px solid ${s.color}4d`, boxShadow: `0 4px 16px ${s.color}15` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.color + '99'; e.currentTarget.style.boxShadow = `0 12px 36px ${s.color}40`; e.currentTarget.style.background = `linear-gradient(135deg, ${s.color}30 0%, ${s.color}12 100%)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = s.color + '4d'; e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}15`; e.currentTarget.style.background = `linear-gradient(135deg, ${s.color}20 0%, ${s.color}0a 100%)`; }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${s.color}25, ${s.color}10)`, border: `1px solid ${s.color}30` }}>
                    {s.icon}
                  </div>
                  <h3 className="text-xs font-bold text-white">{s.label}</h3>
                  <div className="flex items-center gap-1 mt-2">
                    <span className={tier.glow} style={{ color: tier.color }}><tier.icon size={10} /></span>
                    <span className="text-[9px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ─── 결과 화면 ─────────────────────────────────
  if (phase === 'result') {
    const tier = getTier(subjectXP);
    const nextTier = getNextTier(subjectXP);
    const subjectLabel = [...SUBJECTS, ...BONUS_SUBJECTS].find(s => s.id === selectedSubject)?.label || '';
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    // 노래방 스타일 AI 멘트
    const comments = {
      perfect: [
        '당신... 혹시 강사 아니세요? 🎤',
        '완벽 그 자체! 다음 티어 문 두드려보세요!',
        '이 정도면 면접관도 당황합니다 😎',
      ],
      great: [
        '오, 이 정도면 당장 취업 가능한데요?',
        '실력이 눈에 보여요! 계속 이 페이스 유지!',
        '꾸준함이 실력을 만드는 중이에요 🔥',
      ],
      good: [
        '절반 넘었어요! 틀린 부분만 잡으면 금방 올라갑니다',
        '기초는 탄탄해요. 조금만 더 파봐요!',
        '포기하지 마요. 이미 절반은 왔어요 💪',
      ],
      keep: [
        '틀리는 건 배우는 거예요. 진짜입니다.',
        '첫걸음이 제일 어렵습니다. 이미 시작한 당신이 대단해요.',
        '지금 틀린 만큼 나중에 강해져요. 다시 해봐요!',
      ],
    };
    const pool = accuracy >= 90 ? comments.perfect :
                 accuracy >= 70 ? comments.great :
                 accuracy >= 50 ? comments.good : comments.keep;
    const comment = pool[Math.floor(Math.random() * pool.length)];

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-auto animate-fade-in-up px-4" style={{ background: '#0d0d0d' }}>
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-black text-white mb-1 text-center">세션 종료</h2>
          <p className="text-sm text-gray-400 text-center mb-8">{subjectLabel}</p>

          {/* 티어 배지 */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: `${tier.color}15`, boxShadow: `0 0 30px ${tier.color}30`, color: tier.color }}>
              <tier.icon size={48} />
            </div>
          </div>
          <p className="text-center text-lg font-bold mb-1" style={{ color: tier.color }}>{tier.label}</p>
          <p className="text-center text-xs text-gray-500 mb-6">{tier.desc}</p>

          {/* 스코어 카드 */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-center py-2.5 border-b border-white/5">
              <span className="text-gray-400 text-sm">정답률</span>
              <span className="text-xl font-bold text-white">{accuracy}%</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-white/5">
              <span className="text-gray-400 text-sm">맞춘 문제</span>
              <span className="text-xl font-bold" style={{ color: '#4ec9b0' }}>{totalCorrect}/{totalAttempts}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-white/5">
              <span className="text-gray-400 text-sm">획득 XP</span>
              <span className="text-xl font-bold text-yellow-400">+{sessionXP}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-gray-400 text-sm">도달 레벨</span>
              <span className="text-xl font-bold" style={{ color: tier.color }}>Lv.{level}</span>
            </div>
          </div>

          {/* AI 멘트 */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-gray-300">{comment}</p>
            {nextTier && (
              <p className="text-[10px] text-gray-500 mt-2">다음 티어 ({nextTier.label})까지 {nextTier.minXP - subjectXP} XP</p>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('quiz'); setCurrentQuiz(null); setFeedback(null); setTotalCorrect(0); setTotalAttempts(0); setSessionXP(0); }}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40` }}
            >
              다시 도전
            </button>
            <button
              onClick={() => { setPhase('select'); setSelectedSubject(null); setCurrentQuiz(null); }}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/[0.04] border border-white/10 text-gray-300 hover:bg-white/[0.08] transition-all hover:-translate-y-0.5"
            >
              과목 선택
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 퀴즈 화면 ─────────────────────────────────
  const tier = getTier(subjectXP);
  const nextTier = getNextTier(subjectXP);
  const subjectInfo = [...SUBJECTS, ...BONUS_SUBJECTS].find(s => s.id === selectedSubject);
  const tierProgress = nextTier ? ((subjectXP - tier.minXP) / (nextTier.minXP - tier.minXP)) * 100 : 100;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden relative" style={{ background: '#0d1117' }}>
      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-semibold text-sm shadow-2xl flex items-center gap-3 animate-fade-in-up"
          style={{ background: toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(78,201,176,0.15)', border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(78,201,176,0.35)'}`, color: toast.type === 'error' ? '#fca5a5' : '#4ec9b0', backdropFilter: 'blur(12px)' }}>
          <span>{toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
      {/* 상단 바 */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleExit} className="text-gray-400 hover:text-white transition p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div>
            <span className="text-sm font-bold text-white">{subjectInfo?.label}</span>
            <span className="text-[10px] text-gray-500 ml-2">Lv.{level}</span>
            {phase === 'quiz' && (
              <button
                onClick={() => { setTestoutInput(''); setTestoutModal(true); }}
                className="text-[9px] text-yellow-400/60 hover:text-yellow-400 ml-2 underline transition-colors"
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ color: tier.color }}><tier.icon size={11} /></span>
          <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</span>
          {phase === 'testout' && (
            <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
              테스트아웃 {testoutCorrect}/{testoutRequired}
            </span>
          )}
          {needTwoCorrect && phase !== 'testout' && (
            <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
              2연속 필요 ({wrongStreak}/2)
            </span>
          )}
        </div>
      </div>

      {/* 티어 프로그레스바 */}
      <div className="shrink-0 px-4 py-2">
        <div className="flex justify-between text-[9px] text-gray-600 mb-1">
          <span>{tier.label}</span>
          <span>{subjectXP} XP</span>
          <span>{nextTier ? nextTier.label : 'MAX'}</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${tierProgress}%`, background: tier.color }} />
        </div>
      </div>

      {/* 세션 단계 진행 바 (예열 → 본게임 → 마무리) */}
      {phase === 'quiz' && (
        <div className="shrink-0 px-4 pb-2">
          {(() => {
            const p = getQuizPhase(totalAttempts + 1);
            const phases = [
              { label: '🟢 예열', range: '1~15문', active: totalAttempts < 15 },
              { label: '🟡 본게임', range: '16~25문', active: totalAttempts >= 15 && totalAttempts < 25 },
              { label: '🔴 마무리', range: '26문~', active: totalAttempts >= 25 },
            ];
            const pct = totalAttempts < 15 ? (totalAttempts / 15) * 100
                      : totalAttempts < 25 ? ((totalAttempts - 15) / 10) * 100
                      : Math.min(((totalAttempts - 25) / 3) * 100, 100);
            return (
              <div>
                <div className="flex items-center justify-between mb-1">
                  {phases.map((ph, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-[9px] font-bold" style={{ color: ph.active ? p.color : 'rgba(255,255,255,0.2)' }}>{ph.label}</span>
                      <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.15)' }}>{ph.range}</span>
                    </div>
                  ))}
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.color, boxShadow: `0 0 6px ${p.color}80` }} />
                </div>
                <div className="flex justify-between text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <span>{totalAttempts}문 완료</span>
                  <span style={{ color: p.color, fontWeight: 700 }}>{p.emoji} {p.label} +{getQuizXP(totalAttempts + 1)} XP/문</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 문제 영역 */}
      <div className="flex-1 overflow-auto px-4 py-6 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${tier.color}60`, borderTopColor: 'transparent' }} />
            <p className="text-sm text-gray-500">문제 생성 중...</p>
          </div>
        ) : currentQuiz ? (() => {
          const cp = detectQuizCodePanel(currentQuiz);
          const OPT_LABELS = ['①', '②', '③', '④', '⑤'];
          return (
            <div
              key={currentQuiz.question}
              className={`flex gap-5 ${cp.show ? 'w-full max-w-5xl flex-row items-start' : 'w-full max-w-lg flex-col'}`}
            >
              {/* ─── 코드 패널 (왼쪽) ─── */}
              {cp.show && (
                <div className="flex-1 min-w-0 quiz-code-panel-enter">
                  <div className="rounded-2xl overflow-hidden border border-white/[0.08]" style={{ background: '#1a1a1a' }}>
                    {/* 맥OS 상단바 */}
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f5680' }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e80' }} />
                        <div className="w-3 h-3 rounded-full" style={{ background: '#27c93f80' }} />
                      </div>
                      <span className="text-[10px] text-gray-600 font-mono">
                        {cp.lang}.{cp.lang === 'python' ? 'py' : cp.lang === 'sql' ? 'sql' : cp.lang === 'javascript' ? 'js' : 'java'}
                      </span>
                    </div>
                    {cp.type === 'question' ? (
                      <SyntaxHighlighter language={cp.lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.25rem', fontSize: '13px', background: 'transparent', lineHeight: '1.6' }} wrapLongLines>
                        {cp.code}
                      </SyntaxHighlighter>
                    ) : (
                      <div className="p-4 space-y-2">
                        {currentQuiz.options.map((opt, i) => {
                          const stripped = opt.replace(/^[①②③④⑤\d\.\s]+/, '').trim();
                          const isSelected = selectedOption === opt;
                          const answerNum = feedback ? currentQuiz.answer.replace(/[^0-9]/g, '') : null;
                          const isCorrectOpt = answerNum === String(i + 1);
                          const isWrongSelected = feedback && isSelected && !feedback.correct;
                          return (
                            <div
                              key={i}
                              onClick={() => !feedback && setSelectedOption(opt)}
                              className={`rounded-xl overflow-hidden border transition-all duration-200 ${!feedback ? 'cursor-pointer' : 'cursor-default'} ${
                                isCorrectOpt && feedback ? 'border-[#4ec9b0]/50' :
                                isWrongSelected ? 'border-red-500/50' :
                                isSelected ? 'border-[#a855f7]/50' : 'border-white/[0.07] hover:border-white/20'
                              }`}
                              style={isSelected && !feedback ? { boxShadow: `0 0 14px ${tier.color}25` } : {}}
                            >
                              <div className={`px-3 py-1 text-[10px] font-bold border-b flex items-center gap-2 ${
                                isCorrectOpt && feedback ? 'bg-[#4ec9b0]/15 border-[#4ec9b0]/20 text-[#4ec9b0]' :
                                isWrongSelected ? 'bg-red-500/15 border-red-500/20 text-red-400' :
                                isSelected ? 'bg-[#a855f7]/15 border-[#a855f7]/15 text-[#a855f7]' :
                                'bg-white/[0.03] border-white/[0.04] text-gray-500'
                              }`}>
                                <span>{OPT_LABELS[i]}</span>
                                {isCorrectOpt && feedback && <span>✓ 정답</span>}
                                {isWrongSelected && <span>✗</span>}
                              </div>
                              <SyntaxHighlighter language={cp.lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.6rem 1rem', fontSize: '12.5px', background: 'transparent' }} wrapLongLines>
                                {stripped}
                              </SyntaxHighlighter>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── 퀴즈 패널 (오른쪽 or 전체) ─── */}
              <div
                className={`flex flex-col gap-4 ${cp.show ? 'w-72 shrink-0 quiz-panel-slide-right' : 'w-full'}`}
              >
                {/* 문제 카드 */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {currentQuiz.type === 'choice' ? '객관식' : currentQuiz.type === 'fill' ? '빈칸 채우기' : currentQuiz.type === 'result' ? '실행 결과' : '주관식'}
                    </span>
                    {currentQuiz.codeHint && (
                      <button
                        onClick={() => setShowCodeHint(!showCodeHint)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                        style={{ color: '#569cd6', background: '#569cd620', border: '1px solid #569cd630' }}
                      >
                        {showCodeHint ? '힌트 닫기' : '코드 해석'}
                      </button>
                    )}
                  </div>
                  {cp.show && cp.type === 'question'
                    ? <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {[cp.textBefore, cp.textAfter].filter(Boolean).join('\n') || currentQuiz.question.replace(/```[\s\S]*?```/g, '').trim()}
                      </p>
                    : renderQuestion(currentQuiz.question)
                  }
                  {showCodeHint && currentQuiz.codeHint && (
                    <div className="mt-4 p-3 bg-[#569cd6]/[0.08] border border-[#569cd6]/20 rounded-xl">
                      <p className="text-xs text-[#569cd6] font-semibold mb-1">코드 해석</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{currentQuiz.codeHint}</p>
                    </div>
                  )}
                </div>

                {/* 답변 영역 */}
                {!feedback ? (
                  <>
                    {currentQuiz.type === 'choice' && currentQuiz.options?.length > 0 ? (
                      cp.show && cp.type === 'options' ? (
                        /* 코드패널 모드: 큰 번호 버튼 */
                        <div className="space-y-2">
                          {currentQuiz.options.map((opt, i) => {
                            const isSelected = selectedOption === opt;
                            return (
                              <button key={i} onClick={() => setSelectedOption(opt)}
                                className={`w-full py-3 rounded-xl border font-bold text-xl transition-all hover:-translate-y-0.5 ${isSelected ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                                style={isSelected
                                  ? { borderColor: `${tier.color}60`, background: `${tier.color}18`, boxShadow: `0 0 14px ${tier.color}25` }
                                  : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }
                                }>
                                {OPT_LABELS[i]}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentQuiz.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedOption(opt)}
                              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                                selectedOption === opt
                                  ? 'border-[#a855f7]/50 bg-[#a855f7]/10 text-white'
                                  : 'border-white/[0.08] bg-white/[0.02] text-gray-300 hover:bg-white/[0.05] hover:border-white/15'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )
                    ) : (
                      <div>
                        <input
                          ref={inputRef}
                          type="text"
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                          placeholder="답을 입력하세요..."
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#a855f7]/50 focus:ring-1 focus:ring-[#a855f7]/30 transition-all"
                          autoFocus
                        />
                      </div>
                    )}
                    <button
                      onClick={phase === 'testout' ? handleTestoutSubmit : handleSubmit}
                      disabled={currentQuiz.type === 'choice' ? !selectedOption : !userAnswer.trim()}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-0.5"
                      style={{ background: phase === 'testout' ? '#eab308' : '#a855f7', color: phase === 'testout' ? 'black' : 'white' }}
                    >
                      {phase === 'testout' ? '제출 (테스트아웃)' : '제출'}
                    </button>
                  </>
                ) : (
                  /* 피드백 */
                  <div>
                    <div className={`p-5 rounded-2xl border mb-4 ${
                      feedback.correct
                        ? 'bg-[#4ec9b0]/[0.08] border-[#4ec9b0]/30'
                        : 'bg-red-500/[0.08] border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        {feedback.correct ? (
                          <>
                            <span className="text-lg">✅</span>
                            <span className="text-[#4ec9b0] font-bold">정답!</span>
                            {streak >= 3 && <span className="text-xs text-yellow-400 font-bold ml-2">{streak}연속 🔥</span>}
                          </>
                        ) : (
                          <>
                            <span className="text-lg">❌</span>
                            <span className="text-red-400 font-bold">오답</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{feedback.explanation}</p>
                      {!feedback.correct && (
                        <p className="text-xs text-yellow-400/80 mt-3 font-semibold">
                          같은 개념 문제를 2번 연속 맞춰야 넘어갈 수 있어요!
                        </p>
                      )}
                      {feedback.correct && !needTwoCorrect && (
                        <p className="text-xs text-[#4ec9b0]/80 mt-3">+10 XP</p>
                      )}
                    </div>
                    {/* 다음 행동 버튼 */}
                    <div className="flex gap-2">
                      {phase === 'testout' ? (
                        <>
                          {feedback.correct && testoutCorrect >= testoutRequired ? (
                            <button
                              onClick={handleTestoutNext}
                              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 bg-[#4ec9b0]/15 text-[#4ec9b0] border border-[#4ec9b0]/30"
                            >
                              테스트아웃 통과! 🎉
                            </button>
                          ) : (
                            <button
                              onClick={handleTestoutNext}
                              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                              style={{ background: feedback.correct ? '#eab30820' : '#ef444420', color: feedback.correct ? '#eab308' : '#ef4444', border: `1px solid ${feedback.correct ? '#eab30840' : '#ef444440'}` }}
                            >
                              {feedback.correct ? '다음 문제' : '테스트아웃 실패 — 돌아가기'}
                            </button>
                          )}
                        </>
                      ) : feedback.correct && !needTwoCorrect ? (
                        <>
                          <button
                            onClick={handleNext}
                            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                            style={{ background: '#a855f720', color: '#a855f7', border: '1px solid #a855f740' }}
                          >
                            다음 레벨
                          </button>
                          <button
                            onClick={() => { setCurrentQuiz(null); setFeedback(null); generateQuiz(); }}
                            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30"
                          >
                            심화문제
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleNext}
                          className="flex-1 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                          style={{ background: '#a855f720', color: '#a855f7', border: '1px solid #a855f740' }}
                        >
                          다음 문제
                        </button>
                      )}
                      {phase !== 'testout' && (
                        <button
                          onClick={handleExit}
                          className="px-5 py-3 rounded-xl font-bold text-sm bg-white/[0.04] border border-white/10 text-gray-400 hover:bg-white/[0.08] transition-all hover:-translate-y-0.5"
                        >
                          나가기
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })() : null}
      </div>

      {/* 테스트아웃 레벨 입력 모달 */}
      {testoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setTestoutModal(false)}>
          <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-6 w-[340px] shadow-[0_16px_64px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#eab308]/10 flex items-center justify-center">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">테스트아웃</p>
                <p className="text-xs text-gray-500">현재 레벨: {level}</p>
              </div>
            </div>
            <input
              autoFocus
              type="number"
              value={testoutInput}
              onChange={e => setTestoutInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const num = parseInt(testoutInput);
                  if (num && num > level) { setTestoutModal(false); startTestout(num); }
                }
              }}
              placeholder={`${level + 1} 이상 입력`}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#eab308]/50 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setTestoutModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                취소
              </button>
              <button onClick={() => {
                  const num = parseInt(testoutInput);
                  if (num && num > level) { setTestoutModal(false); startTestout(num); }
                }}
                disabled={!testoutInput || parseInt(testoutInput) <= level}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#eab308] bg-[#eab308]/10 border border-[#eab308]/20 hover:bg-[#eab308]/20 transition-all disabled:opacity-30">
                도전
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelUpView;
