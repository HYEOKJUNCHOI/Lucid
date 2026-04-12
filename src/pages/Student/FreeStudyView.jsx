import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import nightOwlTheme from '../../themes/nightOwl.json';
import { getGeminiApiKey } from '../../lib/apiKey';
import TypingPractice from '../../components/study/TypingPractice';
import ChatPanel from '../../components/chat/ChatPanel';
import FreeStudyQuiz from '../../components/study/FreeStudyQuiz';
import MemoPanel from '../../components/study/MemoPanel';
import { SAMPLE_JAVA_CODE } from '../../lib/sampleCode';
import { MODELS, GEMINI_CHAT_URL } from '../../lib/aiConfig';
import { useAuth } from '../../hooks/useAuth';
import { recordTypingSession, getTypingStats, resetTypingStats, saveCheatBadge } from '../../services/learningService';

const CARD_DEFS = [
  { key: '기능해석', label: '⚙️ 기능 해석', accent: 'border-l-cyan-400/70',  bg: 'bg-cyan-500/[0.06]'  },
  { key: '비유설명', label: '🌀 비유 설명', accent: 'border-l-amber-400/70', bg: 'bg-amber-500/[0.06]' },
];

const TABS = [
  { id: 'main', label: '🗒️ Main.java' },
  { id: 'ai',   label: 'AI 생성코드' },
];

const RIGHT_TABS = [
  { id: 'tutor', label: '💬 Lucid Tutor' },
  { id: 'quiz',  label: '🎯 문제풀기' },
  { id: 'memo',  label: '📝 메모' },
];

