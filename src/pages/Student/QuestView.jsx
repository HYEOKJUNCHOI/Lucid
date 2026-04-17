import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import CodePeekButton from '../../components/common/mobile/CodePeekButton';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getApiKey } from '../../lib/apiKey';
import { auth } from '../../lib/firebase';
import { doc, updateDoc, increment, serverTimestamp, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getQuestDropRate } from '../../services/learningService';
import { onQuestCompleteFS, getUserState, getQuestRepeatCountFS, recordQuestRepeatFS, addDailyXPCapped, rollBeanDropFS } from '../../services/userStateService';
import BeanRewardCard from '../../components/common/BeanRewardCard';
import nightOwlTheme from '../../themes/nightOwl.json';
import ChatBubble from '../../components/chat/ChatBubble';
import ChatInput from '../../components/chat/ChatInput';
import { MODELS, OPENAI_CHAT_URL } from '../../lib/aiConfig';

// ─── 파일 확장자 → Monaco language ──────────────
const extToLang = (name) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  return { java:'java', js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript', py:'python', html:'html', css:'css', jsp:'html' }[ext] || 'plaintext';
};

// ─── 로딩 멘트 ─────────────────────────────────
const LOADING_MSGS = {
  prepare: ['오늘 볼 코드 준비하는 중...', '퀘스트 세팅하는 중...', '코드 꺼내오는 중...'],
  explain: ['쉬운 비유 떠올리는 중...', '이해하기 쉽게 정리하는 중...', '현실 세계에서 예시 찾는 중...'],
  easier: ['더 쉬운 예시 생각중...', '초등학생도 알아듣게 바꾸는 중...', '새로운 비유 준비중...'],
  quiz: ['딱 맞는 문제 고르는 중...', '실력 확인 문제 만드는 중...', '명확한 문제만 골라내는 중...'],
  easierQuiz: ['더 쉬운 문제 준비하는 중...', '기초부터 다시 물어볼게...'],
};
const pickMsg = (key) => { const arr = LOADING_MSGS[key] || LOADING_MSGS.prepare; return arr[Math.floor(Math.random() * arr.length)]; };

// ─── 프롬프트 ──────────────────────────────────
const EXPLAIN_PROMPT = `당신은 코딩 국비교육 멘토입니다. 다음 코드를 **완전 초보자**에게 설명합니다.

## 어휘 규칙 (가장 중요)
- 묵시적 → "말 안 해도 알아서", 명시적 → "직접 말해주는"
- 캐스팅 → "마법사가 마법 쓰듯, 타입을 바꾸는 것"
- 업캐스팅 → "작은 그릇 → 큰 그릇으로 옮기기 (당연히 됨)"
- 다운캐스팅 → "큰 그릇 → 작은 그릇으로 옮기기 (넘칠 수 있으니 직접 말해줘야 함)"
- 파라미터 → "재료", 리턴 → "결과물", 변수 → "이름표 붙은 상자"
- 프로그래밍 전문용어가 나오면 반드시 괄호 안에 일상 표현을 넣으세요

## 비유 규칙
- 돈 비유: 1.5원은 없으니까 double이 필요 (달러 → 원 환전 느낌)
- 게임 비유: 캐스팅은 게임에서 마법 쓰는 것, int→long은 레벨업
- 일상 비유: byte→int는 텀블러→양동이, 컵 크기 생각

## 무시할 코드
- package, import 줄은 설명하지 마세요. 아예 언급하지 마세요.
- 클래스 선언부(public class ...)도 간단히만 넘어가세요.
- 실제 로직이 있는 줄에 집중하세요.

## 형식
1. **한 줄 요약**: 이 코드가 뭐 하는 코드인지 한 문장
2. **줄별 해석**: 중요한 줄마다 쉬운 말로 설명 (코드 인용 포함)
3. **핵심 정리**: 기억할 것 2~3개 bullet

마크다운 사용. 코드 인용 시 \`backtick\` 사용.`;

const EASIER_PROMPT = `학생이 이전 설명을 이해하지 못했습니다. 단어도 어렵고, 예시도 와닿지 않았습니다.
**단어와 비유 둘 다** 완전히 바꿔서 처음부터 다시 설명해주세요.

## 단어 규칙
- 한자어/영어 금지. 순우리말이나 초등학생도 아는 표현만
- "~입니다" 대신 "~이야/~거야" 말투 (친구한테 말하듯)
- 한 문장에 개념 하나만. 길면 끊어

## 비유 규칙 (이전과 완전히 다른 비유를 써야 함)
- 이전에 컵/그릇 비유 썼으면 → 이번엔 택배 상자, 서랍, 가방 등
- 이전에 돈 비유 썼으면 → 이번엔 게임 아이템, 레벨, 경험치 등
- 이전에 게임 비유 썼으면 → 이번엔 편의점, 학교, 요리 등
- 학생의 일상에서 매일 접하는 것으로 비유 (배달앱, 유튜브, 카톡 등)

## 설명 방식
- 코드 한 줄씩 짚으면서 "이건 ~하는 거야" 식으로
- 왜 이렇게 써야 하는지 이유를 꼭 말해줘 ("안 그러면 ~돼서 문제야")
- 마지막에 한 줄 요약: "결국 이 코드는 ~하는 코드야"

절대 이전 설명을 반복하지 마. 구조도 비유도 전부 새로 써.`;

// ─── 난이도 레이블 ────────────────────────────────

const DIFF_LABELS = ['왕초보', '초보', '기본', '중급', '고급'];

// ─── 퀴즈 프롬프트 (3문제 세트) ─────────────────
const buildQuizPrompt = (fileName, codeText, diffLevel, isEasier = false) => {
  const diffLabel = DIFF_LABELS[diffLevel] || '기본';
  return `아래 [코드]만 보고 확인 문제 3개를 만드세요. 난이도: ${diffLabel}${isEasier ? ' (이전보다 더 쉽게)' : ''}

[코드]
\`\`\`
${codeText}
\`\`\`

## 문제 구성
1번: 4지선다 또는 O/X (랜덤 선택)
2번: 4지선다
3번: 빈칸 채우기

## 절대 규칙 (위반 시 문제 자체가 무효)
- **모든 문제는 위 [코드]에 실제로 존재하는 내용만 다룬다. 코드에 없는 변수·메소드·클래스를 절대 언급하지 마라.**
- 빈칸 채우기: [코드]에서 한 줄을 그대로 가져와 핵심 토큰 하나만 ___로 바꾼다. 코드를 새로 만들지 마라.
- 정답이 여러 개일 수 있는 애매한 문제 금지
- package, import 관련 문제 금지
- O/X는 코드 동작에 대한 사실 확인 문제로만

## JSON 형식으로만 응답:
{"questions":[
  {"type":"multiple_choice 또는 ox","question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"},
  {"type":"multiple_choice","question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"},
  {"type":"fill_blank","question":"문제 설명","code_with_blank":"[코드]에서 가져온 줄 (___가 빈칸)","answer":"정답 코드","explanation":"해설"}
]}

O/X 문제의 경우 options는 ["⭕ 맞다","❌ 틀리다"]로.
파일: ${fileName}`;
};

