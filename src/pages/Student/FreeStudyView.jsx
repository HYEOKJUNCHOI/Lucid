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
import { useIsMobile } from '../../hooks/useMediaQuery';
import CodePeekButton from '../../components/common/mobile/CodePeekButton';


const TABS = [
  { id: 'main', label: '💻 코드노트' },
  { id: 'ai',   label: '🤖 AI 생성코드' },
];

const RIGHT_TABS = [
  { id: 'tutor', label: '💬 Lucid Tutor' },
  { id: 'quiz',  label: '🎯 문제풀기' },
  { id: 'memo',  label: '📝 학습메모' },
];

const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 블록 주석 /* ... */
    .replace(/\/\/[^\n]*/g, '')          // 라인 주석 // ...
    .replace(/^\s*\n/gm, '\n')           // 주석 제거 후 남은 빈 줄 정리
    .replace(/\n{3,}/g, '\n\n')          // 연속 빈 줄 2개로 압축
    .trim();

const FreeStudyView = ({ onBack, showLanding = false, teacher = null, enrolledRepoNames = [], onGoToChapter = null, externalCode = null, fromChapter = false }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [activeRightTab, setActiveRightTab] = useState('tutor');
  const [tabContents, setTabContents] = useState({
    main: '',
    ai: '',
  });
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [tabFontSizes, setTabFontSizes] = useState({ main: 13, ai: 13 });
  const editorFontSize = tabFontSizes[activeTab] ?? 13;
  const setEditorFontSize = (updater) =>
    setTabFontSizes(prev => {
      const next = typeof updater === 'function' ? updater(prev[activeTab] ?? 13) : updater;
      return { ...prev, [activeTab]: Math.max(10, Math.min(28, next)) };
    });
  const editorRef = useRef(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isTypingPractice, setIsTypingPractice] = useState(false);
  const isTypingPracticeRef = useRef(false);
  isTypingPracticeRef.current = isTypingPractice;
  const [typingIsNewRecord, setTypingIsNewRecord] = useState(false);
  const [typingBest, setTypingBest] = useState(null); // { bestCpm, bestAccuracy, sessionCount, ... }
  const [isCheating, setIsCheating] = useState(false);
  // 20줄 미만 코드 여부 — 치팅과 동일 패턴으로 기록만 저장 스킵, 뱃지 없음
  const [isShortCode, setIsShortCode] = useState(false);
  // Lucid Tutor 컨텍스트 핸드오프 (퀴즈 결과 → 튜터)
  const [chatKey, setChatKey] = useState(0);
  const [chatGreeting, setChatGreeting] = useState('코드에 대해 뭐든 물어보세요');
  const [chatSystemPrompt, setChatSystemPrompt] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState(1); // 0:쉬움 1:보통 2:어려움
  const [focusedPanel, setFocusedPanel] = useState(null); // 'left' | 'right'
  const chatScrollRef = useRef(null);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // 모바일 탭바 우측 "⋯" 드롭다운 오픈 여부
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── 랜딩 패널 상태 ────────────────────────────────────
  const [landingVisible, setLandingVisible] = useState(showLanding);
  const [landingSection, setLandingSection] = useState(null); // null | 'github' | 'keyword' | 'keyword-guide'
  const [freeCodeMode, setFreeCodeMode] = useState(false);
  // 담당강사 있으면 항상 체크 ON으로 시작
  const [useTeacherGithub, setUseTeacherGithub] = useState(() => {
    const saved = localStorage.getItem('lucid_github_use_teacher');
    if (saved !== null) return saved === 'true';
    return !!teacher?.githubUsername; // 첫 방문 기본값: 선생님 있으면 ON
  });
  const [landingGithubId, setLandingGithubId] = useState(() => {
    if (teacher?.githubUsername) return teacher.githubUsername;
    return localStorage.getItem('lucid_github_id') || '';
  });
  const [landingRepos, setLandingRepos] = useState(null);
  const [landingReposLoading, setLandingReposLoading] = useState(false);
  const [landingKeyword, setLandingKeyword] = useState('');
  const [landingKeywordLoading, setLandingKeywordLoading] = useState(false);

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

  // 외부 코드 주입 (챕터 모달에서 파일 선택 시)
  useEffect(() => {
    if (externalCode) {
      setTabContents(prev => ({ ...prev, main: externalCode }));
      setLandingVisible(false);
      setActiveTab('main');
    }
  }, [externalCode]);

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
  const f2StepRef = useRef(0);
  const monacoRef = useRef(null);
  const splitContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  // AI 코드 생성 (Alt+2 탭) — 1번탭 코드를 읽고 같은 패턴·다른 소재로 새 예제 생성
  const generateAiCode = async () => {
    const mainCode = tabContentsRef.current.main;
    if (!mainCode.trim()) {
      // 코드노트가 비어있으면 가이던스 팝업 띄우기
      setLandingSection('keyword-guide');
      return;
    }
    if (isGeneratingAi) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('Gemini API 키 없음');
      alert('⚠️ AI 코드 생성을 위한 API 키가 설정되지 않았습니다.\n\n로컬: .env 파일에 VITE_GEMINI_API_KEY 추가\nVercel: 프로젝트 설정 → Environment Variables에서 VITE_GEMINI_API_KEY 추가');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const difficultyInstruction = [
        '클래스 1개, 필드 2~3개, 메서드 2~3개로 구조를 원본보다 훨씬 단순하게 줄여라. 편의점·냉장고·버스 같은 극도로 친근한 일상 소재를 써라.',
        '원본과 클래스 수·메서드 수·상속 구조를 동일하게 유지하되 소재만 바꿔라. 변수명·로직은 원본과 1:1 대응되게.',
        '원본보다 메서드 수를 늘리고 유효성 검사·예외 처리·추가 필드를 포함해라. 재고관리·주문시스템·로그처리 같은 실무 패턴 소재를 써라.',
      ][aiDifficulty];

      const prompt = `아래 Java 코드를 분석해서 같은 디자인 패턴·구조로 완전히 다른 소재의 새 Java 예제를 작성해라.

[출력 규칙 — 반드시 지켜]
- 순수 Java 코드만 출력. 설명·주석·마크다운 코드블록(\`\`\`) 절대 금지.
- 클래스명·변수명은 한글, 메서드명은 영어.
- package·import 없이 클래스만.
- ${difficultyInstruction}

[원본 코드]
${mainCode.slice(0, 3000)}`;

      const res = await fetch(
        `${GEMINI_CHAT_URL(MODELS.FREESTUDY_TUTOR)}?key=${apiKey}`,
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
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || '생성 실패');
      }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      // 코드블록 마크다운 제거 후 Java 코드 시작점까지 앞부분 잘라내기
      const stripped = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const lines = stripped.split('\n');
      const codeStart = lines.findIndex(l => /^(public\s|class\s|\/\/)/.test(l.trim()));
      const generated = (codeStart >= 0 ? lines.slice(codeStart).join('\n') : stripped).trim();
      if (generated) {
        aiReferenceCodeRef.current = generated;
        setTabContents(prev => ({ ...prev, ai: generated }));
      }
    } catch (err) {
      console.error('AI 코드 생성 실패:', err);
      alert('❌ AI 코드 생성 중 오류가 발생했습니다.\n\n' + err.message);
    } finally {
      setIsGeneratingAi(false);
    }
  };



  // ─── 랜딩: GitHub 레포 검색 ────────────────────────────
  const fetchLandingRepos = async (overrideId) => {
    const id = (overrideId ?? landingGithubId).trim();
    if (!id) return;
    setLandingReposLoading(true);
    setLandingRepos(null);
    try {
      const res = await fetch(`https://api.github.com/users/${id}/repos?per_page=100&sort=updated`);
      const data = await res.json();
      if (res.status === 403 && data?.message?.includes('rate limit')) {
        setLandingRepos([{ name: '__rate_limit__' }]);
      } else {
        const repos = Array.isArray(data) ? data.map(r => ({ name: r.name, description: r.description })) : [];
        setLandingRepos(repos);
      }
    } catch { setLandingRepos([]); }
    finally { setLandingReposLoading(false); }
  };

  // ─── 랜딩: 키워드 AI 코드 생성 → 코드노트에 삽입 ────────
  const generateKeywordCode = async () => {
    if (!landingKeyword.trim() || landingKeywordLoading) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('Gemini API 키 없음');
      alert('⚠️ AI 코드 생성을 위한 API 키가 설정되지 않았습니다.\n\n로컬: .env 파일에 VITE_GEMINI_API_KEY 추가\nVercel: 프로젝트 설정 → Environment Variables에서 VITE_GEMINI_API_KEY 추가');
      return;
    }

    setLandingKeywordLoading(true);
    try {
      const prompt = `Java 개념 "${landingKeyword.trim()}"을 학습할 수 있는 예제 코드를 작성해라.
[출력 규칙 — 반드시 지켜]
- 순수 Java 코드만 출력. 설명·주석·마크다운 코드블록(\`\`\`) 절대 금지.
- 클래스명·변수명은 한글, 메서드명은 영어.
- package·import 없이 클래스만.
- 30~60줄 분량의 실용적 예제.`;
      const res = await fetch(
        `${GEMINI_CHAT_URL(MODELS.FREESTUDY_TUTOR)}?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8 } }) }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || '생성 실패');
      }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const stripped = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const lines = stripped.split('\n');
      const codeStart = lines.findIndex(l => /^(public\s|class\s|\/\/)/.test(l.trim()));
      const generated = (codeStart >= 0 ? lines.slice(codeStart).join('\n') : stripped).trim();
      if (generated) {
        setTabContents(prev => ({ ...prev, main: generated }));
        setLandingSection(null);
        setLandingVisible(false);
      }
    } catch (err) {
      console.error('키워드 코드 생성 실패:', err);
      alert('❌ AI 코드 생성 중 오류가 발생했습니다.\n\n' + err.message);
    }
    finally { setLandingKeywordLoading(false); }
  };

  // 퀴즈/채팅 코드 토큰 Ctrl+Click → 왼쪽 에디터 하이라이트
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
    bindTab(monaco.KeyCode.Digit1, monaco.KeyCode.Numpad1, () => { setActiveTab(TABS[0].id); setFocusedPanel('left'); });
    bindTab(monaco.KeyCode.Digit2, monaco.KeyCode.Numpad2, () => { setActiveTab(TABS[1].id); setFocusedPanel('left'); });
    bindTab(monaco.KeyCode.Digit3, monaco.KeyCode.Numpad3, () => { setActiveRightTab(RIGHT_TABS[0].id); setFocusedPanel('right'); });
    bindTab(monaco.KeyCode.Digit4, monaco.KeyCode.Numpad4, () => { setActiveRightTab(RIGHT_TABS[1].id); setFocusedPanel('right'); });
    bindTab(monaco.KeyCode.Digit5, monaco.KeyCode.Numpad5, () => { setActiveRightTab(RIGHT_TABS[2].id); setFocusedPanel('right'); });

    // ─── Java 스니펫 등록 ────────────────────────────────
    monaco.languages.registerCompletionItemProvider('java', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        const snippets = [
          {
            label: 'sout',
            insertText: 'System.out.println(${1});',
            documentation: 'System.out.println()',
          },
          {
            label: 'soutf',
            insertText: 'System.out.printf("${1}"%{2});',
            documentation: 'System.out.printf()',
          },
          {
            label: 'fori',
            insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}',
            documentation: 'for 반복문',
          },
          {
            label: 'psvm',
            insertText: 'public static void main(String[] args) {\n\t${1}\n}',
            documentation: 'main 메서드',
          },
          {
            label: 'main',
            insertText: 'public static void main(String[] args) {\n\t${1}\n}',
            documentation: 'main 메서드',
          },
        ];
        return {
          suggestions: snippets.map(s => ({
            ...s,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          })),
        };
      },
    });
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
        setActiveTab(TABS[0].id); setFocusedPanel('left');
      } else if (isKey('Digit2', 'Numpad2')) {
        e.preventDefault(); e.stopPropagation();
        setActiveTab(TABS[1].id); setFocusedPanel('left');
      } else if (isKey('Digit3', 'Numpad3')) {
        e.preventDefault(); e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[0].id); setFocusedPanel('right');
      } else if (isKey('Digit4', 'Numpad4')) {
        e.preventDefault(); e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[1].id); setFocusedPanel('right');
      } else if (isKey('Digit5', 'Numpad5')) {
        e.preventDefault(); e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[2].id); setFocusedPanel('right');
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


  // ════════════════════════════════════════════════
  // 모바일 레이아웃 — 단일 탭바 통합 (6개 풀스크린 탭)
  // ════════════════════════════════════════════════
  if (isMobile) {
    // 5개 탭: main / ai / tutor / quiz / memo
    const MOBILE_TABS = [
      { id: 'main',  label: '💻 코드노트' },
      { id: 'ai',    label: '🤖 AI 생성코드' },
      { id: 'tutor', label: '💬 Lucid Tutor' },
      { id: 'quiz',  label: '🎯 문제풀기' },
      { id: 'memo',  label: '📝 학습메모' },
    ];

    const handleMobileTabChange = (nextId) => {
      setActiveTab(nextId);
    };

    // Monaco 마운트 여부: main/ai 탭에서만 사용하지만 state 보존 위해 항상 mount
    const monacoTab = activeTab === 'ai' ? 'ai' : 'main';
    const monacoVisible = (activeTab === 'main' || activeTab === 'ai') && !landingVisible
      && !(activeTab === 'ai' && !tabContents.ai);

    return (
      <div className="relative flex flex-col flex-1 overflow-hidden bg-[var(--free-editor-bg)]">

        {/* ── 모바일: GitHub 모달 (기존 동일) ── */}
        {landingSection === 'github' && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { setLandingSection(null); setLandingRepos(null); }}>
            <div className="w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: '#0d1117', border: '1px solid rgba(78,201,176,0.25)' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <p className="text-white font-black text-[15px]">📂 GitHub 불러오기</p>
                <button onClick={() => { setLandingSection(null); setLandingRepos(null); }} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
              </div>
              <div className="flex gap-2 px-4 py-3">
                <input
                  value={landingGithubId}
                  onChange={e => { setLandingGithubId(e.target.value); localStorage.setItem('lucid_github_id', e.target.value); setLandingRepos(null); }}
                  onKeyDown={e => e.key === 'Enter' && fetchLandingRepos()}
                  placeholder="GitHub ID 입력 후 Enter"
                  autoFocus
                  className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <button onClick={() => fetchLandingRepos()} disabled={landingReposLoading || !landingGithubId.trim()}
                  className="px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-40"
                  style={{ background: 'rgba(78,201,176,0.15)', border: '1px solid rgba(78,201,176,0.35)', color: '#4ec9b0' }}>
                  {landingReposLoading ? '...' : '검색'}
                </button>
              </div>
              {landingRepos && (
                <div className="px-4 py-3 flex flex-col gap-2 max-h-60 overflow-y-auto">
                  {landingRepos.map(r => (
                    <button key={r.name}
                      onClick={() => { setLandingSection(null); setLandingRepos(null); onGoToChapter && onGoToChapter({ githubUsername: landingGithubId.trim(), repo: { name: r.name, label: r.name } }); }}
                      className="text-left px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-[14px] font-bold text-white">{r.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 모바일: 통합 탭바 (가로 스크롤) + ⋯ 메뉴 ── */}
        <div className="relative shrink-0 flex items-stretch border-b border-white/[0.06] bg-[var(--free-editor-bg)]">
          <div
            className="flex-1 flex items-stretch overflow-x-auto scrollbar-thin snap-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {MOBILE_TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleMobileTabChange(tab.id)}
                  className="shrink-0 snap-start flex items-center justify-center px-3 text-[12px] font-bold transition-colors"
                  style={{
                    minWidth: 80,
                    minHeight: 44,
                    color: active ? '#4ec9b0' : '#9ca3af',
                    background: active ? 'rgba(78,201,176,0.08)' : 'transparent',
                    borderBottom: active ? '2px solid #4ec9b0' : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* ⋯ 더보기 버튼 */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="shrink-0 flex items-center justify-center text-gray-400 text-lg"
            style={{ minWidth: 44, minHeight: 44, borderLeft: '1px solid rgba(255,255,255,0.06)' }}
            aria-label="더보기"
          >
            ⋯
          </button>

          {/* 드롭다운 */}
          {mobileMenuOpen && (
            <>
              {/* 바깥 클릭으로 닫기 */}
              <div
                className="fixed inset-0 z-[9]"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div
                className="absolute right-2 top-full mt-1 z-10 rounded-xl overflow-hidden shadow-2xl"
                style={{
                  background: '#0d1117',
                  border: '1px solid rgba(255,255,255,0.12)',
                  minWidth: 200,
                }}
              >
                <div className="px-4 py-2.5 text-[11px] text-amber-400 font-semibold border-b border-white/[0.06]">
                  🔒 모바일은 읽기 전용
                </div>
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowExitConfirm(true); }}
                  className="w-full px-4 py-3 text-left text-[13px] font-bold text-red-300 hover:bg-white/[0.04]"
                >
                  ✕ 학습 종료
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── 모바일: 탭별 풀스크린 컨텐츠 ── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">

          {/* ──── main 탭: 랜딩 상태 ──── */}
          {activeTab === 'main' && landingVisible && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 bg-[#0d1117]">
              <span className="text-4xl">💻</span>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                코드를 불러온 뒤 학습을 시작하세요.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => setLandingSection('github')}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(78,201,176,0.15)', border: '1px solid rgba(78,201,176,0.35)', color: '#4ec9b0' }}
                >
                  📂 GitHub에서 불러오기
                </button>
                <button
                  onClick={() => { setLandingVisible(false); setFreeCodeMode(true); }}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#d1d5db' }}
                >
                  직접 시작
                </button>
              </div>
            </div>
          )}

          {/* ──── ai 탭: 빈 상태 ──── */}
          {activeTab === 'ai' && !tabContents.ai && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[#0d1117]">
              <span className="text-4xl">🤖</span>
              <p className="text-gray-400 text-sm text-center leading-relaxed">
                AI 생성코드는 데스크탑에서<br />생성·확인할 수 있습니다.
              </p>
            </div>
          )}

          {/* ──── Monaco 에디터 (main/ai 공용, state 보존 위해 항상 마운트) ──── */}
          <div
            className="absolute inset-0"
            style={{ display: monacoVisible ? 'block' : 'none' }}
          >
            <Editor
              height="100%"
              defaultLanguage="java"
              path={monacoTab}
              value={tabContents[monacoTab]}
              onMount={handleEditorMount}
              options={{
                fontSize: editorFontSize,
                lineHeight: 1.7,
                fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                folding: false,
                wordWrap: 'on',
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'none',
                scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                stickyScroll: { enabled: false },
                smoothScrolling: true,
                'semanticHighlighting.enabled': false,
                readOnly: true,
                readOnlyMessage: { value: '모바일에서는 읽기 전용입니다. 편집은 데스크탑에서 하세요.' },
                contextmenu: false,
              }}
            />
          </div>

          {/* ──── tutor 탭: ChatPanel (state 보존 위해 display 토글) ──── */}
          <div
            className="absolute inset-0 flex flex-col"
            style={{ display: activeTab === 'tutor' ? 'flex' : 'none' }}
          >
            <ChatPanel
              key={chatKey}
              getCodeContext={() => {
                if (landingVisible) return null;
                const code = tabContents[monacoTab];
                return code?.trim() ? code : null;
              }}
              notice={landingVisible || !tabContents[monacoTab]?.trim() ? true : null}
              chatScrollRef={chatScrollRef}
              placeholder="Lucid에게 물어보기"
              greeting={chatGreeting}
              systemPrompt={chatSystemPrompt || undefined}
              model={MODELS.FREESTUDY_TUTOR}
              splitRatio={1}
              onHighlightToken={highlightCodeToken}
              quickQuestions={[
                '이 코드 뭐하는 코드야?',
                '게임 배경을 바탕으로 비유로 설명해줘',
              ]}
            />
          </div>

          {/* ──── quiz 탭: 마운트/언마운트 (state 리셋 허용) ──── */}
          {activeTab === 'quiz' && (
            <div className="absolute inset-0 overflow-y-auto">
              <FreeStudyQuiz
                getCodeContext={() => tabContents[monacoTab]}
                onSendToTutor={(payload) => { handleSendToTutor(payload); setActiveTab('tutor'); }}
                onHighlightToken={highlightCodeToken}
                activeTab={monacoTab}
                defaultCount={3}
                isActive={true}
              />
            </div>
          )}

          {/* ──── 모바일 전용: 홀드 투 피크 코드 미리보기 (quiz/tutor/memo 탭에서) ──── */}
          {(activeTab === 'quiz' || activeTab === 'tutor' || activeTab === 'memo') && (
            <CodePeekButton
              code={tabContents.main || tabContents.ai || ''}
              language="java"
            />
          )}

          {/* ──── memo 탭 ──── */}
          {activeTab === 'memo' && (
            <div className="absolute inset-0 overflow-y-auto">
              <MemoPanel />
            </div>
          )}

        </div>

        {/* safe-area 여백 */}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />

        {/* 학습 종료 확인 모달 */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 w-[300px] mx-4"
              style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, padding: '28px 28px 24px' }}>
              <span className="text-xl">⚠️</span>
              <div className="text-center">
                <p className="text-white font-black text-[15px]">학습을 종료할까요?</p>
                <p className="text-gray-400 text-[12px] mt-1">작성한 내용은 저장되지 않습니다.</p>
              </div>
              <div className="flex gap-2.5 w-full">
                <button onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 text-[13px] font-bold text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                  취소
                </button>
                <button onClick={onBack}
                  className="flex-1 py-2.5 text-[13px] font-bold"
                  style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, color: '#f87171' }}>
                  종료
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // 데스크탑 레이아웃 (기존 코드 유지)
  // ════════════════════════════════════════════════
  return (
    <div ref={splitContainerRef} className="relative flex-1 flex overflow-hidden">

      {/* ── GitHub 불러오기 모달 ── */}
      {landingSection === 'github' && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setLandingSection(null); setLandingRepos(null); }}>
          <div className="w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#0d1117', border: '1px solid rgba(78,201,176,0.25)', boxShadow: '0 0 40px rgba(78,201,176,0.08)' }}
            onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="text-base">📂</span>
                <p className="text-white font-black text-[15px] tracking-tight">GitHub 불러오기</p>
              </div>
              <button onClick={() => { setLandingSection(null); setLandingRepos(null); }}
                className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            {/* 담당강사 체크박스 */}
            {teacher?.githubUsername && (
              <label className="flex items-center gap-2.5 px-6 py-3 border-b border-white/[0.06] cursor-pointer select-none">
                <input type="checkbox" checked={useTeacherGithub}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUseTeacherGithub(checked);
                    localStorage.setItem('lucid_github_use_teacher', String(checked));
                    const newId = checked ? teacher.githubUsername : '';
                    setLandingGithubId(newId);
                    if (newId) localStorage.setItem('lucid_github_id', newId);
                    setLandingRepos(null);
                  }}
                  className="w-4 h-4 accent-[#4ec9b0]"
                />
                <span className="text-[13px] text-gray-400">담당강사 GitHub
                  <span className="text-[#4ec9b0] font-bold ml-1">({teacher.githubUsername})</span>
                </span>
              </label>
            )}
            {/* 검색 입력 (체크 해제 시) / 불러오기 버튼 (체크 ON 시) */}
            <div className="flex gap-2 px-4 py-3 border-b border-white/[0.06]">
              {!useTeacherGithub && (
                <input
                  value={landingGithubId}
                  onChange={e => {
                    setLandingGithubId(e.target.value);
                    localStorage.setItem('lucid_github_id', e.target.value);
                    setLandingRepos(null);
                  }}
                  onKeyDown={e => e.key === 'Enter' && fetchLandingRepos()}
                  placeholder="GitHub ID 입력 후 Enter"
                  autoFocus
                  className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              )}
              <button onClick={() => fetchLandingRepos()} disabled={landingReposLoading || !landingGithubId.trim()}
                className="px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                style={{ background: 'rgba(78,201,176,0.15)', border: '1px solid rgba(78,201,176,0.35)', color: '#4ec9b0', width: useTeacherGithub ? '100%' : undefined }}>
                {landingReposLoading ? '...' : useTeacherGithub ? '레포 불러오기' : '검색'}
              </button>
            </div>
            {/* 레포 목록 — 검색 결과 있을 때만 표시 */}
            {(landingReposLoading || landingRepos !== null) && (
            <div className="px-4 py-3 flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-hide">
              {landingReposLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-4 h-4 border-2 border-[#4ec9b0]/40 border-t-[#4ec9b0] rounded-full animate-spin" />
                  <span className="text-gray-500 text-sm">불러오는 중...</span>
                </div>
              ) : landingRepos[0]?.name === '__rate_limit__' ? (
                <p className="text-amber-400/70 text-sm text-center py-6">⏱ API 한도 초과 — 1시간 후 재시도</p>
              ) : (() => {
                // 담당강사 체크 시 korit_숫자_ 레포만, label은 _gov_ 뒤 부분
                const displayRepos = useTeacherGithub
                  ? landingRepos
                      .filter(r => enrolledRepoNames.length > 0
                        ? enrolledRepoNames.includes(r.name)
                        : /^korit_\d+_/i.test(r.name))
                      .map(r => ({
                        ...r,
                        label: r.name.includes('_gov_')
                          ? r.name.split('_gov_').pop()
                          : r.name,
                      }))
                  : landingRepos.map(r => ({ ...r, label: r.name }));
                return displayRepos.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">레포가 없습니다</p>
                ) : displayRepos.map(r => (
                  <button key={r.name}
                    onClick={() => {
                      setLandingSection(null);
                      setLandingRepos(null);
                      onGoToChapter && onGoToChapter({ githubUsername: landingGithubId.trim(), repo: { name: r.name, label: r.label } });
                    }}
                    className="text-left px-4 py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:border-white/20"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[14px] font-bold text-white">{r.label}</p>
                    {useTeacherGithub && <p className="text-[11px] text-gray-500 mt-0.5">{r.name}</p>}
                  </button>
                ));
              })()}
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── AI 키워드 가이던스 팝업 ── */}
      {landingSection === 'keyword-guide' && (() => {
        const codeNoteEmpty = !tabContents.main.trim();
        const aiCodeGenerated = tabContents.ai.trim();

        let state, stateColor, icon, title, description;

        if (codeNoteEmpty) {
          state = 'empty';
          stateColor = { bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', text: '#9ca3af' };
          icon = '⭕';
          title = '코드노트가 비어있어요';
          description = '먼저 💻 코드노트 탭에서 학습할 코드를 입력하세요.';
        } else if (aiCodeGenerated) {
          state = 'generated';
          stateColor = { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.4)', text: '#fbbf24' };
          icon = '✅';
          title = 'AI 코드가 준비됐어요!';
          description = '🤖 AI 생성코드 탭에서 AI가 만든 새로운 코드를 확인할 수 있습니다.';
        } else {
          state = 'ready';
          stateColor = { bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.4)', text: '#fb7185' };
          icon = '⏳';
          title = '코드를 분석했어요';
          description = '코드노트에서 공부한 코드를 분석해서 새로운 코드를 AI가 생성해줍니다. 생성을 시작하려면 아래 버튼을 클릭하세요.';
        }

        return (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setLandingSection(null)}>
            <div className="w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl"
              style={{ background: '#111827', border: '1px solid rgba(167,139,250,0.25)' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-5">
                <p className="text-white font-bold text-base">✨ AI 키워드 코드생성</p>
                <button onClick={() => setLandingSection(null)}
                  className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
              </div>

              {/* 상태 표시 영역 */}
              <div className="mb-5 p-4 rounded-xl" style={{ background: stateColor.bg, border: `1px solid ${stateColor.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl mt-0.5">{icon}</div>
                  <div className="flex-1">
                    <p className="font-bold text-sm mb-1" style={{ color: stateColor.text }}>{title}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{description}</p>
                  </div>
                </div>
              </div>

              {/* 3가지 상태 플로우 표시 */}
              <div className="mb-5 bg-[#0f172a] rounded-lg p-3">
                <div className="flex items-center justify-between text-xs gap-2">
                  {/* 상태 1 */}
                  <div className={`flex-1 text-center p-2 rounded ${codeNoteEmpty ? 'bg-gray-700 text-gray-200' : 'bg-gray-900 text-gray-500'}`}>
                    <div className="mb-1">📝</div>
                    <div className="font-semibold text-[10px]">코드노트</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">입력</div>
                  </div>

                  {/* 화살표 1 */}
                  <div className="text-gray-600">→</div>

                  {/* 상태 2 */}
                  <div className={`flex-1 text-center p-2 rounded ${!codeNoteEmpty && !aiCodeGenerated ? 'bg-pink-900 text-pink-200' : 'bg-gray-900 text-gray-500'}`}>
                    <div className="mb-1">🤖</div>
                    <div className="font-semibold text-[10px]">생성 준비</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">대기</div>
                  </div>

                  {/* 화살표 2 */}
                  <div className="text-gray-600">→</div>

                  {/* 상태 3 */}
                  <div className={`flex-1 text-center p-2 rounded ${aiCodeGenerated ? 'bg-amber-900 text-amber-200' : 'bg-gray-900 text-gray-500'}`}>
                    <div className="mb-1">✨</div>
                    <div className="font-semibold text-[10px]">코드 생성</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">완료</div>
                  </div>
                </div>
              </div>

              {/* 상태별 컨텐츠 */}
              {codeNoteEmpty ? (
                <button onClick={() => { setLandingSection(null); setActiveTab('main'); }}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{ background: 'rgba(107,114,128,0.2)', border: '1px solid rgba(107,114,128,0.4)', color: '#d1d5db' }}>
                  💻 코드노트로 이동
                </button>
              ) : aiCodeGenerated ? (
                <button onClick={() => { setLandingSection(null); setActiveTab('ai'); }}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
                  🤖 AI 생성코드 보러가기
                </button>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-2.5 block">난이도 선택</label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">쉬움</span>
                      <input
                        type="range"
                        min="0" max="2"
                        value={aiDifficulty}
                        onChange={e => setAiDifficulty(parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-lg cursor-pointer"
                        style={{ background: 'linear-gradient(to right, rgba(244,63,94,0.3), rgba(244,63,94,0.6))' }}
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap">어려움</span>
                    </div>
                    <div className="text-center mt-2 text-xs text-gray-500">
                      {['쉬움', '보통', '어려움'][aiDifficulty]}
                    </div>
                  </div>
                  <button
                    onClick={() => { generateAiCode(); }}
                    disabled={isGeneratingAi}
                    className="w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                    style={{ background: 'rgba(244,63,94,0.2)', border: '1px solid rgba(244,63,94,0.4)', color: '#fb7185',
                      boxShadow: isGeneratingAi ? 'none' : '0 0 16px rgba(244,63,94,0.15)' }}>
                    {isGeneratingAi
                      ? <><span className="inline-block animate-spin mr-1">⟳</span>생성 중...</>
                      : '✨ AI 코드생성'}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── AI 키워드 모달 (원래대로) ── */}
      {landingSection === 'keyword' && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setLandingSection(null); setLandingKeyword(''); }}>
          <div className="w-full max-w-xs mx-4 rounded-2xl p-5 shadow-2xl"
            style={{ background: '#111827', border: '1px solid rgba(167,139,250,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-white font-bold text-sm">✨ AI 코드생성</p>
              <button onClick={() => { setLandingSection(null); setLandingKeyword(''); }}
                className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            <p className="text-gray-500 text-[11px] mb-4">싱글톤, 배열, 상속... 뭐든 OK</p>
            <input
              value={landingKeyword}
              onChange={e => setLandingKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateKeywordCode()}
              placeholder="예: 싱글톤 패턴"
              autoFocus
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none mb-3"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <button onClick={generateKeywordCode} disabled={landingKeywordLoading || !landingKeyword.trim()}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd',
                boxShadow: landingKeywordLoading ? 'none' : '0 0 16px rgba(167,139,250,0.2)' }}>
              {landingKeywordLoading
                ? <><span className="inline-block animate-spin mr-1">⟳</span>생성 중...</>
                : '✨ AI 코드 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── 왼쪽: 코드 패널 ── */}
      <div
        className="relative flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg shrink-0"
        style={{ width: `${splitRatio * 100}%` }}
        onFocusCapture={() => setFocusedPanel('left')}
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
        <div
          className="relative flex flex-col flex-1 min-h-0 mx-1.5 mb-1.5 mt-1 rounded-2xl border bg-[#0d1518] overflow-hidden transition-all duration-200"
          style={landingVisible
            ? focusedPanel === 'left'
              ? { borderColor: 'rgba(255,255,255,0.45)', boxShadow: '0 0 24px rgba(255,255,255,0.1), 0 0 0 1px rgba(255,255,255,0.06)' }
              : { borderColor: 'rgba(255,255,255,0.15)' }
            : activeTab === 'ai'
              ? focusedPanel === 'left'
                ? { borderColor: 'rgba(167,139,250,0.75)', boxShadow: '0 0 16px rgba(167,139,250,0.15)' }
                : { borderColor: 'rgba(167,139,250,0.4)' }
              : focusedPanel === 'left'
                ? { borderColor: 'rgba(224,190,122,0.75)', boxShadow: '0 0 16px rgba(224,190,122,0.1)' }
                : { borderColor: 'rgba(224,190,122,0.4)' }
          }
        >
          {/* 에디터 우상단 컨트롤 (난이도선택 / 뒤로가기 / 글씨크기) */}
          <div className="absolute top-2 right-3 z-10 flex flex-col items-stretch gap-1 opacity-60 hover:opacity-100 transition-opacity">
            {activeTab === 'ai' && tabContents.ai && (
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-all"
                onClick={() => setTabContents(prev => ({ ...prev, ai: '' }))}
                title="난이도 재선택"
                style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)' }}
              >
                <span className="text-[14px]" style={{ color: '#fb923c' }}>↺</span>
                <span className="text-[9px] font-bold" style={{ color: '#fb923c' }}>난이도 선택</span>
              </div>
            )}
            {activeTab === 'main' && showLanding && !landingVisible && (
              <div
                className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-all"
                onClick={() => { if (fromChapter) { onBack(); } else { setLandingSection(null); setLandingVisible(true); setFreeCodeMode(false); } }}
                title="랜딩으로 돌아가기"
                style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)' }}
              >
                <span className="text-[14px]" style={{ color: '#fb923c' }}>↺</span>
                <span className="text-[9px] font-bold" style={{ color: '#fb923c' }}>뒤로가기</span>
              </div>
            )}
            <div className="flex items-center gap-0.5">
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
          </div>

          {/* AI 코드 생성 오버레이 — Alt+2 탭이 비어있을 때 */}
          {activeTab === 'ai' && !tabContents.ai && (
            <div className="absolute inset-0 rounded-2xl z-10 flex flex-col items-center bg-[#0d1117] pt-10 pb-14">
              {/* 플로우 일러스트 + 설명 */}
              <div className="flex flex-col items-center gap-4 mt-[100px] mb-[50px]">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                    <span className="text-[22px]">💻</span>
                    <span className="text-pink-300 font-medium text-[10px]">코드노트</span>
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
                    <span className="text-[22px]">🖥️</span>
                    <span className="text-cyan-300 font-medium text-[10px]">AI 생성코드</span>
                  </div>
                </div>
                <p className="font-bold text-center leading-[2.2] tracking-wide" style={{ textShadow: '0 0 16px rgba(255,255,255,0.2)' }}>
                  <span className="text-[13px] block">
                    <span className="text-pink-300">코드노트</span>
                    <span className="text-gray-400">에서 공부한 </span>
                    <span className="text-sky-300">코드</span>
                    <span className="text-gray-400">를 분석해서</span>
                  </span>
                  <span className="text-[13px] block">
                    <span className="text-gray-400">새로 공부할 </span>
                    <span className="text-cyan-300">코드</span>
                    <span className="text-gray-400">를 </span>
                    <span className="text-amber-300">AI</span>
                    <span className="text-gray-400">가 생성해줍니다.</span>
                  </span>
                </p>
              </div>
              {/* 난이도 슬라이더 — 설명 바로 아래 */}
              <div className="flex flex-col items-center gap-1.5 w-44 mt-5">
                <span className="text-[9px] font-light text-white/60 tracking-widest uppercase mb-0.5">난이도 선택</span>
                <div className="flex items-center justify-between w-full px-0.5">
                  {['쉬움','보통','어려움'].map((label, i) => (
                    <span key={i} className={`text-[10px] font-light ${aiDifficulty === i ? ['text-sky-300','text-violet-300','text-rose-300'][i] : 'text-gray-600'}`}>{label}</span>
                  ))}
                </div>
                <input
                  type="range" min={0} max={2} step={1}
                  value={aiDifficulty}
                  onChange={e => setAiDifficulty(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: [
                      'linear-gradient(to right, rgba(125,211,252,0.7) 0%, rgba(125,211,252,0.7) 0%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%)',
                      'linear-gradient(to right, rgba(167,139,250,0.7) 0%, rgba(167,139,250,0.7) 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 100%)',
                      'linear-gradient(to right, rgba(251,113,133,0.7) 0%, rgba(251,113,133,0.7) 100%, rgba(255,255,255,0.1) 100%, rgba(255,255,255,0.1) 100%)',
                    ][aiDifficulty]
                  }}
                />
              </div>
              {/* 버튼 — 아래 공간 중앙 */}
              <div className="flex-1 flex items-center justify-center">
                <button
                  onClick={generateAiCode}
                  disabled={isGeneratingAi}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30 hover:text-violet-100 transition-all disabled:opacity-50 disabled:cursor-wait"
                  style={{ boxShadow: '0 0 16px rgba(167,139,250,0.35)' }}
                >
                  {isGeneratingAi ? (
                    <><span className="animate-spin">⟳</span> 생성 중...</>
                  ) : (
                    <>✨ AI 코드 생성</>
                  )}
                </button>
              </div>
            </div>
          )}

        {/* ─── 랜딩 패널 (코드노트 탭 / AI 생성코드 탭 스타일 통일) ─── */}
        {activeTab === 'main' && landingVisible && (
          <div className="absolute inset-0 rounded-2xl z-10 flex flex-col items-center bg-[#0d1117] pt-10 pb-14 overflow-y-auto">
            {/* 플로우 일러스트 */}
            <div className="flex flex-col items-center gap-4 mt-[60px] mb-[36px]">
              <div className="flex items-center gap-2">
                {/* 아이콘 1: GitHub */}
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border" style={{ background: '#161b22', borderColor: 'rgba(255,255,255,0.18)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span className="text-white font-medium text-[10px]">GitHub</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-gray-500">
                  <span className="text-[10px]">✨</span>
                  <span className="text-[15px]">→</span>
                  <span className="text-[10px]"> </span>
                </div>
                {/* 아이콘 2: 코드노트 */}
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <span className="text-[22px]">💻</span>
                  <span className="text-pink-300 font-medium text-[10px]">코드노트</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-gray-500">
                  <span className="text-[10px]">🚀</span>
                  <span className="text-[15px]">→</span>
                  <span className="text-[10px]"> </span>
                </div>
                {/* 아이콘 3: 학습 시작 */}
                <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                  <span className="text-[22px]">📚</span>
                  <span className="text-amber-300 font-medium text-[10px]">학습 시작</span>
                </div>
              </div>

              {/* 설명 텍스트 */}
              <div className="text-center leading-relaxed tracking-wide flex flex-col gap-0.5">
                <p className="text-[13px] text-gray-300">
                  <span className="text-white font-bold">GitHub</span>
                  <span className="text-gray-400"> 코드를 불러오거나,</span>
                </p>
                <p className="text-[13px] text-gray-400">
                  <span className="text-purple-400 font-bold">AI</span>
                  <span>가 주제를 받아 코드를 생성</span>
                </p>
                <p className="text-[13px] text-gray-400">혹은 <span className="text-yellow-300 font-bold">자유롭게</span> 코드를 입력해서</p>
                <p className="text-[13px] mt-1.5">
                  <span className="text-pink-300 font-bold">코드노트</span>
                  <span className="text-gray-400">에서 바로 학습을 시작합니다!</span>
                </p>
              </div>
            </div>

            {/* 버튼 3개 */}
            <div className="flex flex-col gap-2.5 w-full max-w-[220px]">
              {/* GitHub 불러오기 */}
              <button onClick={() => setLandingSection('github')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 hover:brightness-110"
                style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.22)', color: '#ffffff',
                  boxShadow: '0 0 14px rgba(255,255,255,0.06)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub 불러오기
              </button>

              {/* AI 키워드 코드생성 */}
              <button onClick={() => setLandingSection('keyword')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa',
                  boxShadow: '0 0 12px rgba(167,139,250,0.1)' }}>
                ✨ AI 키워드 코드생성
              </button>

              {/* 자유 코드입력 (맨 밑, 서브 스타일) */}
              <button
                onClick={() => {
                  const saved = localStorage.getItem('lucid_free_code') || '';
                  setTabContents(prev => ({ ...prev, main: saved }));
                  setFreeCodeMode(true);
                  setLandingVisible(false);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.2)', color: '#fde047' }}>
                ✏️ 자유 코드입력
              </button>
            </div>
          </div>
        )}

        {/* Monaco */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          ref={(el) => {
            if (!el) return;
            if (el._wheelBound) { el._removeWheel?.(); }
            const handler = (e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              setEditorFontSize(prev => prev + (e.deltaY < 0 ? 1 : -1));
            };
            el.addEventListener('wheel', handler, { passive: false });
            el._wheelBound = true;
            el._removeWheel = () => el.removeEventListener('wheel', handler);
          }}
        >
          <Editor
            height="100%"
            defaultLanguage="java"
            path={activeTab}
            value={tabContents[activeTab]}
            onChange={(v) => {
              const val = v ?? '';
              setTabContents(prev => ({ ...prev, [activeTab]: val }));
              if (freeCodeMode && activeTab === 'main') {
                localStorage.setItem('lucid_free_code', val);
              }
            }}
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
          {/* 노트초기화 — 자유코드 모드일 때만, 액자 내부 우하단 절대 배치 */}
          {freeCodeMode && (
            <button
              onClick={() => { setTabContents(prev => ({ ...prev, main: '' })); localStorage.removeItem('lucid_free_code'); }}
              className="absolute bottom-[15px] right-3 z-10 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <span className="text-[14px]" style={{ color: '#ef4444' }}>🗑</span>
              <span className="text-[9px] font-bold" style={{ color: '#ef4444' }}>노트초기화</span>
            </button>
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
      <div
        className="relative flex-1 min-w-0 flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg"
        onFocusCapture={() => setFocusedPanel('right')}
      >
        {/* 탭 바 */}
        <div className="free-tab-bar flex items-end shrink-0" style={{ minHeight: 42 }}>
          {RIGHT_TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveRightTab(tab.id)}
              className={`free-tab ${activeRightTab === tab.id ? 'free-tab-active' : 'free-tab-inactive'}`}
            >
              <span>{tab.label}</span>
              <span className="free-tab-shortcut">Alt + {idx + 3}</span>
            </button>
          ))}
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
        <div
          className="relative flex-1 flex flex-col min-h-0 mx-1.5 mt-1 mb-1.5 rounded-2xl border bg-[#0d1518] overflow-hidden transition-all duration-200"
          style={(() => {
            const isQuiz = activeRightTab === 'quiz';
            const isMemo = activeRightTab === 'memo';
            const focused = focusedPanel === 'right';
            if (isQuiz)  return focused ? { borderColor: 'rgba(167,139,250,0.75)', boxShadow: '0 0 16px rgba(167,139,250,0.15)' } : { borderColor: 'rgba(167,139,250,0.4)' };
            if (isMemo)  return focused ? { borderColor: 'rgba(251,146,60,0.75)',  boxShadow: '0 0 16px rgba(251,146,60,0.15)'  } : { borderColor: 'rgba(251,146,60,0.4)'  };
            return focused ? { borderColor: 'rgba(224,190,122,0.75)', boxShadow: '0 0 16px rgba(224,190,122,0.1)' } : { borderColor: 'rgba(224,190,122,0.4)' };
          })()}
        >

          {/* 💬 Lucid Tutor */}
          <div className={`flex-1 flex flex-col min-h-0 ${activeRightTab === 'tutor' ? '' : 'hidden'}`}>
              <ChatPanel
                key={chatKey}
                getCodeContext={() => {
                  if (landingVisible) return null;
                  const code = tabContents[activeTab];
                  return code?.trim() ? code : null;
                }}
                notice={landingVisible || !tabContents[activeTab]?.trim() ? true : null}
                chatScrollRef={chatScrollRef}
                placeholder="Lucid에게 물어보기"
                greeting={chatGreeting}
                systemPrompt={chatSystemPrompt || undefined}
                model={MODELS.FREESTUDY_TUTOR}
                splitRatio={splitRatio}
                onHighlightToken={highlightCodeToken}
                quickQuestions={[
                  '이 코드 뭐하는 코드야?',
                  '게임 배경을 바탕으로 비유로 설명해줘',
                ]}
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
              activeTab={activeTab}
              defaultCount={3}
              isActive={activeRightTab === 'quiz'}
            />
          </div>

          {/* 📝 메모 */}
          {activeRightTab === 'memo' && <MemoPanel />}

          {/* 문제풀기 바로가기 + ↑ 맨위로 버튼 — Lucid Tutor 탭일 때만 */}
          {activeRightTab === 'tutor' && (
            <div className="absolute bottom-[66px] right-3 z-10 flex flex-col items-end gap-1 pointer-events-auto">
              {/* ↑ 맨위로 — 2배 크기 */}
              <button
                onClick={() => chatScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center justify-center rounded font-black text-[15px] transition-all hover:-translate-y-0.5 px-2.5 py-1.5"
                style={{ background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', color: '#fde047', boxShadow: '0 0 8px rgba(253,224,71,0.1)' }}
                title="맨 위로"
              >↑</button>
              {/* 문제풀기 */}
              <button
                onClick={() => setActiveRightTab('quiz')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', boxShadow: '0 0 14px rgba(167,139,250,0.18)' }}
              >
                🎯 문제풀기
                <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold leading-none"
                  style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }}>
                  Alt+4
                </span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 타자연습 오버레이 — split 컨테이너 전체(에디터+채팅)를 덮어 폭을 최대로 확보 */}
      {isTypingPractice && (
        <TypingPractice
          code={stripComments(tabContents[activeTab])}
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

      {/* 학습 종료 확인 모달 */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 w-[300px]"
            style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 0 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06), 0 0 32px rgba(255,255,255,0.08)' }}>
            {/* 아이콘 */}
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="text-xl">⚠️</span>
            </div>
            <div className="text-center flex flex-col gap-1.5">
              <p className="text-white font-black text-[15px] tracking-tight">학습을 종료할까요?</p>
              <p className="text-gray-400 text-[12px]">작성한 내용은 저장되지 않습니다.</p>
            </div>
            <div className="flex gap-2.5 w-full mt-1">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 text-[13px] font-bold text-gray-400 hover:text-white transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
              >
                취소
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-2.5 text-[13px] font-bold text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 12, boxShadow: '0 0 16px rgba(239,68,68,0.12)', color: '#f87171' }}
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