const FreeStudyView = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [activeRightTab, setActiveRightTab] = useState('tutor');
  const [tabContents, setTabContents] = useState({
    main: SAMPLE_JAVA_CODE,
    ai: '',
  });
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const editorRef = useRef(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isQuizUnlocked, setIsQuizUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isTypingPractice, setIsTypingPractice] = useState(false);
  const isTypingPracticeRef = useRef(false);
  isTypingPracticeRef.current = isTypingPractice;
  const [typingIsNewRecord, setTypingIsNewRecord] = useState(false);
  const [typingBest, setTypingBest] = useState(null); // { bestCpm, bestAccuracy, sessionCount, ... }
  const [isCheating, setIsCheating] = useState(false);
  // 20줄 미만 코드 여부 — 치팅과 동일 패턴으로 기록만 저장 스킵, 뱃지 없음
  const [isShortCode, setIsShortCode] = useState(false);
  const [quizLockHover, setQuizLockHover] = useState(null); // { top, left }
  // Lucid Tutor 컨텍스트 핸드오프 (퀴즈 결과 → 튜터)
  const [chatKey, setChatKey] = useState(0);
  const [chatGreeting, setChatGreeting] = useState('코드에 대해 뭐든 물어보세요');
  const [chatSystemPrompt, setChatSystemPrompt] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const { user } = useAuth();

  // ─── 치팅 감지용 ref ───────────────────────────────────
  // Monaco command / window keydown 핸들러는 클로저로 등록되기 때문에
  // state를 직접 읽으면 stale 값이 잡힌다. ref로 우회해서 항상 최신값 참조.
  const activeTabRef = useRef('main');
  const tabContentsRef = useRef({ main: SAMPLE_JAVA_CODE, ai: '' });
  // 2번 탭 AI 생성본 기준값. AI 생성 기능 붙일 때 생성 직후 여기에 채워넣을 것.
  // null인 동안엔 "AI가 아직 생성 안 함" 상태로 간주.
  const aiReferenceCodeRef = useRef(null);
  activeTabRef.current = activeTab;
  tabContentsRef.current = tabContents;

  // 타자연습 진입 시점에 호출 → 현재 탭 코드와 원본 비교해서 치팅 여부 결정
  const computeIsCheating = () => {
    const tab = activeTabRef.current;
    const current = tabContentsRef.current[tab] ?? '';
    if (tab === 'main') {
      // 메인 탭: 항상 SAMPLE_JAVA_CODE 가 원본
      return current !== SAMPLE_JAVA_CODE;
    }
    // AI 탭: AI 생성 기록이 없는데 내용이 있으면 직접 친 거 → 치팅
    //        있으면 마지막 생성본과 비교
    const ref = aiReferenceCodeRef.current;
    if (ref == null) return current.length > 0;
    return current !== ref;
  };

  // 타자연습 진입 시점에 호출 → 10줄 미만이면 기록저장 스킵 (뱃지 없음)
  const computeIsShortCode = () => {
    const tab = activeTabRef.current;
    const current = tabContentsRef.current[tab] ?? '';
    return current.split('\n').length < 10;
  };

  // 타자연습 오버레이 열릴 때마다 기존 최고기록 다시 로드 (다른 탭에서 갱신된 거 반영)
  useEffect(() => {
    if (isTypingPractice && user?.uid) {
      getTypingStats(user.uid).then((stats) => setTypingBest(stats));
    }
  }, [isTypingPractice, user?.uid]);
  // 해석 카드
  const [explainCards, setExplainCards] = useState(null);
  const [cardOpenStates, setCardOpenStates] = useState({ 0: false, 1: false });
  const [explainLoading, setExplainLoading] = useState(false);
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const f2StepRef = useRef(0);
  const decoIdsRef = useRef([]);
  const splitContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // AI 코드 생성 (Alt+2 탭) — 1번탭 코드를 읽고 같은 패턴·다른 소재로 새 예제 생성
  const generateAiCode = async () => {
    const mainCode = tabContentsRef.current.main;
    if (!mainCode.trim() || isGeneratingAi) return;
    setIsGeneratingAi(true);
    try {
      const prompt = `다음 Java 코드를 분석해서, 같은 디자인 패턴과 구조를 사용하되 완전히 다른 생활 소재로 새로운 Java 예제 코드를 작성해줘.

규칙:
- 코드만 출력. 설명·주석·마크다운 코드블록 없이 순수 Java 코드만.
- 클래스명·변수명은 한글로 (예: 병원, 학교, 은행 등 일상적인 소재).
- 메서드명은 영어로.
- 원본 코드와 구조(메서드 수, 패턴)는 유지.
- package, import 없이 클래스만.

[원본 코드]
${mainCode.slice(0, 3000)}`;

      const res = await fetch(
        `${GEMINI_CHAT_URL(MODELS.FREESTUDY_TUTOR)}?key=${getGeminiApiKey()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8 },
          }),
        }
      );
      const data = await res.json();
      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      if (generated) {
        aiReferenceCodeRef.current = generated;
        setTabContents(prev => ({ ...prev, ai: generated }));
      }
    } catch (err) {
      console.error('AI 코드 생성 실패:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // 문제풀기 잠금 해제 트리거 (버튼 클릭 / Alt+4 공통)
  const triggerUnlockQuiz = () => {
    if (isUnlocking || isQuizUnlocked) return;
    setIsUnlocking(true);
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    setTimeout(() => {
      setIsUnlocking(false);
      setIsQuizUnlocked(true);
      setJustUnlocked(true);
      setActiveRightTab('quiz');
      setTimeout(() => setJustUnlocked(false), 1500);
    }, 1400);
  };

  // keydown useEffect([])에서 최신 state/함수 접근용 ref
  const isQuizUnlockedRef = useRef(false);
  const triggerUnlockQuizRef = useRef(() => {});
  isQuizUnlockedRef.current = isQuizUnlocked;
  triggerUnlockQuizRef.current = triggerUnlockQuiz;

  // 퀴즈/채팅 코드 토큰 Ctrl+Click → 왼쪽 에디터 하이라이트
  const monacoRef = useRef(null);
  const highlightCodeToken = (token) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const searchText = token.replace(/\(\)$/, '').trim();
    if (!searchText || searchText.length <= 1) return;
    const model = editor.getModel();
    if (!model) return;
    const matches = model.findMatches(searchText, false, false, true, null, false);
    if (matches.length === 0) return;
    // 주석 줄 제외 — //로 시작하는 줄보다 코드 줄 우선
    const nonCommentMatch = matches.find(m => {
      const lineContent = model.getLineContent(m.range.startLineNumber).trimStart();
      return !lineContent.startsWith('//') && !lineContent.startsWith('*') && !lineContent.startsWith('/*');
    });
    const match = nonCommentMatch ?? matches[0];
    const line = match.range.startLineNumber;
    editor.revealLineInCenter(line);
    const newDecor = editor.deltaDecorations([], [
      { range: match.range, options: { inlineClassName: 'code-token-highlight' } },
      { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'code-line-highlight' } },
    ]);
    setTimeout(() => editor.deltaDecorations(newDecor, []), 1500);
  };

  // 퀴즈 완료 → Lucid Tutor 컨텍스트 핸드오프
  const handleSendToTutor = ({ concept, results }) => {
    const wrong = results.filter(r => !r.correct);
    const greeting = wrong.length === 0
      ? `"${concept}" 퀴즈 전부 맞히셨어요! 더 깊이 알고 싶은 부분 있으면 물어보세요.`
      : `"${concept}" 퀴즈에서 ${wrong.length}문제 틀리셨네요. ${wrong.map(r => `"${r.question}"`).join(', ')} 부분 같이 살펴볼까요?`;

    // AI가 퀴즈 내용을 알 수 있도록 system prompt에 컨텍스트 주입
    const quizContext = [
      `학생이 방금 "${concept}" 퀴즈를 풀었다.`,
      `결과: ${results.filter(r => r.correct).length}/${results.length} 정답`,
      wrong.length > 0
        ? `틀린 문제:\n${wrong.map(r => `- 문제: ${r.question}\n  학생 답: ${r.studentAnswer}\n  정답: ${r.correctAnswer}`).join('\n')}`
        : '모두 정답.',
      '\n학생이 질문하면 위 퀴즈 내용을 바탕으로 친절하게 설명해줘. 코드 에디터에 있는 코드도 참고해.',
    ].join('\n');
    setChatSystemPrompt(quizContext);
    setChatGreeting(greeting);
    setChatKey(k => k + 1);
    setActiveRightTab('tutor');
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // ── 커스텀 Java 토크나이저 ──
    // 내장 토크나이저는 String/Main 같은 대문자 식별자를 그냥 identifier로만 분류한다.
    // 여기서는 대문자로 시작하는 식별자를 'type.identifier'로 잡아내서
    // 테마의 청록색(#4ec9b0) 룰에 매핑되게 만든다.
    monaco.languages.setMonarchTokensProvider('java', {
      defaultToken: '',
      tokenPostfix: '.java',

      keywords: [
        'continue', 'for', 'new', 'switch', 'assert', 'default', 'goto',
        'package', 'boolean', 'do', 'if', 'this', 'break', 'double',
        'implements', 'throw', 'byte', 'else', 'import', 'throws',
        'case', 'enum', 'instanceof', 'return', 'catch', 'extends',
        'int', 'short', 'try', 'char', 'interface', 'void', 'class',
        'finally', 'long', 'const', 'float', 'super', 'while',
        'true', 'false', 'null', 'var', 'record', 'yield', 'sealed',
        'non-sealed', 'permits'
      ],

      storageModifiers: [
        'public', 'private', 'protected', 'static', 'final', 'abstract',
        'volatile', 'transient', 'synchronized', 'native', 'strictfp'
      ],

      operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
        '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
        '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
        '%=', '<<=', '>>=', '>>>=', '->'
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|[0-7]{1,3})/,
      digits: /\d+(_+\d+)*/,

      tokenizer: {
        root: [
          // 대문자 식별자 → 타입 (String, Main, Random, UUID, User 등)
          [/[A-Z][\w$]*/, 'type.identifier'],

          // 메서드 호출/선언: 소문자 식별자 + (  (키워드/접근제어자는 예외로 빼야 함)
          [/[a-z_$][\w$]*(?=\s*\()/, {
            cases: {
              '@storageModifiers': 'storage.modifier',
              '@keywords': 'keyword',
              '@default': 'entity.name.function'
            }
          }],

          // 소문자 식별자 / 키워드 / 접근제어자
          [/[a-z_$][\w$]*/, {
            cases: {
              '@storageModifiers': 'storage.modifier',
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],

          // 공백/주석
          { include: '@whitespace' },

          // 어노테이션
          [/@[a-zA-Z_$][\w$]*/, 'annotation'],

          // 괄호
          [/[{}()\[\]]/, '@brackets'],
          [/[<>](?!@symbols)/, '@brackets'],

          // 연산자
          [/@symbols/, {
            cases: {
              '@operators': 'delimiter',
              '@default': ''
            }
          }],

          // 숫자
          [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float'],
          [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+[Ll]?/, 'number.hex'],
          [/0[0-7]+[Ll]?/, 'number.octal'],
          [/(@digits)[fFdD]/, 'number.float'],
          [/(@digits)[lL]?/, 'number'],

          // 구분자
          [/[;,.]/, 'delimiter'],

          // 문자열
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

          // 문자
          [/'[^\\']'/, 'string'],
          [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
          [/'/, 'string.invalid']
        ],

        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*\*(?!\/)/, 'comment.doc', '@javadoc'],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],

        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],

        javadoc: [
          [/[^\/*]+/, 'comment.doc'],
          [/\*\//, 'comment.doc', '@pop'],
          [/[\/*]/, 'comment.doc']
        ],

        string: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
      }
    });

    // CSS 변수에서 에디터 배경 읽어와 Monaco 테마와 동기화
    const editorBg = getComputedStyle(document.documentElement)
      .getPropertyValue('--free-editor-bg').trim() || '#181825';
    const bgHex = editorBg.replace('#', '');
    const syncedTheme = {
      ...nightOwlTheme,
      rules: nightOwlTheme.rules.map(r =>
        r.token === '' ? { ...r, background: bgHex } : r
      ),
      colors: { ...nightOwlTheme.colors, 'editor.background': editorBg },
    };
    monaco.editor.defineTheme('night-owl', syncedTheme);
    monaco.editor.setTheme('night-owl');

    // ─── Monaco 내부 단축키 등록 ─────────────────────────
    // Monaco 는 일부 키(F2/F4/Alt+Digit 등)를 자체 커맨드에 묶어서 window 캡처 리스너보다 먼저 소비함.
    // 그래서 에디터에 포커스가 있는 동안엔 FreeStudyView 의 window keydown 핸들러가 안 먹힘.
    // → 동일한 단축키를 Monaco 내부 커맨드로도 등록해서, 포커스 어디에 있든 똑같이 동작하게 함.

    // F4 → 타자연습 토글
    editor.addCommand(monaco.KeyCode.F4, () => {
      setIsTypingPractice((v) => {
        if (!v) {
          setIsCheating(computeIsCheating());
          setIsShortCode(computeIsShortCode());
        }
        return !v;
      });
    });

    // F2 → 해석 카드 순환 (타자연습 중엔 양보)
    editor.addCommand(monaco.KeyCode.F2, () => {
      if (isTypingPracticeRef.current) return;
      const step = f2StepRef.current;
      if (step === 0) {
        setCardOpenStates({ 0: true, 1: true });
        f2StepRef.current = 1;
      } else if (step === 1) {
        setCardOpenStates(prev => ({ ...prev, 0: false }));
        f2StepRef.current = 2;
      } else {
        setCardOpenStates({ 0: false, 1: false });
        f2StepRef.current = 0;
      }
    });

    // Alt+1/2 → 왼쪽 탭, Alt+3/4/5 → 오른쪽 탭 (Digit + Numpad 둘 다)
    const bindTab = (digitCode, numpadCode, fn) => {
      editor.addCommand(monaco.KeyMod.Alt | digitCode, fn);
      editor.addCommand(monaco.KeyMod.Alt | numpadCode, fn);
    };
    bindTab(monaco.KeyCode.Digit1, monaco.KeyCode.Numpad1, () => setActiveTab(TABS[0].id));
    bindTab(monaco.KeyCode.Digit2, monaco.KeyCode.Numpad2, () => setActiveTab(TABS[1].id));
    bindTab(monaco.KeyCode.Digit3, monaco.KeyCode.Numpad3, () => setActiveRightTab(RIGHT_TABS[0].id));
    bindTab(monaco.KeyCode.Digit4, monaco.KeyCode.Numpad4, () => {
      if (!isQuizUnlockedRef.current) triggerUnlockQuizRef.current();
      else setActiveRightTab(RIGHT_TABS[1].id);
    });
    bindTab(monaco.KeyCode.Digit5, monaco.KeyCode.Numpad5, () => setActiveRightTab(RIGHT_TABS[2].id));
  };

  // Alt+1/2 → 왼쪽 탭, Alt+3/4 → 오른쪽 탭, F2 → 해석 카드 순환, F4 → 타자연습 열기
  // ── HMR 대응: 핸들러를 ref에 담아두고 useEffect([])는 thin wrapper만 등록.
  //    이러면 파일 저장시마다 ref가 최신 함수로 갱신돼서 리스너 재등록 없이도 최신 로직이 먹힘.
  const keydownHandlerRef = useRef(null);
  keydownHandlerRef.current = (e) => {
      // 한글 IME 조합 중엔 무시 (keyCode 229 = IME composition)
      if (e.isComposing || e.keyCode === 229) return;
      // F2: 해석 카드 순환 (전체 펼침 → 순차 접힘 → 전체 접힘 → 루프)
      // 타자연습 오버레이 활성 시에는 F2를 타자연습(다시하기)에 양보
      if (e.code === 'F2') {
        if (isTypingPracticeRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const step = f2StepRef.current;
        if (step === 0) {
          setCardOpenStates({ 0: true, 1: true });
          f2StepRef.current = 1;
        } else if (step === 1) {
          setCardOpenStates(prev => ({ ...prev, 0: false }));
          f2StepRef.current = 2;
        } else {
          setCardOpenStates({ 0: false, 1: false });
          f2StepRef.current = 0;
        }
        return;
      }

      // F4: 타자연습 토글 (이미 열려 있으면 닫고, 아니면 연다)
      if (e.code === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        setIsTypingPractice((v) => {
          if (!v) {
            setIsCheating(computeIsCheating());
            setIsShortCode(computeIsShortCode());
          }
          return !v;
        });
        return;
      }

      if (!e.altKey) return;
      // Alt+Digit / Alt+Numpad 모두 캡처 (Shift 는 대문자 입력과 충돌해서 Alt 로 변경)

      const isKey = (digit, numpad) => e.code === digit || e.code === numpad;

      if (isKey('Digit1', 'Numpad1')) {
        e.preventDefault(); e.stopPropagation();
        setActiveTab(TABS[0].id);
      } else if (isKey('Digit2', 'Numpad2')) {
        e.preventDefault(); e.stopPropagation();
        setActiveTab(TABS[1].id);
      } else if (isKey('Digit3', 'Numpad3')) {
        e.preventDefault(); e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[0].id);
      } else if (isKey('Digit4', 'Numpad4')) {
        e.preventDefault(); e.stopPropagation();
        if (!isQuizUnlockedRef.current) {
          triggerUnlockQuizRef.current();
        } else {
          setActiveRightTab(RIGHT_TABS[1].id);
        }
      } else if (isKey('Digit5', 'Numpad5')) {
        e.preventDefault(); e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[2].id);
      }
  };
  useEffect(() => {
    const onKeyDown = (e) => keydownHandlerRef.current?.(e);
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
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


  return (
    <div ref={splitContainerRef} className="relative flex-1 flex overflow-hidden">

      {/* ── 왼쪽: 코드 패널 ── */}
      <div
        className="relative flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg shrink-0"
        style={{ width: `${splitRatio * 100}%` }}
      >
        {/* 탭 바 */}
        <div className="free-tab-bar flex items-end shrink-0" style={{ minHeight: 42 }}>
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`free-tab ${activeTab === tab.id ? 'free-tab-active' : 'free-tab-inactive'}`}
            >
              <span>{tab.label}</span>
              <span className="free-tab-shortcut">Alt + {idx + 1}</span>
            </button>
          ))}
          <div className="free-tab-right-panel ml-auto self-stretch flex items-center gap-1.5 px-3 pt-[1px]">
            <button
              onClick={() => {
                setIsCheating(computeIsCheating());
                setIsShortCode(computeIsShortCode());
                setIsTypingPractice(true);
              }}
              title="F4"
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <span>⌨️</span>
              <span>타자연습</span>
              <span className="text-[9px] font-black opacity-70 bg-white/10 px-1 py-0.5 rounded">
                F4
              </span>
            </button>
            <button
              onClick={() => setIsReadOnly(v => !v)}
              className="h-7 flex items-center gap-2 px-2.5 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-gray-400 hover:bg-white/10 transition-all"
            >
              <span className={isReadOnly ? 'text-[#f59e0b]' : 'text-gray-500'}>
                {isReadOnly ? '읽기 모드' : '수정 모드'}
              </span>
              <div className={`relative w-7 h-4 rounded-full transition-colors duration-200 ${isReadOnly ? 'bg-[#f59e0b]' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${isReadOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Monaco 액자라운드 */}
        <div className="relative flex-1 min-h-0 mx-1.5 mb-1.5 mt-1 rounded-2xl border border-[#e0be7a]/40 bg-[#0d1518] overflow-hidden">
          {/* 에디터 글씨 크기 조절 */}
          <div className="absolute top-2 right-3 z-10 flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditorFontSize(prev => Math.max(10, prev - 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-[13px] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >−</button>
            <span className="text-[11px] text-gray-500 w-6 text-center">{editorFontSize}</span>
            <button
              onClick={() => setEditorFontSize(prev => Math.min(28, prev + 1))}
              className="w-7 h-7 flex items-center justify-center rounded text-[13px] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >+</button>
          </div>

          {/* AI 코드 생성 오버레이 — Alt+2 탭이 비어있을 때 */}
          {activeTab === 'ai' && !tabContents.ai && (
            <div className="absolute inset-0 rounded-2xl z-10 flex flex-col items-center justify-center gap-4 bg-[#0d1117]/90 backdrop-blur-sm">
              <p className="text-white font-bold text-sm" style={{ textShadow: '0 0 12px rgba(255,255,255,0.4)' }}>1번 탭 코드를 분석해서 새 예제를 만들어줄게</p>
              <button
                onClick={generateAiCode}
                disabled={isGeneratingAi}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30 hover:text-cyan-100 transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                {isGeneratingAi ? (
                  <><span className="animate-spin">⟳</span> 생성 중...</>
                ) : (
                  <>✨ AI 코드 생성</>
                )}
              </button>
            </div>
          )}

        {/* Monaco */}
        <div
          className="h-full overflow-hidden"
          ref={(el) => {
            if (!el || el._wheelBound) return;
            el._wheelBound = true;
            el.addEventListener('wheel', (e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              setEditorFontSize(prev => Math.max(10, Math.min(28, prev + (e.deltaY < 0 ? 1 : -1))));
            }, { passive: false });
          }}
        >
          <Editor
            height="100%"
            defaultLanguage="java"
            path={activeTab}
            value={tabContents[activeTab]}
            onChange={(v) => setTabContents(prev => ({ ...prev, [activeTab]: v ?? '' }))}
            onMount={handleEditorMount}
            options={{
              fontSize: editorFontSize,
              lineHeight: 1.7,
              letterSpacing: 0.4,
              mouseWheelZoom: true,
              fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
              fontWeight: '400',
              fontLigatures: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              folding: false,
              wordWrap: 'on',
              padding: { top: 16, bottom: 16 },
              renderLineHighlight: 'line',
              scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
              bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
              guides: { bracketPairs: true, indentation: true },
              stickyScroll: { enabled: false },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              'semanticHighlighting.enabled': false,
              readOnly: isReadOnly,
              readOnlyMessage: { value: '읽기 모드입니다. 수정하려면 토글을 꺼주세요.' },
            }}
          />
        </div>
        {/* 읽기 모드 안내 — 에디터 하단 */}
        {isReadOnly && (
          <div className="px-3 py-1.5 text-[10px] font-semibold text-amber-400/70 bg-amber-500/5 border-t border-amber-500/15 select-none">
            🔒 읽기 모드 — 수정하려면 토글을 꺼주세요
          </div>
        )}
        </div>{/* 액자 컨테이너 닫기 */}
      </div>

      {/* ── 스플리터 ── */}
      <div
        onMouseDown={handleSplitMouseDown}
        className="w-1.5 cursor-col-resize flex items-center justify-center group hover:bg-cyan-500/20 transition-colors rounded-full mx-0.5 shrink-0"
      >
        <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-cyan-400 rounded-full transition-colors" />
      </div>

      {/* ── 오른쪽: 채팅 패널 ── */}
      <div className="relative flex-1 min-w-0 flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg">
        {/* 탭 바 */}
        <div className="free-tab-bar flex items-end shrink-0" style={{ minHeight: 42 }}>
          {RIGHT_TABS.map((tab, idx) => {
            const locked = tab.id === 'quiz' && !isQuizUnlocked;
            const isQuizTab = tab.id === 'quiz';
            return (
              <button
                key={tab.id}
                onClick={() => { if (!locked) setActiveRightTab(tab.id); }}
                disabled={locked}
                className={`free-tab
                  ${activeRightTab === tab.id ? 'free-tab-active' : 'free-tab-inactive'}
                  ${locked ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isQuizTab && isUnlocking ? 'tab-unlocking' : ''}
                  ${isQuizTab && justUnlocked ? 'tab-unlocked-pop' : ''}
                `}
                onMouseEnter={locked ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setQuizLockHover({ top: r.bottom + 8, left: r.left });
                } : undefined}
                onMouseLeave={locked ? () => setQuizLockHover(null) : undefined}
              >
                <span className="flex items-center gap-1">
                  {locked && <span className="lock-icon text-[11px]">🔒</span>}
                  {tab.label}
                </span>
                {!locked && <span className="free-tab-shortcut">Alt + {idx + 3}</span>}
              </button>
            );
          })}
          <div className="free-tab-right-panel ml-auto self-stretch flex items-center gap-1.5 px-3 pt-[1px]">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              학습 종료 ✕
            </button>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="relative flex-1 flex flex-col min-h-0 mx-1.5 mt-1 mb-1.5 rounded-2xl border border-[#e0be7a]/40 bg-[#0d1518] overflow-hidden">

          {/* 💬 Lucid Tutor */}
          <div className={`flex-1 flex flex-col min-h-0 ${activeRightTab === 'tutor' ? '' : 'hidden'}`}>
              {!isQuizUnlocked && (
                <button
                  disabled={isUnlocking}
                  onClick={triggerUnlockQuiz}
                  className="absolute bottom-20 right-4 z-10 flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold bg-violet-500/15 backdrop-blur-sm border border-violet-400/40 text-violet-300 hover:bg-violet-500/25 hover:text-violet-100 shadow-md shadow-violet-950/30 transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  <span>🔓 문제풀기</span>
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded border border-white/15 bg-white/10 text-gray-500">
                    Alt+4
                  </span>
                </button>
              )}
              <ChatPanel
                key={chatKey}
                getCodeContext={() => tabContents[activeTab]}
                placeholder="Lucid에게 물어보기"
                greeting={chatGreeting}
                systemPrompt={chatSystemPrompt || undefined}
                model={MODELS.FREESTUDY_TUTOR}
                splitRatio={splitRatio}
                onHighlightToken={highlightCodeToken}
                quickQuestion="이 코드 뭐하는 코드야?"
                onGoToQuiz={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', altKey: true, bubbles: true, cancelable: true }))}
                className=""
              />
          </div>

          {/* 🎯 문제풀기 — display:none으로 숨겨서 탭 전환 시 state 유지 */}
          <div className={`flex-1 flex flex-col min-h-0 ${activeRightTab === 'quiz' ? '' : 'hidden'}`}>
            <FreeStudyQuiz
              getCodeContext={() => tabContents[activeTab]}
              onSendToTutor={handleSendToTutor}
              onHighlightToken={highlightCodeToken}
            />
          </div>

          {/* 📝 메모 */}
          {activeRightTab === 'memo' && <MemoPanel />}

        </div>
      </div>

      {/* 타자연습 오버레이 — split 컨테이너 전체(에디터+채팅)를 덮어 폭을 최대로 확보 */}
      {isTypingPractice && (
        <TypingPractice
          code={tabContents[activeTab]}
          isNewRecord={typingIsNewRecord}
          previousBest={typingBest}
          onRestart={() => setTypingIsNewRecord(false)}
          onClose={() => {
            setIsTypingPractice(false);
            setTypingIsNewRecord(false);
          }}
          onComplete={async (result) => {
            if (!user?.uid) return;
            if (isCheating) {
              await saveCheatBadge(user.uid);
              setTypingIsNewRecord(false);
              return;
            }
            if (isShortCode) {
              // 20줄 미만 → 결과만 보여주고 기록 저장 X, 뱃지 X
              setTypingIsNewRecord(false);
              return;
            }
            const saved = await recordTypingSession(user.uid, result);
            if (saved?.isNewRecord) {
              setTypingIsNewRecord(true);
              setTypingBest((prev) => ({
                ...(prev || {}),
                bestCpm: saved.bestCpm,
                bestAccuracy: saved.bestAccuracy,
              }));
            } else {
              setTypingIsNewRecord(false);
            }
          }}
          onResetBest={async () => {
            if (!user?.uid) return;
            const ok = await resetTypingStats(user.uid);
            if (ok) {
              setTypingBest({
                bestCpm: 0,
                bestAccuracy: 0,
                sessionCount: 0,
                totalChars: 0,
                recent: [],
              });
            }
          }}
        />
      )}

      {/* 문제풀기 잠금 탭 호버 카드 */}
      {quizLockHover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ top: quizLockHover.top, left: quizLockHover.left }}
        >
          <div className="bg-[#1a1f2e] border border-violet-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-violet-950/40 w-[220px]">
            <div className="text-violet-300 text-[11px] font-black tracking-wide mb-1.5">🎯 문제풀기</div>
            <div className="text-gray-300 text-[11px] leading-relaxed">
              코드가 이해되시면<br/>문제에 도전하세요
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 text-gray-500 text-[10px] flex items-center gap-1">
              <span>🔓</span>
              <span>아래 버튼 또는 Alt+4 로 잠금 해제</span>
            </div>
          </div>
        </div>
      )}

      {/* 학습 종료 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e2030] border border-white/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 shadow-2xl w-[320px]">
            <p className="text-white font-bold text-base">학습을 종료할까요?</p>
            <p className="text-gray-400 text-sm text-center">작성한 내용은 저장되지 않습니다.</p>
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-2 rounded-lg bg-red-500/80 text-white text-sm font-bold hover:bg-red-500 transition-all"
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeStudyView;