// ─── 아코디언 섹션 (ChatView 카드 스타일) ────────
const AccordionSection = ({ title, content, expanded, onToggle, accentColor = '#f59e0b', variant = 'amber', onTokenClick }) => {
  const variantMap = {
    sky:     { border: 'hover:border-sky-500/30',     bg: 'hover:bg-sky-500/5',     shadow: 'hover:shadow-[0_0_20px_rgba(56,189,248,0.08)]',   strong: '#7dd3fc' },
    emerald: { border: 'hover:border-emerald-500/30', bg: 'hover:bg-emerald-500/5', shadow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]',   strong: '#6ee7b7' },
    amber:   { border: 'hover:border-amber-500/30',   bg: 'hover:bg-amber-500/5',   shadow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]',   strong: '#fcd34d' },
  };
  const v = variantMap[variant] || variantMap.amber;
  return (
    <div className={`group relative rounded-xl border border-white/[0.06] ${v.border} bg-white/[0.02] ${v.bg} transition-all duration-300 shadow-sm ${v.shadow} mb-3`}>
      {/* 헤더 */}
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-[12px] font-bold tracking-wide transition-colors" style={{ color: expanded ? accentColor : '#9ca3af' }}>{title}</span>
        <span className="text-[10px] text-gray-600 transition-transform duration-200 ml-2 shrink-0" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
      </button>
      {/* 본문 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}
            className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-li:my-0.5 prose-code:bg-white/10 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
            components={{
              code: ({ children }) => {
                const txt = String(children).trim();
                return (
                  <code
                    className="code-token-clickable text-[11px] bg-white/5 px-1.5 rounded"
                    style={{ color: '#9cdcfe', cursor: 'inherit' }}
                    onClick={(e) => { if ((e.ctrlKey || e.metaKey) && onTokenClick) { e.preventDefault(); onTokenClick(txt); } }}
                  >{children}</code>
                );
              },
              strong: ({ children }) => <span className="font-semibold" style={{ color: v.strong }}>{children}</span>,
              h1: () => null, h2: () => null, h3: () => null,
            }}
          >{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// ─── Chrome 스타일 탭 버튼 ─────────────────────
const TabButton = ({ active, shortcut, label, onClick }) => (
  <button
    onClick={onClick}
    className={`relative flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold whitespace-nowrap rounded-t-lg -mb-px transition-all select-none ${
      active
        ? 'chrome-tab-active bg-[#0d0d0d] text-white border border-white/[0.10] border-b-[#0d0d0d] z-10'
        : 'chrome-tab-inactive text-gray-500 border border-transparent hover:text-gray-300'
    }`}
  >
    {shortcut && (
      <span className={`text-[9px] px-1 py-0.5 rounded font-mono border ${active ? 'bg-white/[0.08] border-white/[0.14] text-gray-300' : 'bg-white/[0.03] border-white/[0.07] text-gray-600'}`}>{shortcut}</span>
    )}
    {label}
  </button>
);

// ─── 채팅 프롬프트 ──────────────────────────────
const CHAT_SYSTEM = `당신은 친절한 코딩 멘토입니다. 학생이 코드에 대해 자유롭게 질문합니다.
- 쉬운 말로 대답하세요
- package, import는 언급하지 마세요
- 짧게 핵심만 답하세요
- 코드 인용 시 backtick 사용

## 문제 오류 대응 (중요)
퀴즈 문제가 주어졌을 때, 학생이 "이 문제 이상해요", "틀린 문제 같아요", "이게 왜 정답이에요?" 같은 항의를 하면:
1. 먼저 실제 코드를 기준으로 문제가 맞는지 직접 검증하세요
2. 만약 문제가 정말 잘못됐다면(코드에 없는 변수, 틀린 정답 등) 솔직하게 인정하고 사과하세요: "맞아요, 이 문제는 잘못 만들어졌네요. 죄송합니다!"
3. 잘못된 문제라면 올바른 문제가 무엇이었어야 하는지도 설명해주세요
4. 정답이 맞는 문제라면 왜 그게 정답인지 친절하게 설명하세요
절대로 틀린 문제를 맞다고 우기지 마세요.`;

// ═══════════════════════════════════════════════
const QuestView = ({ teacher, repo, chapters, chapterFilesMap, chaptersLoading, visitedFiles, userData, onBack }) => {
  // ─── 반응형 ───────────────────────────────────
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState('code'); // 'code' | 'quiz'

  // ─── 상태 ─────────────────────────────────────
  const [routineItems, setRoutineItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('lucid_quest_progress')); return saved?.idx || 0; } catch { return 0; }
  });
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [isTypingMode, setIsTypingMode] = useState(false);
  const [typingCode, setTypingCode] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);

  // 원두 드랍 상태
  const [beanDrop, setBeanDrop] = useState(null); // null | { isFirst, beanCount }

  // ─── Monaco ref ──────────────────────────────
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const highlightDecorRef = useRef([]);

  // 키워드·타입명·예약어 — Ctrl+클릭 무시 목록
  const SKIP_HIGHLIGHT = new Set([
    // Java 키워드
    'public','private','protected','static','final','abstract','synchronized','native','transient','volatile',
    'void','class','interface','enum','extends','implements','new','return',
    'if','else','for','while','do','break','continue','switch','case','default',
    'try','catch','finally','throw','throws','import','package','this','super',
    'null','true','false','instanceof',
    // Java 기본 타입
    'int','long','double','float','boolean','char','byte','short',
    // 자주 등장하는 클래스명 (타입으로만 쓰여서 의미없는 점프)
    'String','Integer','Long','Double','Float','Boolean','Character','Byte','Short',
    'Object','System','Math','Arrays','ArrayList','LinkedList','List','Map','HashMap',
    'HashSet','Set','Queue','Stack','Scanner','Random',
    // JS/TS 키워드
    'const','let','var','function','async','await','return','if','else','for','while',
    'import','export','default','from','class','extends','new','this','super',
    'typeof','instanceof','null','undefined','true','false','try','catch','finally',
    'throw','switch','case','break','continue',
  ]);

  // 코드 토큰 Ctrl+Click → Monaco 에디터 하이라이트
  const highlightCodeToken = (token) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !code) return;
    const searchText = token.replace(/\(\)$/, '').trim();
    // 키워드·타입·단순 기호는 무시
    if (!searchText || SKIP_HIGHLIGHT.has(searchText) || searchText.length <= 1) return;
    const model = editor.getModel();
    if (!model) return;
    const matches = model.findMatches(searchText, false, false, true, null, false);
    if (matches.length === 0) return;
    // 변수 선언부(= 가 있는 줄)를 우선, 없으면 첫 번째
    const best = matches.find(m => {
      const lineContent = model.getLineContent(m.range.startLineNumber);
      return lineContent.includes('=') || lineContent.includes('println') || lineContent.includes('print(');
    }) || matches[0];
    const line = best.range.startLineNumber;
    editor.revealLineInCenter(line);
    highlightDecorRef.current = editor.deltaDecorations(highlightDecorRef.current, [
      { range: best.range, options: { inlineClassName: 'code-token-highlight' } },
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'code-line-highlight' } },
    ]);
    setTimeout(() => { highlightDecorRef.current = editor.deltaDecorations(highlightDecorRef.current, []); }, 1500);
    setLeftTab(1);
  };

  // Ctrl 키 → body 클래스 토글 (해석 패널 밑줄 CSS용)
  useEffect(() => {
    const onDown = (e) => { if (e.ctrlKey || e.metaKey) document.body.classList.add('ctrl-held'); };
    const onUp = () => document.body.classList.remove('ctrl-held');
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onUp);
      document.body.classList.remove('ctrl-held');
    };
  }, []);

  // ─── 패널 리사이즈 ─────────────────────────────
  const splitContainerRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const isDraggingRef = useRef(false);
  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const onMouseMove = (ev) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      setSplitRatio(Math.max(0.25, Math.min(0.75, (ev.clientX - rect.left) / rect.width)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ─── 탭 상태 ─────────────────────────────────
  const [leftTab, setLeftTab] = useState(1); // 1=수업코드, 2=AI코드
  const [rightTab, setRightTab] = useState(3); // 3=채팅, 4=퀴즈
  const [quizVisible, setQuizVisible] = useState(false); // 퀴즈가 시작됐는지 여부

  // 해석 + 메타포 자동 분석
  const [analysisResult, setAnalysisResult] = useState(null); // null | { functional, metaphor }
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ functional: false, metaphor: false });
  const [voteState, setVoteState] = useState({ functional: null, metaphor: null }); // null | 'up' | 'down'

  // 퀴즈 로딩 메시지
  const [loadingMsg, setLoadingMsg] = useState('');

  // 퀴즈
  const [quizQuestions, setQuizQuestions] = useState([]); // 3문제 배열
  const [quizIdx, setQuizIdx] = useState(0); // 현재 문제 인덱스
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [fillAnswer, setFillAnswer] = useState(''); // 빈칸 입력
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizHearts, setQuizHearts] = useState(3); // 하트 3개
  const [heartLostIdx, setHeartLostIdx] = useState(null); // 소멸 애니메이션 중인 하트 인덱스
  const [screenFlash, setScreenFlash] = useState(false); // 오답 시 화면 붉은 플래시
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null); // null | 'invalid' | 'valid' | 'error'
  const [quizCorrect, setQuizCorrect] = useState(0); // 맞춘 수
  const [quizDone, setQuizDone] = useState(false); // 결과 화면

  // 종료 확인 모달
  const [exitConfirm, setExitConfirm] = useState(false);

  // 채팅
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSuggestions, setChatSuggestions] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // phase: loading | active | done
  const [phase, setPhase] = useState('loading');

  // ─── F2: 아코디언 사이클 / 퀴즈 다음 문제 ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      if (rightTab === 3 && analysisResult) {
        setExpandedSections(prev => {
          if (!prev.functional && !prev.metaphor) return { functional: true, metaphor: false };
          if (prev.functional && !prev.metaphor) return { functional: false, metaphor: true };
          return { functional: false, metaphor: false };
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rightTab, quizVisible, analysisResult, quizFeedback, quizDone, quizHearts, quizIdx, quizQuestions.length]);

  // ─── Shift+1/2/3/4 단축키 ──────────────────
  const shiftHandlerRef = useRef({});
  useEffect(() => {
    const handler = (e) => {
      if (!e.shiftKey) return;
      if (e.code === 'Digit1') { e.preventDefault(); setLeftTab(1); }
      else if (e.code === 'Digit2') { e.preventDefault(); setLeftTab(2); }
      else if (e.code === 'Digit3') { e.preventDefault(); setRightTab(3); }
      else if (e.code === 'Digit4') {
        e.preventDefault();
        const { quizVisible: qv, code: c, requestQuiz: rq } = shiftHandlerRef.current;
        setRightTab(4);
        if (!qv && c) rq();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── 우측 패널 Ctrl+Wheel 줌 ─────────────────
  const [panelFontSize, setPanelFontSize] = useState(14);
  const rightPanelRef = useRef(null);
  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setPanelFontSize(prev => Math.max(11, Math.min(22, prev + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  });

  // ─── 약점 파일 (Firestore 기반) ──────────────────
  const getWeakFiles = () => userData?.weakFiles || [];
  const removeWeakFile = (path) => {
    const uid = auth.currentUser?.uid;
    if (uid) updateDoc(doc(db, 'users', uid), { weakFiles: arrayRemove(path) });
  };

  // ─── 챕터 파일 자동 로드 ──────────────────────
  const [filesLoading, setFilesLoading] = useState(false);
  const [localFilesMap, setLocalFilesMap] = useState({});

  useEffect(() => {
    if (chaptersLoading || !chapters || chapters.length === 0) return;
    const hasAnyFiles = chapters.some(ch => (chapterFilesMap[ch.name] || []).length > 0);
    if (hasAnyFiles || filesLoading) return;
    const loadFiles = async () => {
      if (!teacher?.githubUsername || !repo?.name) return;
      setFilesLoading(true);
      try {
        const headers = {};
        if (import.meta.env.VITE_GITHUB_TOKEN) headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
        const treeRes = await fetch(`https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/git/trees/HEAD?recursive=1`, { headers });
        const tree = (await treeRes.json()).tree || [];
        const map = {};
        chapters.forEach(ch => {
          map[ch.name] = tree
            .filter(it => it.type === 'blob' && it.path.startsWith(ch.fullPath + '/') && !it.path.substring(ch.fullPath.length + 1).includes('/') && /\.(java|js|jsx|ts|tsx|py|html|css|jsp)$/.test(it.path))
            .map(it => ({ name: it.path.split('/').pop(), downloadUrl: `https://raw.githubusercontent.com/${teacher.githubUsername}/${repo.name}/HEAD/${it.path}`, path: it.path }));
        });
        setLocalFilesMap(map);
      } catch (e) { console.warn('퀘스트 파일 로드 실패:', e); }
      finally { setFilesLoading(false); }
    };
    loadFiles();
  }, [chapters, chapterFilesMap, chaptersLoading, teacher, repo]);

  const mergedFilesMap = useMemo(() => ({ ...localFilesMap, ...chapterFilesMap }), [localFilesMap, chapterFilesMap]);

  // ─── 퀘스트 아이템 구성 (1회) ─────────────────
  const [routineReady, setRoutineReady] = useState(false);
  useEffect(() => {
    if (routineReady) return;
    if (chaptersLoading || filesLoading) { setPhase('loading'); return; }
    if (!chapters || chapters.length === 0) { setPhase('done'); return; }
    const allFiles = [];
    chapters.forEach(ch => (mergedFilesMap[ch.name] || []).forEach(f => allFiles.push({ ...f, chapterLabel: ch.label || ch.name })));
    if (allFiles.length === 0) { if (!Object.keys(mergedFilesMap).length) { setPhase('loading'); return; } setPhase('done'); return; }

    const items = [];
    const weakPaths = getWeakFiles();
    allFiles.filter(f => !visitedFiles.includes(f.path)).slice(0, 3).forEach(f => items.push({ type: 'new', file: f, chapterLabel: f.chapterLabel }));
    allFiles.filter(f => weakPaths.includes(f.path)).slice(0, 2).forEach(f => items.push({ type: 'weak', file: f, chapterLabel: f.chapterLabel }));
    const review = allFiles.filter(f => visitedFiles.includes(f.path) && !weakPaths.includes(f.path));
    if (review.length > 0) items.push({ type: 'review', file: review[Math.floor(Math.random() * review.length)], chapterLabel: review[0].chapterLabel });
    if (!items.length) [...allFiles].sort(() => Math.random() - 0.5).slice(0, 3).forEach(f => items.push({ type: 'review', file: f, chapterLabel: f.chapterLabel }));

    setRoutineItems(items);
    // 저장된 진행 상태 복원
    try {
      const saved = JSON.parse(localStorage.getItem('lucid_quest_progress'));
      const today = new Date().toDateString();
      if (saved && saved.date === today && saved.idx < items.length) {
        // 같은 퀘스트 아이템인지 확인 (파일 경로 비교)
        const savedPaths = saved.paths || [];
        const currentPaths = items.map(i => i.file.path);
        if (JSON.stringify(savedPaths) === JSON.stringify(currentPaths)) {
          setCurrentIdx(saved.idx);
        }
      }
    } catch { /* ignore */ }
    setPhase('active');
    setRoutineReady(true);
  }, [chapters, mergedFilesMap, chaptersLoading, filesLoading, visitedFiles, routineReady]);

  // ─── 코드 로드 ────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || !routineItems.length || currentIdx >= routineItems.length) return;
    const item = routineItems[currentIdx];
    setCodeLoading(true);
    resetRightPanel();

    fetch(item.file.downloadUrl)
      .then(r => r.text())
      .then(text => { setCode(text); setCodeLoading(false); })
      .catch(() => { setCode('// 코드를 불러올 수 없습니다'); setCodeLoading(false); });
  }, [phase, currentIdx, routineItems]);

  const resetRightPanel = () => {
    setRightTab(3);
    setQuizVisible(false);
    setAnalysisResult(null);
    setAnalysisLoading(false);
    setExpandedSections({ functional: false, metaphor: false });
    setVoteState({ functional: null, metaphor: null });
    setChatMessages([]);
    usedMetaphorsRef.current = [];
    setQuizQuestions([]);
    setQuizIdx(0);
    setSelectedAnswer(null);
    setQuizFeedback(null);
    setFillAnswer('');
    setQuizHearts(3);
    setHeartLostIdx(null);
    setScreenFlash(false);
    setQuizCorrect(0);
    setQuizDone(false);
    setChatMessages([]);
    setChatInput('');
  };

  // ─── 코드 로드 시 자동 분석 (기능적 해석 + 메타포) ──
  useEffect(() => {
    if (!code || phase !== 'active' || !routineItems[currentIdx]) return;
    let cancelled = false;
    const run = async () => {
      setAnalysisLoading(true);
      setAnalysisResult(null);
      setExpandedSections({ functional: false, metaphor: false });
      try {
        const apiKey = getApiKey();
        if (!apiKey || cancelled) { if (!cancelled) setAnalysisLoading(false); return; }
        const item = routineItems[currentIdx];
        const codeContext = `파일명: ${item.file.name}\n\n${code.substring(0, 3000)}`;

        // Agent 1: 기능적 해석
        const prompt1 = `${codeContext}\n\n위 코드를 마이크로 단위로 해석해라.\n\n[규칙]\n- 코드의 각 핵심 라인이 무슨 일을 하는지 구체적으로 설명\n- 변수명, 메서드명, 타입명을 반드시 백틱으로 감싸서 포함\n- "값이 어디서 생기고, 어디로 가고, 어떻게 변하는지" 흐름을 짚어라\n- 불필요한 일반 설명 금지 (프로그램 시작점, import 설명 등)\n- package, import 줄은 언급하지 마라\n- 결과는 '### 🧩 기능적 해석'으로 시작\n- 번호 매겨서 단계별로 작성`;
        const res1Data = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: MODELS.CHAT, messages: [{ role: 'user', content: prompt1 }], temperature: 0.7, max_tokens: 800 }),
        });
        const res1 = (await res1Data.json()).choices?.[0]?.message?.content?.trim() || '';
        if (cancelled) return;

        // Agent 2: 메타포
        const prompt2 = `너는 10년차 코딩 강사이자, 비유의 천재다.\n코드의 각 요소를 현실 세계의 무언가에 1:1로 매핑하는 메타포 설명을 만들어라.\n\n[핵심 원칙]\n- 소재는 자유롭게 골라라. 단, 코드 구조/역할과 진짜 비슷한 것으로.\n- 하나의 세계관 안에서 일관되게\n- 코드의 주요 요소(클래스, 변수, 메서드)마다 현실에서 정확히 뭐에 해당하는지 매핑해라.\n\n[출력 형식]\n- 제목/섹션 헤딩 없이 요소별 매핑만 나열\n- 마크다운 헤딩(#, ##, ###) 사용 금지\n- 각 항목의 코드 요소 이름은 반드시 **굵게** 표시 예: **클래스**: 설명`;
        const res2Data = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: MODELS.CHAT, messages: [
            { role: 'user', content: prompt1 },
            { role: 'assistant', content: res1 },
            { role: 'user', content: prompt2 },
          ], temperature: 0.8, max_tokens: 800 }),
        });
        const res2 = (await res2Data.json()).choices?.[0]?.message?.content?.trim() || '';
        if (cancelled) return;
        setAnalysisResult({ functional: res1, metaphor: res2 });
        // 채팅창에 분석 메시지 추가 (접힌 상태)
        setChatMessages([{ role: 'assistant', isAnalysis: true, functional: res1, metaphor: res2, funcOpen: false, metaOpen: false }]);
      } catch (e) { console.warn('분석 실패:', e); }
      finally { if (!cancelled) setAnalysisLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [code]);

  // ─── 메타포 셔플 ──────────────────────────────
  const [metaphorShuffling, setMetaphorShuffling] = useState(false);
  const usedMetaphorsRef = useRef([]); // 이미 사용한 비유 텍스트 누적
  const shuffleMetaphor = async () => {
    if (metaphorShuffling || !analysisResult) return;
    setMetaphorShuffling(true);
    // 현재 비유를 사용 목록에 추가
    usedMetaphorsRef.current = [...usedMetaphorsRef.current, analysisResult.metaphor];
    try {
      const apiKey = getApiKey();
      if (!apiKey) return;
      const item = routineItems[currentIdx];
      const usedList = usedMetaphorsRef.current.map((m, i) => `[이전 비유 ${i + 1}]\n${m.substring(0, 300)}`).join('\n\n');
      const prompt2 = `너는 10년차 코딩 강사이자, 비유의 천재다.
아래 [이전 비유들]에서 사용한 소재와 완전히 다른 새로운 소재로 비유를 만들어라.

[이전 비유들 — 이 소재들은 절대 재사용 금지]
${usedList}

[새 비유 규칙]
- 위 이전 비유들과 소재/직업/장소/세계관이 겹치면 안 됨. 완전히 새로운 것.
- 코드의 각 주요 요소(클래스, 변수, 메서드)를 현실 세계의 것에 1:1 매핑
- 하나의 세계관 안에서 일관되게
- 소재 예시(골라도 되고 아니어도 됨): 배달앱, 편의점, 군대, 주방, 택배, 병원, 게임, 학교 수업, 버스, 공장, 은행, 마트 계산대 등

[출력 형식]
- 제목/섹션 헤딩 없이 요소별 매핑만 나열
- 마크다운 헤딩(#, ##, ###) 사용 금지
- 각 항목의 코드 요소 이름은 반드시 **굵게** 표시 예: **클래스**: 설명`;
      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODELS.CHAT, messages: [
          { role: 'user', content: `파일명: ${item.file.name}\n\n코드:\n${code.substring(0, 3000)}` },
          { role: 'assistant', content: analysisResult.functional },
          { role: 'user', content: prompt2 },
        ], temperature: 1.0, max_tokens: 800 }),
      });
      const newMetaphor = (await res.json()).choices?.[0]?.message?.content?.trim() || '';
      setAnalysisResult(prev => {
        const updated = { ...prev, metaphor: newMetaphor };
        // 채팅 메시지도 업데이트
        setChatMessages(msgs => msgs.map(m => m.isAnalysis ? { ...m, metaphor: newMetaphor } : m));
        return updated;
      });
      setVoteState(prev => ({ ...prev, metaphor: null }));
    } catch (e) { console.warn('메타포 셔플 실패:', e); }
    finally { setMetaphorShuffling(false); }
  };

  // ─── 퀴즈 요청 (3문제 세트) ───────────────────
  const requestQuiz = async (isEasier = false) => {
    setQuizLoading(true);
    setLoadingMsg(pickMsg(isEasier ? 'easierQuiz' : 'quiz'));
    setRightTab(4);
    setQuizVisible(true);
    setQuizQuestions([]);
    setQuizIdx(0);
    setSelectedAnswer(null);
    setQuizFeedback(null);
    setFillAnswer('');
    setQuizHearts(3);
    setHeartLostIdx(null);
    setScreenFlash(false);
    setQuizCorrect(0);
    setQuizDone(false);

    try {
      const apiKey = getApiKey();
      if (!apiKey) { setQuizLoading(false); return; }
      const item = routineItems[currentIdx];
      const curDiff = userData?.difficultyLevel ?? 1;
      const diff = isEasier ? Math.max(0, curDiff - 1) : curDiff;
      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODELS.CHAT,
          messages: [
            { role: 'system', content: buildQuizPrompt(item.file.name, code, diff, isEasier) },
            { role: 'user', content: code },
          ],
          temperature: 0.8,
          max_tokens: 1200,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setQuizQuestions(parsed.questions || []);
      setChatMessages([{ role: 'assistant', content: '방금 나온 문제 나도 봤어요. 막히면 물어보세요!' }]);
      setChatSuggestions(['💡 힌트 주세요', '📖 해설 설명해주세요', '🤔 문제가 왜 이렇게 되나요?', '🚩 문제가 이상한 것 같아요']);
    } catch (e) {
      console.warn('퀴즈 생성 실패:', e);
      setQuizQuestions([{ type: 'multiple_choice', question: '문제 생성에 실패했습니다. 다음으로 넘어갈게요.', options: ['확인'], answer: '확인', explanation: '' }]);
    } finally { setQuizLoading(false); }
  };

  // shiftHandlerRef: requestQuiz 정의 이후에 최신값 주입
  shiftHandlerRef.current = { quizVisible, code, requestQuiz };

  // 피드백 표시되면 퀴즈 패널에 포커스 → Enter로 다음 문제 가능
  useEffect(() => {
    if (quizFeedback && rightTab === 4) {
      setTimeout(() => document.getElementById('quiz-panel')?.focus(), 50);
    }
  }, [quizFeedback, rightTab]);

  // ─── 퀴즈 답 처리 ────────────────────────────
  const handleAnswer = async (answer) => {
    if (quizFeedback) return;
    const q = quizQuestions[quizIdx];
    const isCorrect = q.type === 'fill_blank'
      ? answer.trim().toLowerCase() === q.answer.trim().toLowerCase()
      : answer === q.answer;

    setSelectedAnswer(answer);
    setQuizFeedback({ correct: isCorrect, explanation: q.explanation });
    // 난이도 Firestore 갱신
    { const uid = auth.currentUser?.uid;
      if (uid) {
        const cur = userData?.difficultyLevel ?? 1;
        const next = Math.max(0, Math.min(4, cur + (isCorrect ? 1 : -1)));
        updateDoc(doc(db, 'users', uid), { difficultyLevel: next });
      }
    }

    if (isCorrect) {
      // 반복 드랍률 계산
      const filePath = routineItems[currentIdx]?.file?.path || '';
      const uid = auth.currentUser?.uid;
      const repeatCount = uid ? await getQuestRepeatCountFS(uid, filePath) : 1;
      const { multiplier, fixed } = getQuestDropRate(repeatCount);
      // 세트별 XP: 빈칸채우기=100 / OX·객관식=50 (반복 드랍률 적용)
      const baseXP = q.type === 'fill_blank' ? 100 : 50;
      const droppedXP = fixed !== null ? fixed : Math.round(baseXP * multiplier);
      let xp = 0;
      if (uid) {
        const state = await getUserState(uid);
        xp = await addDailyXPCapped(uid, 'quest', droppedXP, state, true);
        if (xp > 0) await updateDoc(doc(db, 'users', uid), { totalXP: increment(xp), lastStudiedAt: serverTimestamp() });
      }
      setEarnedXP(prev => prev + xp);
      setQuizCorrect(prev => prev + 1);
    } else {
      // 하트 소멸 애니메이션 + 화면 플래시
      setHeartLostIdx(quizHearts - 1);
      setScreenFlash(true);
      setTimeout(() => { setHeartLostIdx(null); setScreenFlash(false); }, 600);
      setQuizHearts(prev => prev - 1);
    }
  };

  // 다음 문제 or 완료
  const goNextQuestion = () => {
    // 하트 0 또는 마지막 문제 → 결과 화면
    if (quizHearts <= (quizFeedback?.correct ? 0 : 1) || quizIdx + 1 >= quizQuestions.length) {
      // 반복 횟수 기록 (드랍률 계산용)
      const filePath = routineItems[currentIdx]?.file?.path || '';
      const uid = auth.currentUser?.uid;
      if (filePath && uid) recordQuestRepeatFS(uid, filePath);
      setQuizDone(true);
      setQuizFeedback(null);
    } else {
      setQuizIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setQuizFeedback(null);
      setFillAnswer('');
      setReportResult(null);
    }
  };

  // ─── 이해했어요 → 퀴즈 시작 ──────────────────
  const handleUnderstood = () => {
    requestQuiz(false);
  };

  // ─── 다음 아이템 ──────────────────────────────
  const goNextItem = () => {
    if (currentIdx + 1 >= routineItems.length) {
      localStorage.removeItem('lucid_quest_progress');
      setPhase('done');
    } else {
      const nextIdx = currentIdx + 1;
      localStorage.setItem('lucid_quest_progress', JSON.stringify({
        date: new Date().toDateString(),
        idx: nextIdx,
        paths: routineItems.map(i => i.file.path),
      }));
      setCurrentIdx(nextIdx);
      setCode('');
    }
  };

  // ─── 채팅 전송 ────────────────────────────────
  const sendChatMsg = async (msg) => {
    if (!msg.trim() || chatLoading) return;
    setChatSuggestions([]);
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    const userMsg = msg;
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) { setChatLoading(false); return; }
    const item = routineItems[currentIdx];
    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: quizVisible ? MODELS.VERIFY : MODELS.CHAT,
          messages: [
            { role: 'system', content: `${CHAT_SYSTEM}\n\n파일: ${item.file.name}\n코드:\n${code}${
  quizVisible && curQ
    ? `\n\n---\n현재 출제된 퀴즈 문제:\n문제: ${curQ.question}${curQ.code_with_blank ? '\n코드: ' + curQ.code_with_blank : ''}${curQ.options ? '\n선택지: ' + curQ.options.join(' / ') : ''}\n정답: ${curQ.answer}\n해설: ${curQ.explanation}\n\n학생이 이 문제에 대해 질문하면 위 정보를 바탕으로 친절하게 설명해주세요.`
    : ''
}` },
            ...chatMessages.slice(-10),
            { role: 'user', content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.choices?.[0]?.message?.content || '답변을 생성할 수 없습니다.' }]);
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: '답변 생성에 실패했습니다.' }]); }
    finally { setChatLoading(false); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    sendChatMsg(msg);
  };

  // ─── 문제 신고 & 검증 ─────────────────────────
  const handleReportQuestion = async () => {
    if (reportLoading || !curQ) return;
    setReportLoading(true);
    setReportResult(null);
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const item = routineItems[currentIdx];
    try {
      const verifyPrompt = `당신은 퀴즈 문제 검증 AI입니다. 학생이 이 문제가 이상하다고 신고했습니다.
아래 코드를 꼼꼼히 확인하고, 문제에서 요구하는 내용이 실제 코드에 존재하는지 검증하세요.
합리화하거나 변명하지 말고 있는 그대로 판단하세요.

## 코드 (${item.file.name}):
${code}

## 신고된 문제:
문제: ${curQ.question}
${curQ.code_with_blank ? '빈칸 코드: ' + curQ.code_with_blank : ''}
${curQ.options ? '선택지: ' + curQ.options.join(' / ') : ''}
정답: ${curQ.answer}

반드시 JSON만 응답: {"valid": true/false, "reason": "한 줄 이유"}`;

      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODELS.VERIFY, messages: [{ role: 'user', content: verifyPrompt }], temperature: 0, max_tokens: 100 }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      const result = match ? JSON.parse(match[0]) : { valid: true };

      if (!result.valid) {
        setReportResult('invalid');
        setTimeout(() => { requestQuiz(); setReportResult(null); }, 1500);
      } else {
        setReportResult('valid');
        setTimeout(() => setReportResult(null), 3000);
      }
    } catch {
      setReportResult('error');
      setTimeout(() => setReportResult(null), 2000);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // 퀘스트 완료 시 스트릭 +1 + 원두 드랍 판정 (한 번만, 완료 화면 진입 시)
  const routineCompletedRef = useRef(false);
  useEffect(() => {
    if (phase === 'done' && !routineCompletedRef.current) {
      routineCompletedRef.current = true;
      const uid = auth.currentUser?.uid;
      if (uid) {
        getUserState(uid).then(async (state) => {
          await onQuestCompleteFS(uid, state);
          // 원두 드랍 판정 (1.5초 딜레이 — 완료 화면 먼저 보여준 후)
          setTimeout(async () => {
            const freshState = await getUserState(uid);
            const result = await rollBeanDropFS(uid, freshState);
            if (result.dropped) setBeanDrop({ isFirst: result.isFirst, beanCount: result.beanCount });
          }, 1500);
        });
      }
    }
  }, [phase]);

  // ─── 로딩 화면 ────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-[#f59e0b]/60 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400">{pickMsg('prepare')}</p>
      </div>
    );
  }

  // ─── 완료 화면 ────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in-up px-4">
        {/* 원두 드랍 카드 */}
        {beanDrop && (
          <BeanRewardCard
            isFirst={beanDrop.isFirst}
            beanCount={beanDrop.beanCount}
            onClose={() => setBeanDrop(null)}
          />
        )}
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-white mb-2">퀘스트 완료!</h2>
          <p className="text-sm text-gray-400 mb-6">
            {routineItems.length > 0 ? `${routineItems.length}개 코드를 클리어했어요.` : '오늘 볼 코드가 없어요.'}
          </p>
          {earnedXP > 0 && (
            <div className="bg-[#f59e0b]/[0.08] border border-[#f59e0b]/20 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-400">획득 XP</p>
              <p className="text-3xl font-black text-[#f59e0b]">+{earnedXP}</p>
            </div>
          )}
          <button onClick={() => onBack({ xp: earnedXP })} className="px-6 py-3 rounded-xl font-bold text-sm bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 transition-all">
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // ─── 메인 렌더 ────────────────────────────────
  const item = routineItems[currentIdx];
  if (!item) return null;
  const typeLabel = item.type === 'new' ? '새 코드' : item.type === 'weak' ? '약점 복습' : '복습';
  const typeColor = item.type === 'new' ? '#4ec9b0' : item.type === 'weak' ? '#f59e0b' : '#569cd6';
  const lang = extToLang(item.file?.name);

  const proseClass = "prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-li:my-0.5 prose-code:bg-white/10 prose-code:px-1.5 prose-code:rounded prose-code:text-[#fbbf24] prose-code:before:content-none prose-code:after:content-none prose-strong:text-[#f59e0b] prose-h1:text-base prose-h2:text-sm prose-h3:text-sm";

  // 현재 퀴즈 문제
  const curQ = quizQuestions[quizIdx];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 바 */}
      <div className="shrink-0 px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setExitConfirm(true)} className="text-gray-400 hover:text-white transition p-1" title="퀘스트 나가기">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <span className="text-sm font-bold text-white">오늘의 퀘스트</span>
          <span className="text-[10px] text-gray-500">{currentIdx + 1} / {routineItems.length}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}>{typeLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {earnedXP > 0 && <span className="text-xs font-bold text-[#f59e0b]">+{earnedXP} XP</span>}
          <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] rounded-full transition-all duration-500" style={{ width: `${(currentIdx / routineItems.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* 파일 정보 */}
      <div className="shrink-0 px-4 py-2 border-b border-white/[0.04] flex items-center gap-2">
        <span className="text-[10px] text-gray-500">{item.chapterLabel}</span>
        <span className="text-[10px] text-gray-600">/</span>
        <span className="text-xs font-bold" style={{ color: '#dcdcaa' }}>{item.file.name}</span>
      </div>

      {/* 모바일 탭 바 — md 이상에서는 숨김 */}
      <div className="md:hidden shrink-0 flex border-b border-white/[0.08] bg-[#080c08]" style={{ height: '44px' }}>
        <button
          onClick={() => setMobileTab('code')}
          className={`flex-1 h-full flex items-center justify-center text-[13px] font-bold transition-all ${
            mobileTab === 'code'
              ? 'text-white border-b-2 border-[#4ec9b0]'
              : 'text-gray-500'
          }`}
        >
          📝 코드
        </button>
        <button
          onClick={() => { setMobileTab('quiz'); if (rightTab !== 3 && rightTab !== 4) setRightTab(3); }}
          className={`flex-1 h-full flex items-center justify-center text-[13px] font-bold transition-all ${
            mobileTab === 'quiz'
              ? 'text-white border-b-2 border-[#4ec9b0]'
              : 'text-gray-500'
          }`}
        >
          🎯 문제풀기
        </button>
      </div>

      {/* 좌=코드 / 우=패널 */}
      <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
        {/* 좌: Monaco + 탭 */}
        <div
          style={{ width: isMobile ? undefined : `${splitRatio * 100}%` }}
          className={`shrink-0 flex flex-col border-r border-white/[0.06] ${
            isMobile
              ? mobileTab === 'code' ? 'flex w-full' : 'hidden'
              : ''
          }`}
        >
          {/* 탭 헤더 */}
          <div className="shrink-0 flex items-end gap-0.5 px-2 pt-1.5 border-b border-white/[0.10] bg-[#080c08]">
            <TabButton active={leftTab === 1} shortcut={isMobile ? null : "⇧1"} label="수업코드" onClick={() => setLeftTab(1)} />
            <TabButton active={leftTab === 2} shortcut={isMobile ? null : "⇧2"} label="AI코드" onClick={() => setLeftTab(2)} />
            <div className="ml-auto flex items-center gap-1.5 pb-1.5 pr-1">
              <button
                onClick={() => {
                  if (!isTypingMode) {
                    const lines = code.split('\n');
                    const prefill = lines.filter(l => /^\s*(package |import )/.test(l)).join('\n');
                    setTypingCode(prefill ? prefill + '\n\n' : '');
                    setIsEditMode(false);
                    setIsTypingMode(true);
                  } else {
                    setIsTypingMode(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                  isTypingMode
                    ? 'bg-[#a78bfa]/10 border-[#a78bfa]/30 text-[#a78bfa]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                <span>⌨️</span>{isTypingMode ? '타자연습 중' : '타자연습'}
              </button>
              <button
                onClick={() => { setIsEditMode(v => !v); setIsTypingMode(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-all ${
                  isEditMode
                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {isEditMode ? (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>읽기 전용</>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>읽기 전용</>
                )}
              </button>
            </div>
          </div>
          {leftTab === 1 && (
            codeLoading ? (
              <div className="flex items-center justify-center h-full gap-2">
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold text-gray-400">{pickMsg('prepare')}</span>
              </div>
            ) : (
              <Editor height="100%"
                language={lang}
                value={isTypingMode ? typingCode : code}
                onChange={isTypingMode ? (v) => setTypingCode(v ?? '') : isEditMode ? (v) => setCode(v ?? '') : undefined}
                theme="night-owl"
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  monacoRef.current = monaco;

                  // Night Owl 테마
                  monaco.editor.defineTheme('night-owl', nightOwlTheme);
                  monaco.editor.setTheme('night-owl');

                  const dom = editor.getDomNode();
                  editor.onKeyDown((e) => { if (e.ctrlKey || e.metaKey) dom?.classList.add('ctrl-held'); });
                  editor.onKeyUp(() => dom?.classList.remove('ctrl-held'));
                  dom?.addEventListener('mouseleave', () => dom?.classList.remove('ctrl-held'));
                }}
                options={{
                  readOnly: !isTypingMode && !isEditMode,
                  fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false,
                  wordWrap: 'on', lineNumbers: 'on',
                  renderLineHighlight: (isTypingMode || isEditMode) ? 'line' : 'none',
                  cursorStyle: (isTypingMode || isEditMode) ? 'line' : 'block',
                  tabSize: 4, folding: false, foldingHighlight: false,
                  padding: { top: 12, bottom: 12 }, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                }} />
            )
          )}
          {leftTab === 2 && (
            <div className="flex items-center justify-center h-full flex-col gap-3 px-6 text-center">
              <span className="text-4xl">🤖</span>
              <p className="text-sm font-bold text-gray-400">AI 코드 기능</p>
              <p className="text-xs text-gray-600">준비 중입니다</p>
            </div>
          )}
        </div>

        {/* 스플리터 — 모바일에서 숨김 */}
        <div onMouseDown={handleSplitMouseDown}
          className="hidden md:flex w-1.5 cursor-col-resize items-center justify-center group hover:bg-[#f59e0b]/20 transition-colors rounded-full mx-0.5 shrink-0">
          <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-[#f59e0b] rounded-full transition-colors" />
        </div>

        {/* 우: 탭 패널 */}
        <div ref={rightPanelRef} style={{ fontSize: `${panelFontSize}px` }} className={`flex-1 min-w-0 flex flex-col relative ${isMobile ? (mobileTab === 'quiz' ? 'flex' : 'hidden') : ''}`}>
          {/* 오답 플래시 */}
          {screenFlash && <div className="absolute inset-0 bg-red-500/30 pointer-events-none z-30 screen-flash-red" />}

          {/* 탭 헤더 */}
          <div className="shrink-0 flex items-end gap-0.5 px-2 pt-1.5 border-b border-white/[0.10] bg-[#080c08]">
            <TabButton active={rightTab === 3} shortcut={isMobile ? null : "⇧3"} label="해석+채팅" onClick={() => setRightTab(3)} />
            <TabButton active={rightTab === 4} shortcut={isMobile ? null : "⇧4"} label="퀴즈" onClick={() => { setRightTab(4); if (!quizVisible && code) requestQuiz(); }} />
            {!isMobile && rightTab === 3 && analysisResult && (
              <span className="ml-auto pr-3 mb-1.5 text-[9px] text-gray-600 flex items-center gap-1 self-center">
                <span className="font-mono bg-white/[0.04] px-1 py-0.5 rounded border border-white/[0.08]">F2</span>순서대로 펼치기
              </span>
            )}
          </div>

          {/* ── 탭 3: 채팅 ── */}
          {rightTab === 3 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto px-3 py-3 space-y-2 scrollbar-hide">
                {/* 분석 로딩 */}
                {analysisLoading && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-3 h-3 border border-[#f59e0b]/40 border-t-[#f59e0b] rounded-full animate-spin shrink-0" />
                    <span className="text-[11px] text-gray-500">해석 + 비유 생성 중...</span>
                  </div>
                )}

                {/* 채팅 메시지 */}
                {chatMessages.length === 0 && !analysisLoading && (
                  <p className="text-center text-gray-600 text-[11px] py-3">궁금한 거 질문하세요~</p>
                )}
                {chatMessages.map((m, i) => {
                  if (m.isAnalysis) {
                    const codeComponents = {
                      code: ({ children }) => {
                        const txt = String(children).trim();
                        return <code className="code-token-clickable text-[11px] bg-white/5 px-1.5 rounded" style={{ color: '#9cdcfe', cursor: 'inherit' }}
                          onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); highlightCodeToken(txt); } }}>{children}</code>;
                      },
                      h1: () => null, h2: () => null, h3: () => null,
                    };
                    const prose = "prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-li:my-0.5 prose-code:bg-white/10 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none";
                    return (
                      <div key={i} className="space-y-2">
                        {/* 기능적 해석 카드 */}
                        <div className="group relative rounded-xl border border-white/[0.06] hover:border-sky-500/30 bg-white/[0.02] hover:bg-sky-500/5 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(56,189,248,0.08)]">
                          <button onClick={() => setChatMessages(prev => prev.map((x, j) => j === i ? { ...x, funcOpen: !x.funcOpen } : x))}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                            <span className="text-[12px] font-bold" style={{ color: m.funcOpen ? '#7dd3fc' : '#9ca3af' }}>기능적 해석</span>
                            <span className="text-[10px] text-gray-600 transition-transform duration-200" style={{ transform: m.funcOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                          </button>
                          {m.funcOpen && (
                            <div className="px-4 pb-4 border-t border-white/[0.06]">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} className={prose}
                                components={{ ...codeComponents, strong: ({ children }) => <span className="font-semibold text-sky-300">{children}</span> }}
                              >{m.functional}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                        {/* 비유 설명 카드 */}
                        <div className="group relative rounded-xl border border-white/[0.06] hover:border-emerald-500/30 bg-white/[0.02] hover:bg-emerald-500/5 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                          <button onClick={() => setChatMessages(prev => prev.map((x, j) => j === i ? { ...x, metaOpen: !x.metaOpen } : x))}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left">
                            <span className="text-[12px] font-bold" style={{ color: m.metaOpen ? '#6ee7b7' : '#9ca3af' }}>비유 설명</span>
                            <span className="text-[10px] text-gray-600 transition-transform duration-200" style={{ transform: m.metaOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                          </button>
                          {m.metaOpen && (
                            <div className="px-4 pb-4 border-t border-white/[0.06]">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} className={prose}
                                components={{ ...codeComponents, strong: ({ children }) => <span className="font-semibold text-emerald-400">{children}</span> }}
                              >{metaphorShuffling ? '새 비유 생성 중...' : m.metaphor}</ReactMarkdown>
                              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/[0.06]">
                                <button onClick={() => setVoteState(prev => ({ ...prev, metaphor: prev.metaphor === 'up' ? null : 'up' }))}
                                  className={`text-sm transition-all hover:scale-125 px-1.5 py-0.5 rounded-md ${voteState.metaphor === 'up' ? 'bg-green-500/20 scale-110' : 'opacity-40 hover:opacity-80 hover:bg-white/5'}`}>👍</button>
                                <button onClick={() => setVoteState(prev => ({ ...prev, metaphor: prev.metaphor === 'down' ? null : 'down' }))}
                                  className={`text-sm transition-all hover:scale-125 px-1.5 py-0.5 rounded-md ${voteState.metaphor === 'down' ? 'bg-red-500/20 scale-110' : 'opacity-40 hover:opacity-80 hover:bg-white/5'}`}>👎</button>
                                <button onClick={shuffleMetaphor} disabled={metaphorShuffling}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-[#f59e0b]/20 text-[#f59e0b]/60 hover:text-[#f59e0b] hover:border-[#f59e0b]/40 hover:bg-[#f59e0b]/5 transition-all disabled:opacity-30 flex items-center gap-1">
                                  {metaphorShuffling ? <div className="w-2.5 h-2.5 border border-[#f59e0b]/40 border-t-[#f59e0b] rounded-full animate-spin" /> : '⟳'} 다른 비유 보기
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <ChatBubble key={i} role={m.role}>
                      {m.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert max-w-none text-[12px] prose-p:my-1 prose-code:text-[#fbbf24] prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                          {m.content}
                        </ReactMarkdown>
                      ) : m.content}
                    </ChatBubble>
                  );
                })}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 퀴즈 버튼 (분석 완료 후, 퀴즈 미시작 시) */}
              {analysisResult && !quizVisible && (
                <div className="shrink-0 px-3 pt-2 flex justify-end">
                  <button
                    onClick={() => requestQuiz(false)}
                    disabled={chatLoading}
                    className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    레벨 진단 퀴즈 시작
                  </button>
                </div>
              )}
              {/* 채팅 입력 — 공용 ChatInput */}
              <div className="shrink-0 px-1.5 pb-1.5 pt-1">
                <ChatInput
                  value={chatInput}
                  onChange={setChatInput}
                  onSubmit={sendChat}
                  disabled={chatLoading}
                  placeholder="이 코드에서 궁금한 거 물어보세요..."
                />
              </div>
            </div>
          )}

          {/* ── 탭 4: 퀴즈 전체 ── */}
          {rightTab === 4 && (
            <div className="flex-1 overflow-auto px-4 py-4 outline-none scrollbar-hide"
              tabIndex={0}
              ref={el => { if (el && !quizLoading && curQ && !quizFeedback && curQ.type !== 'fill_blank') el.focus(); }}
              id="quiz-panel"
              onKeyDown={e => {
                if (quizLoading) return;
                if (quizFeedback && !quizDone && e.key === 'Enter') { e.preventDefault(); goNextQuestion(); return; }
                if (quizFeedback && quizDone && e.key === 'Enter') { e.preventDefault(); return; }
                if (quizFeedback || !curQ) return;
                if (curQ.type !== 'fill_blank') {
                  const num = parseInt(e.key);
                  if (num >= 1 && num <= (curQ.options?.length || 0)) { e.preventDefault(); handleAnswer(curQ.options[num - 1]); }
                }
              }}
            >
                {quizLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-6 h-6 border-2 border-[#a855f7]/40 border-t-[#a855f7] rounded-full animate-spin" />
                    <span className="text-sm font-bold text-gray-400">{loadingMsg}</span>
                  </div>
                ) : !quizQuestions.length ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-2">
                    <p className="text-xs text-gray-500 text-center">설명을 듣고 이해했어요 버튼을<br/>누르거나, 바로 문제를 풀어보세요.</p>
                    <button
                      onClick={() => requestQuiz(false)}
                      className="w-full min-h-[44px] py-3 rounded-xl font-bold text-sm bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30 hover:-translate-y-0.5 hover:bg-[#a855f7]/20 transition-all"
                    >
                      바로 문제 풀기
                    </button>
                  </div>
                ) : quizDone ? (
                  /* ─── 퀴즈 결과 화면 ─── */
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-2">
                    <div className="text-4xl mb-2">{quizCorrect === quizQuestions.length ? '🎉' : quizCorrect >= 2 ? '👍' : '💪'}</div>
                    <p className="text-lg font-black text-white">
                      {quizCorrect === quizQuestions.length ? '완벽해요!' : quizCorrect >= 2 ? '잘했어요!' : '다음엔 더!'}
                    </p>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-center">
                        <p className="text-2xl font-black text-[#4ec9b0]">{quizCorrect}</p>
                        <p className="text-[10px] text-gray-500">맞춤</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-red-400">{quizQuestions.length - quizCorrect}</p>
                        <p className="text-[10px] text-gray-500">틀림</p>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-[#f59e0b]">{quizHearts}</p>
                        <p className="text-[10px] text-gray-500">하트</p>
                      </div>
                    </div>
                    <button onClick={() => { removeWeakFile(routineItems[currentIdx]?.file?.path); goNextItem(); }}
                      className="w-full min-h-[44px] py-3 rounded-xl font-bold text-sm bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30 hover:-translate-y-0.5 transition-all">
                      다음 코드로 →
                    </button>
                  </div>
                ) : curQ ? (
                  <div className="rounded-2xl p-4 transition-all duration-500" style={{
                    background: `linear-gradient(135deg, rgba(168,85,247,${0.04 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.12}) 0%, transparent 100%)`,
                    border: `1px solid rgba(168,85,247,${0.12 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.25})`,
                    boxShadow: `0 4px 24px rgba(168,85,247,${0.06 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.14})`,
                  }}>
                    {/* 문제 번호 + 하트 */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold text-gray-500">{quizIdx + 1} / {quizQuestions.length}</span>
                      {curQ.type === 'ox' && <span className="text-[10px] font-bold text-[#4ec9b0] bg-[#4ec9b0]/10 px-2 py-0.5 rounded-full">O/X</span>}
                      {curQ.type === 'fill_blank' && <span className="text-[10px] font-bold text-[#c586c0] bg-[#c586c0]/10 px-2 py-0.5 rounded-full">빈칸</span>}
                      <span className="ml-auto flex items-center gap-0.5">
                        {[...Array(3)].map((_, i) => {
                          const isPopping = i === heartLostIdx;
                          const isActive = i < quizHearts || isPopping;
                          return (
                            <span key={i} className={`text-sm transition-all duration-300 ${isActive ? 'scale-100' : 'scale-75'} ${isPopping ? 'quiz-heart-pop' : ''}`}>
                              {isActive ? '❤️' : '🖤'}
                            </span>
                          );
                        })}
                      </span>
                      {curQ.type !== 'fill_blank' && <span className="text-[8px] text-gray-600">1~{curQ.options?.length}</span>}
                    </div>

                    {/* 문제 — 코드 포함 시 하이라이팅 */}
                    {(() => {
                      const q = curQ.question;
                      const codeMatch = q.match(/```(\w*)\n?([\s\S]*?)```/);
                      if (codeMatch) {
                        const before = q.substring(0, codeMatch.index).trim();
                        const codeLang = codeMatch[1] || lang;
                        const codeBody = codeMatch[2].trim();
                        const after = q.substring(codeMatch.index + codeMatch[0].length).trim();
                        return (
                          <>
                            {before && <p className="text-sm text-white font-semibold mb-2 leading-relaxed">{before}</p>}
                            <div className="quiz-code-ctrl rounded-xl overflow-hidden mb-2 border border-white/[0.14]"
                              onClick={(e) => { if (!(e.ctrlKey || e.metaKey)) return; const token = e.target.textContent?.trim(); if (token) highlightCodeToken(token); }}>
                              <SyntaxHighlighter language={codeLang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.5rem', fontSize: '10px', background: '#0d1117', borderRadius: '0.75rem', cursor: 'inherit' }} wrapLongLines>{codeBody}</SyntaxHighlighter>
                            </div>
                            {after && <p className="text-sm text-white font-semibold mb-2 leading-relaxed">{after}</p>}
                          </>
                        );
                      }
                      return <p className="text-sm text-white font-semibold mb-3 leading-relaxed">{q}</p>;
                    })()}

                    {/* 빈칸: 코드 + 입력창 */}
                    {curQ.type === 'fill_blank' ? (
                      <>
                        {curQ.code_with_blank && (
                          <div className="quiz-code-ctrl rounded-xl overflow-hidden mb-3 border border-white/[0.14]"
                            onClick={(e) => { if (!(e.ctrlKey || e.metaKey)) return; const token = e.target.textContent?.trim(); if (token) highlightCodeToken(token); }}>
                            <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.75rem', fontSize: '10px', background: '#0d1117', borderRadius: '0.75rem', cursor: 'inherit' }} wrapLongLines>
                              {curQ.code_with_blank}
                            </SyntaxHighlighter>
                          </div>
                        )}
                        <div className="flex gap-2 mb-3">
                          <input
                            autoFocus
                            value={fillAnswer}
                            onChange={e => setFillAnswer(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); if (e.key === 'Enter' && !quizFeedback && fillAnswer.trim()) handleAnswer(fillAnswer); }}
                            disabled={!!quizFeedback}
                            placeholder="빈칸에 들어갈 코드..."
                            className="flex-1 bg-white/[0.04] border border-[#c586c0]/30 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder:text-gray-600 outline-none focus:border-[#c586c0]/60 disabled:opacity-50"
                          />
                          {!quizFeedback && (
                            <button onClick={() => handleAnswer(fillAnswer)} disabled={!fillAnswer.trim()}
                              className="px-3 py-2 rounded-lg bg-[#c586c0]/15 text-[#c586c0] text-xs font-bold border border-[#c586c0]/30 disabled:opacity-30 hover:bg-[#c586c0]/25 transition-all">
                              제출
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      /* 객관식 / O/X */
                      <div className="space-y-2 mb-3">
                        {curQ.options?.map((opt, i) => {
                          const colors = ['#4ec9b0', '#569cd6', '#dcdcaa', '#c586c0'];
                          const c = colors[i % colors.length];
                          return (
                            <button
                              key={i}
                              onClick={() => handleAnswer(opt)}
                              disabled={!!quizFeedback}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border text-[13px] transition-all flex items-center gap-2 ${
                                quizFeedback
                                  ? opt === curQ.answer
                                    ? 'border-[#4ec9b0]/60 bg-[#4ec9b0]/10 text-[#4ec9b0] font-bold'
                                    : selectedAnswer === opt
                                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                    : 'border-white/[0.04] text-gray-600'
                                  : 'border-white/[0.08] text-gray-100 hover:bg-white/[0.06] hover:border-white/[0.25]'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0" style={{
                                background: quizFeedback ? (opt === curQ.answer ? '#4ec9b015' : selectedAnswer === opt ? '#ef444415' : '#ffffff06') : `${c}25`,
                                color: quizFeedback ? (opt === curQ.answer ? '#4ec9b0' : selectedAnswer === opt ? '#ef4444' : '#555') : c,
                                border: `1px solid ${quizFeedback ? (opt === curQ.answer ? '#4ec9b040' : selectedAnswer === opt ? '#ef444440' : '#ffffff08') : `${c}50`}`,
                              }}>
                                {i + 1}
                              </span>
                              <span className="flex-1">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 문제 신고 */}
                    {!quizFeedback && (
                      <div className="flex justify-end mb-2">
                        {reportResult === 'invalid' ? (
                          <span className="text-[10px] text-[#f59e0b]">⚠️ 새 문제로!</span>
                        ) : reportResult === 'valid' ? (
                          <span className="text-[10px] text-[#4ec9b0]">✅ 이상 없어요</span>
                        ) : reportResult === 'error' ? (
                          <span className="text-[10px] text-red-400">검증 실패</span>
                        ) : (
                          <button onClick={handleReportQuestion} disabled={reportLoading}
                            className="text-[10px] text-gray-600 hover:text-red-400/70 transition-colors flex items-center gap-1">
                            {reportLoading
                              ? <><span className="w-2 h-2 border border-gray-600 border-t-gray-400 rounded-full animate-spin inline-block" /> 검증 중...</>
                              : '🚩 이상한 문제'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* 피드백 */}
                    {quizFeedback && (
                      <div className={`p-3 rounded-xl mb-2 ${quizFeedback.correct ? 'bg-[#4ec9b0]/[0.06] border border-[#4ec9b0]/20' : 'bg-red-500/[0.06] border border-red-500/20'}`}>
                        <p className="text-sm font-bold mb-1" style={{ color: quizFeedback.correct ? '#4ec9b0' : '#ef4444' }}>
                          {quizFeedback.correct ? '정답!' : '아쉬워요!'}
                        </p>
                        {curQ.type === 'fill_blank' && !quizFeedback.correct && (
                          <p className="text-xs text-gray-400 mb-1">정답: <code className="text-[#fbbf24] bg-white/5 px-1 rounded">{curQ.answer}</code></p>
                        )}
                        <p className="text-xs text-gray-400">{quizFeedback.explanation}</p>
                        <button onClick={goNextQuestion}
                          className="mt-2 w-full min-h-[44px] py-2 rounded-lg font-bold text-sm bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                          {quizHearts <= 0 || quizIdx + 1 >= quizQuestions.length ? '결과 보기' : '다음 문제'}
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f59e0b]/15 border border-[#f59e0b]/25 text-[#f59e0b]/60">Enter</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ─── 종료 확인 모달 ─── */}

      {exitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setExitConfirm(false)}>
          <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-6 w-full max-w-[340px] mx-4 shadow-[0_16px_64px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">퀘스트 종료</p>
                <p className="text-xs text-gray-500">진행 상태가 초기화됩니다</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">퀘스트를 정말 종료하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setExitConfirm(false)}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                취소
              </button>
              <button onClick={() => { setExitConfirm(false); onBack(); }}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                종료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── 모바일 전용: 홀드 투 피크 코드 미리보기 (퀴즈 탭에서만) ──── */}
      {isMobile && mobileTab === 'quiz' && (
        <CodePeekButton
          code={code || ''}
          language={lang || 'java'}
        />
      )}
    </div>
  );
};

export default QuestView;
