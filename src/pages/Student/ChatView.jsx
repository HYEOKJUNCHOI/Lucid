import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Editor from '@monaco-editor/react';
import useLearningStore from '../../store/useLearningStore';
import { auth } from '../../lib/firebase';
import { getMetaphorDoc, saveOrUpdateMetaphor, voteSectionMetaphor } from '../../services/metaphorService';
import { getApiKey } from '../../lib/apiKey';

// GPT 응답 텍스트의 단일 줄바꿈(\n)을 마크다운 문단 구분(\n\n)으로 변환하는 전처리 함수
// 이유: react-markdown은 단일 \n을 공백으로 처리하는 CommonMark 스펙을 따르기 때문
const preprocessMarkdown = (text) => {
  if (!text) return '';
  // OPTIONS 태그 내부는 건드리지 않고, 나머지 부분에서만 단일 \n → \n\n 치환
  return text
    .replace(/OPTIONS_START[\s\S]*?OPTIONS_END/g, (match) => match) // OPTIONS 블록 보호
    .replace(/(?<!\n)\n(?!\n)/g, '  \n'); // 단일 \n → 마크다운 강제 줄바꿈(스페이스 2개 + \n)
};

// 파일 경로 기반 localStorage 키 (파일별 채팅 히스토리)
const chatKey = (path) => `lucid_chat_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

const ChatView = ({ teacher, repo, concept, onComplete, onBack }) => {
  const {
    messages, setMessages,
    learningPhase, setLearningPhase,
    quizCount, setQuizCount,
    functionalAnalysis, setFunctionalAnalysis,
    resetSession,
    visitedFiles,
  } = useLearningStore();

  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(true); // 기본값: 편집 모드
  const [editorFontSize, setEditorFontSize] = useState(13); // Ctrl+Wheel 줌
  const [activeTab, setActiveTab] = useState('chat'); // 모바일 탭: "code" | "chat"
  const [isShuffling, setIsShuffling] = useState(false); // 비유 셔플 중 로딩 상태
  const [quizOptions, setQuizOptions] = useState([]); // 현재 퀴즈 선택지
  const [quizQuestion, setQuizQuestion] = useState(''); // 현재 퀴즈 문제 텍스트
  const [showHint, setShowHint] = useState(false); // 기능적 해석 힌트 on/off
  const [isTypingMode, setIsTypingMode] = useState(false); // 타자연습 모드
  const [typingCode, setTypingCode] = useState(''); // 타자연습 입력 내용

  // 비유 Firebase 연동 (섹션별)
  const [metaphorDocId, setMetaphorDocId] = useState(null);
  const [usingCachedMetaphor, setUsingCachedMetaphor] = useState(false);
  // 섹션별 투표: { likes, dislikes, userVote }
  const [votes, setVotes] = useState({
    functional: { likes: 0, dislikes: 0, userVote: null },
    metaphor:   { likes: 0, dislikes: 0, userVote: null },
  });
  
  const messagesEndRef = useRef(null);
  const chatPanelRef = useRef(null);
  const quizCardRef = useRef(null);
  const isQuizFocusedRef = useRef(false); // 퀴즈 카드 포커스 여부 (stale closure 방지용 ref)
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const highlightDecorRef = useRef([]);
  const splitContainerRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(0.45); // 코드 패널 비율 (0~1)
  const isDraggingRef = useRef(false);

  // 코드 토큰 Ctrl+Click → Monaco 에디터에서 해당 위치 하이라이트
  const highlightCodeToken = (token) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !code) return;

    // 토큰에서 검색할 텍스트 정리 (괄호 제거 등)
    const searchText = token.replace(/\(\)$/, '');
    const model = editor.getModel();
    if (!model) return;

    // 코드에서 해당 텍스트 찾기
    const matches = model.findMatches(searchText, false, false, true, null, false);
    if (matches.length === 0) return;

    const match = matches[0];
    const line = match.range.startLineNumber;

    // 해당 라인으로 스크롤
    editor.revealLineInCenter(line);

    // 하이라이트 데코레이션 추가
    const newDecor = editor.deltaDecorations(highlightDecorRef.current, [
      {
        range: match.range,
        options: {
          className: 'code-token-highlight',
          isWholeLine: false,
        },
      },
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'code-line-highlight',
        },
      },
    ]);
    highlightDecorRef.current = newDecor;

    // 1.5초 후 페이드 아웃
    setTimeout(() => {
      highlightDecorRef.current = editor.deltaDecorations(highlightDecorRef.current, []);
    }, 1500);
  };

  // Ctrl 키 감지 → body 클래스 토글 (해석 패널 밑줄용)
  useEffect(() => {
    const onDown = (e) => { if (e.ctrlKey || e.metaKey) document.body.classList.add('ctrl-held'); };
    const onUp = () => document.body.classList.remove('ctrl-held');
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); window.removeEventListener('blur', onUp); document.body.classList.remove('ctrl-held'); };
  }, []);

  // 패널 스플리터 드래그
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

  // Monaco onMount: editorRef 저장 + Ctrl+Click으로 선언부 점프
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl 누르면 손가락 커서
    const editorDom = editor.getDomNode();
    editor.onKeyDown((e) => { if (e.ctrlKey || e.metaKey) editorDom?.classList.add('ctrl-held'); });
    editor.onKeyUp(() => editorDom?.classList.remove('ctrl-held'));
    editorDom?.addEventListener('mouseleave', () => editorDom?.classList.remove('ctrl-held'));

    // Ctrl+Wheel 줌
    editorDom?.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setEditorFontSize(prev => {
        const next = e.deltaY < 0 ? prev + 1 : prev - 1;
        return Math.max(10, Math.min(28, next));
      });
    }, { passive: false });

    editor.onMouseDown((e) => {
      if (!(e.event.ctrlKey || e.event.metaKey)) return;
      const position = e.target.position;
      if (!position) return;

      const model = editor.getModel();
      if (!model) return;

      const wordAtPos = model.getWordAtPosition(position);
      if (!wordAtPos) return;

      e.event.preventDefault();
      const word = wordAtPos.word;
      const currentLine = position.lineNumber;

      // 파일 전체에서 해당 단어의 모든 위치 찾기
      const matches = model.findMatches(word, false, false, true, null, false);
      if (matches.length <= 1) return; // 자기 자신뿐이면 점프 불필요

      // 첫 번째 등장(선언부)으로 점프. 이미 첫 번째에 있으면 다음 위치로
      const firstMatch = matches[0];
      const target = (firstMatch.range.startLineNumber === currentLine && matches.length > 1)
        ? matches[1] : firstMatch;

      const line = target.range.startLineNumber;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: target.range.startColumn });

      // 하이라이트
      const newDecor = editor.deltaDecorations(highlightDecorRef.current, [
        { range: target.range, options: { className: 'code-token-highlight', isWholeLine: false } },
        { range: new monaco.Range(line, 1, line, 1), options: { isWholeLine: true, className: 'code-line-highlight' } },
      ]);
      highlightDecorRef.current = newDecor;

      setTimeout(() => {
        highlightDecorRef.current = editor.deltaDecorations(highlightDecorRef.current, []);
      }, 1500);
    });
  };

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 키보드 연동 (1~4번 선택 — 퀴즈 카드에 포커스가 있을 때만 작동)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. 퀴즈 카드에 포커스가 있을 때만 1~4 키 작동 (채팅 입력 중에는 무시)
      if (learningPhase === 'quiz' && !loading && quizOptions.length > 0 && isQuizFocusedRef.current && ['1', '2', '3', '4'].includes(e.key)) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= quizOptions.length) {
          e.preventDefault();
          sendMessage(`${e.key}번`);
          return;
        }
      }

      // 2. 포커스 트랩 (Tab 키) - 채팅 패널 바깥으로 안 나가게
      if (e.key === 'Tab') {
        if (!chatPanelRef.current) return;
        const focusables = Array.from(chatPanelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabIndex="0"]'));
        if (focusables.length === 0) return;
        
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        // 포커스가 밖이면 무조건 내부 처음으로
        if (!chatPanelRef.current.contains(document.activeElement)) {
           e.preventDefault();
           first.focus();
           return;
        }

        if (e.shiftKey && document.activeElement === first) {
           e.preventDefault();
           last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
           e.preventDefault();
           first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [learningPhase, loading, messages, input]);

  // OpenAI API 호출 공통 헬퍼
  const callOpenAI = async (msgs, systemPromptOverride = null) => {
    try {
      let payloadMessages = msgs.map(m => ({ role: m.role, content: m.content }));
      
      if (systemPromptOverride) {
        payloadMessages = [{ role: 'system', content: systemPromptOverride }, ...payloadMessages];
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: payloadMessages,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || '응답을 받지 못했습니다.';
    } catch (err) {
      console.error('OpenAI API Error:', err);
      return 'API 호출 중 오류가 발생했습니다.';
    }
  };

  // Agent 1 & 2: 자동 코드 분석 및 메타포 생성
  useEffect(() => {
    const runInitialAgents = async () => {
      setLearningPhase('analyzing');
      setLoading(true);
      
      const loadingMsgId = Date.now();
      setMessages([{ id: loadingMsgId, role: 'assistant', content: '코드를 분석하고 비유를 생성 중입니다. 잠시만 기다려주세요... ⏳', isTemp: true }]);

      try {
        const codeContext = `[오늘 배운 코드]\n${code.substring(0, 3000)}`;

        // Agent 1: 🧩 기능적 해석 (항상 새로 생성)
        const prompt1 = `${codeContext}\n\n위 코드를 마이크로 단위로 해석해라.

[규칙]
- 코드의 각 핵심 라인이 무슨 일을 하는지 구체적으로 설명
- 변수명, 메서드명, 타입명을 반드시 백틱으로 감싸서 포함
- "값이 어디서 생기고, 어디로 가고, 어떻게 변하는지" 흐름을 짚어라
- 불필요한 일반 설명 금지 (프로그램 시작점, import 설명 등)
- 결과는 '### 🧩 기능적 해석'으로 시작
- 번호 매겨서 단계별로 작성 (예: 1. 2. 3.)
`;
        const res1 = await callOpenAI([{ role: 'user', content: prompt1 }]);
        useLearningStore.getState().setFunctionalAnalysis(res1);
        setLearningPhase('metaphor');

        // Agent 2: Firebase 캐시 먼저 확인 → 좋아요 있으면 재사용, 없으면 GPT 생성
        let res2;
        let docId;
        const cached = await getMetaphorDoc(repo.name, concept.path);

        const totalLikes =
          (cached?.functional?.likes || 0) +
          (cached?.metaphor?.likes || 0);

        if (cached && totalLikes >= 1) {
          // 다른 학생들이 좋아요 누른 비유 재사용
          res2 = cached.content;
          docId = cached.id;
          setUsingCachedMetaphor(true);
          const uid = auth.currentUser?.uid;
          setVotes({
            functional: { likes: cached.functional?.likes || 0, dislikes: cached.functional?.dislikes || 0, userVote: uid ? (cached.functional?.voters?.[uid] || null) : null },
            metaphor:   { likes: cached.metaphor?.likes || 0,   dislikes: cached.metaphor?.dislikes || 0,   userVote: uid ? (cached.metaphor?.voters?.[uid] || null) : null },
          });
        } else {
          // GPT로 새 비유 생성
          const prompt2 = `너는 10년차 코딩 강사이자, 비유의 천재다.
어떤 코드든 읽으면 "아, 이건 현실에서 이거랑 똑같네"가 바로 떠오르는 사람이다.
학생이 "아~!" 하고 무릎을 치게 만드는 게 너의 특기다.

위 코드와 기능 설명을 기반으로, 코드의 각 요소를 현실 세계의 무언가에 1:1로 매핑하는 메타포 설명을 만들어라.

[핵심 원칙]
- 소재는 자유롭게 골라라. 단, 코드 구조/역할과 진짜 비슷한 것으로.
- 하나의 세계관 안에서 일관되게 (전화면 끝까지 전화)
- 코드의 주요 요소(클래스, 변수, 메서드)마다 현실에서 정확히 뭐에 해당하는지 매핑해라.
- 매핑 후, 전체 흐름을 그 세계관으로 자연스럽게 설명해라.
- 코드를 다른 단어로 번역하지 마라. 진짜 비유를 해라.

[출력 형식]
- '### 🎯 메타포 설명 — 소재' 로 시작 (예: '### 🎯 메타포 설명 — 전화')
- 먼저 요소별 매핑을 나열:
  \`코드요소\` = **현실 대응물** (한 줄 설명)
  예: \`Socket\` = **전화기** (서버와 연결을 만드는 장치)
- 매핑 후, 전체 실행 흐름을 그 비유 세계관으로 3~5문장 설명
`;
          res2 = await callOpenAI([
            { role: 'user', content: prompt1 },
            { role: 'assistant', content: res1 },
            { role: 'user', content: prompt2 },
          ]);

          // Firebase에 저장 (새 비유)
          docId = await saveOrUpdateMetaphor(repo.name, concept.path, res2, res1);
          setUsingCachedMetaphor(false);
          setVotes({ functional: { likes: 0, dislikes: 0, userVote: null }, metaphor: { likes: 0, dislikes: 0, userVote: null } });
        }

        setMetaphorDocId(docId || null);
        const combinedResponse = `${res1}\n\n---\n${res2}`;
        setMessages([{ role: 'assistant', content: combinedResponse }]);
        setLearningPhase('chat');
      } catch (e) {
        console.error('초기 로드 실패:', e);
        setMessages([{ role: 'assistant', content: 'AI 분석 중 오류가 발생했습니다. 아래에서 자유롭게 질문해 보세요.' }]);
        setLearningPhase('chat');
      } finally {
        setLoading(false);
      }
    };

    if (!codeLoading && code && learningPhase === 'idle') {
      runInitialAgents();
    }
  }, [code, codeLoading, learningPhase]);

  // 비유 셔플 (기능 설명은 유지하고 비유만 다시 생성)
  const handleShuffleMetaphor = async () => {
    if (loading || isShuffling) return;
    
    const funcAnalysis = useLearningStore.getState().functionalAnalysis;
    if (!funcAnalysis) return;

    setIsShuffling(true);
    setLoading(true);

    try {
      const promptShuffle = `너는 10년차 코딩 강사이자, 비유의 천재다.
어떤 코드든 읽으면 "아, 이건 현실에서 이거랑 똑같네"가 바로 떠오르는 사람이다.

다음 기능 설명을 기반으로 이전과 완전히 다른 소재로 메타포 설명을 만들어라:

${funcAnalysis}

[핵심 원칙]
- 이전과 다른 소재를 사용해라. 단, 코드 구조/역할과 진짜 비슷한 것으로.
- 하나의 세계관 안에서 일관되게 유지
- 코드의 주요 요소마다 현실에서 정확히 뭐에 해당하는지 1:1 매핑
- 코드를 다른 단어로 번역하지 마라. 진짜 비유를 해라.

[출력 형식]
- '### 🎯 메타포 설명 — 소재' 로 시작
- 먼저 요소별 매핑을 나열:
  \`코드요소\` = **현실 대응물** (한 줄 설명)
- 매핑 후, 전체 실행 흐름을 그 비유 세계관으로 3~5문장 설명
`;

      const newMetaRes = await callOpenAI([
        { role: 'user', content: '코드를 분석해줘.' },
        { role: 'assistant', content: funcAnalysis },
        { role: 'user', content: promptShuffle }
      ]);

      const updatedResponse = `${funcAnalysis}\n\n---\n${newMetaRes}`;

      // 첫 번째 어시스턴트 메시지를 업데이트
      setMessages(prev => prev.map((m, idx) =>
        idx === 0 && m.role === 'assistant' ? { ...m, content: updatedResponse } : m
      ));

      // 셔플된 비유 Firebase 저장 + 투표 초기화
      const newDocId = await saveOrUpdateMetaphor(repo.name, concept.path, newMetaRes, funcAnalysis);
      setMetaphorDocId(newDocId);
      setUsingCachedMetaphor(false);
      setVotes({ functional: { likes: 0, dislikes: 0, userVote: null }, metaphor: { likes: 0, dislikes: 0, userVote: null } });
    } catch (e) {
      console.error('셔플 실패:', e);
    } finally {
      setIsShuffling(false);
      setLoading(false);
    }
  };


  // 퀴즈 선택지가 새로 생성되면 퀴즈 카드로 자동 포커스
  useEffect(() => {
    if (quizOptions.length > 0 && quizCardRef.current) {
      quizCardRef.current.focus();
    }
  }, [quizOptions.length]);

  // concept 변경 시 → localStorage에서 해당 파일 채팅 복원 (없으면 새 세션)
  useEffect(() => {
    if (!concept?.path) return;
    setQuizOptions([]);
    setQuizQuestion('');
    const saved = localStorage.getItem(chatKey(concept.path));
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setLearningPhase('chat');
          return;
        }
      } catch {}
    }
    // 저장된 히스토리 없음 → 새 세션 시작
    resetSession();
  }, [concept?.path]);

  // messages 변경 시 파일별 localStorage에 저장 (임시 메시지 제외)
  useEffect(() => {
    if (!concept?.path || messages.length === 0) return;
    const toSave = messages.filter(m => !m.isTemp);
    if (toSave.length === 0) return;
    try {
      localStorage.setItem(chatKey(concept.path), JSON.stringify(toSave));
    } catch {}
  }, [messages, concept?.path]);

  // GitHub에서 코드 불러오기
  useEffect(() => {
    const fetchCode = async () => {
      setCodeLoading(true);
      try {
        let url;
        if (concept.type === 'file') {
          // 직접 파일 URL로 코드 로드
          const fileRes = await fetch(concept.downloadUrl);
          setCode(await fileRes.text());
        } else if (concept.type === 'chapter') {
          // 챕터 모드: 해당 폴더의 파일 목록 → 첫 번째 파일 내용
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${concept.path}`
          );
          const files = await res.json();
          const javaFiles = files.filter((f) => f.name.endsWith('.java'));
          if (javaFiles.length > 0) {
            const fileRes = await fetch(javaFiles[0].download_url);
            setCode(await fileRes.text());
          }
        } else {
          // 날짜 모드: 해당 날짜의 커밋에서 변경된 파일 추출
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/commits?since=${concept.name}T00:00:00Z&until=${concept.name}T23:59:59Z`
          );
          const commits = await res.json();
          if (commits.length > 0) {
            const detailRes = await fetch(commits[0].url);
            const detail = await detailRes.json();
            const javaFile = detail.files?.find((f) => f.filename.endsWith('.java'));
            if (javaFile?.raw_url) {
              const fileRes = await fetch(javaFile.raw_url);
              setCode(await fileRes.text());
            }
          }
        }
      } catch (e) {
        console.error('코드 로드 실패:', e);
        setCode('// 코드를 불러오지 못했습니다.');
      } finally {
        setCodeLoading(false);
      }
    };
    fetchCode();
  }, [teacher, repo, concept]);

  // GPT에게 메시지 보내기 (자유 채팅 & 퀴즈)
  const sendMessage = async (text, isQuizTrigger = false) => {
    if ((!text.trim() && !isQuizTrigger) || loading) return;
    setQuizOptions([]); // 선택 즉시 모달 닫기

    let userContent = text;
    let isHidden = false;

    // Agent 3: 레벨 진단 퀴즈 시작 (버튼 클릭 트리거)
    if (isQuizTrigger) {
      userContent = `개념 점검 퀴즈를 시작하겠습니다.\n방금 공부한 코드의 핵심 개념에 대해 객관식 4지선다 문제(1/5)를 하나 출제해 주세요.\n(답을 바로 알려주지 마세요)`;
      isHidden = true; // 프롬프트 원문은 숨기고 시작 메시지만 보여주기 위해
      setLearningPhase('quiz');
      setQuizCount(1);
    }

    const userMsg = { role: 'user', content: userContent, hidden: isHidden };
    
    // 숨김 처리 안 될 경우 사용자 메시지로 추가, 퀴즈시작은 시스템 메시지로 알림
    let newMessages = [...messages];
    if (isQuizTrigger) {
       newMessages.push({ role: 'user', content: '💡 레벨 진단 퀴즈를 시작하겠습니다.' });
       newMessages.push(userMsg);
    } else {
       newMessages.push(userMsg);
    }

    setMessages(newMessages);
    if (!isQuizTrigger) setInput('');
    setLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      
      let systemPrompt = `너는 국비지원 개발 부트캠프 학생을 친절하게 돕는 AI 코딩 튜터 'Lucid'야.
학생이 오늘 배운 아래 코드를 참고해서 답해줘.
[배운 코드]
${code.substring(0, 3000)}

단, 정답 코드를 바로 주지 말고 학생이 직접 생각하고 깨달을 수 있도록 힌트와 비유 위주로 설명해 줘.`;

      // 퀴즈 페이즈 시스템 프롬프트 변환
      if (learningPhase === 'quiz' || isQuizTrigger) {
        systemPrompt = `너는 학생의 레벨을 진단하는 'Lucid 퀴즈 마스터'야.
아래 코드를 바탕으로 객관식 4지선다 퀴즈를 출제하고 채점해 줘.
[배운 코드]
${code.substring(0, 3000)}

지금까지 출제한 문제 수: ${isQuizTrigger ? 1 : quizCount} / 5

[규칙]
1. 학생이 답을 말하면, 정답인지 아닌지 판단하고 친절한 해설을 1~2문장으로 제공해 줘.
2. 아직 5번 문제가 아니라면 해설 뒤에 다음 문제(예: 2/5)를 이어서 객관식 4지선다로 출제해 줘.
3. 객관식 선택지를 제공할 때는 반드시 "OPTIONS_START" 와 "OPTIONS_END" 태그 사이에 1부터 4까지 순서대로 작성해야 해. 
예시:
OPTIONS_START
1. 첫번째 옵션
2. 두번째 옵션
3. 세번째 옵션
4. 네번째 옵션
OPTIONS_END
4. 5번 문제의 해설까지 끝냈다면, 마지막에 반드시 "모든 퀴즈가 완료되었습니다. 💡" 라는 문장을 포함해 줘.`;
      }

      let res = await callOpenAI(apiMessages, systemPrompt);

      // 퀴즈 페이즈인데 OPTIONS 태그가 없으면 → 자동 1회 재시도
      if ((learningPhase === 'quiz' || isQuizTrigger) && !res.includes('OPTIONS_START') && !res.includes('완료되었습니다')) {
        const retryMessages = [
          ...apiMessages,
          { role: 'assistant', content: res },
          { role: 'user', content: '위 문제의 선택지를 반드시 OPTIONS_START ~ OPTIONS_END 블록 안에 1~4번 형식으로 포함해서 문제 전체를 다시 출력해줘.' },
        ];
        res = await callOpenAI(retryMessages, systemPrompt);
      }

      // OPTIONS 파싱 → 퀴즈 카드 state에 저장, 채팅 메시지에서는 제거
      if ((learningPhase === 'quiz' || isQuizTrigger) && res.includes('OPTIONS_START') && res.includes('OPTIONS_END')) {
        const optionsPart = res.split('OPTIONS_START')[1].split('OPTIONS_END')[0];
        const parsed = optionsPart
          .split('\n')
          .filter((l) => l.trim().match(/^[1-4][\.\)]/))
          .map((l) => l.trim().replace(/^[1-4][\.\)]\s*/, ''));
        setQuizOptions(parsed);
        setShowHint(false);

        const cleanRes = res.replace(/OPTIONS_START[\s\S]*?OPTIONS_END/g, '').trim();

        // 피드백(정답/오답 해설)과 새 문제 분리
        // GPT가 "정답입니다! [해설]\n\n퀴즈 N/5\n[문제]" 형태로 응답하기 때문
        const quizHeaderMatch = cleanRes.match(/퀴즈\s*\d+\s*[\/\-]\s*5/);
        if (quizHeaderMatch) {
          const splitIdx = cleanRes.indexOf(quizHeaderMatch[0]);
          const feedback = cleanRes.substring(0, splitIdx).trim();
          const question = cleanRes.substring(splitIdx).trim();

          // 정답/오답 해설은 채팅에 표시 (사용자가 볼 수 있도록)
          if (feedback) {
            setMessages(prev => [...prev, { role: 'assistant', content: feedback }]);
          }
          // 새 문제는 카드에만 표시
          setQuizQuestion(question);
          setMessages(prev => [...prev, { role: 'assistant', content: question, hidden: true }]);
        } else {
          // 첫 문제 (피드백 없음) → 전체가 문제
          setQuizQuestion(cleanRes);
          setMessages(prev => [...prev, { role: 'assistant', content: cleanRes, hidden: true }]);
        }
      } else {
        setQuizOptions([]);
        setMessages(prev => [...prev, { role: 'assistant', content: res }]);
      }

      // 퀴즈 카운트 및 종료 상태 파싱 (OPTIONS는 위에서 이미 처리됨)
      if (learningPhase === 'quiz' || isQuizTrigger) {
        if (res.includes("완료되었습니다")) {
          setLearningPhase('completed');
        } else if (res.includes("2/5") && quizCount < 2) setQuizCount(2);
        else if (res.includes("3/5") && quizCount < 3) setQuizCount(3);
        else if (res.includes("4/5") && quizCount < 4) setQuizCount(4);
        else if (res.includes("5/5") && quizCount < 5) setQuizCount(5);
      }

    } catch (e) {
      console.error('GPT 호출 실패:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: '응답 중 오류가 발생했습니다.' }]);
    } finally {
      setLoading(false);
    }
  };

  // 섹션별 투표 핸들러 (optimistic update — UI 즉시 반영, Firebase는 백그라운드)
  const handleSectionVote = (section, vote) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // 즉시 UI 토글 (Firebase 결과 기다리지 않음)
    setVotes(prev => {
      const s = prev[section];
      const newVote = s.userVote === vote ? null : vote; // 같은 버튼 → 취소
      return {
        ...prev,
        [section]: {
          likes:    s.likes    + (newVote === 'liked' ? 1 : s.userVote === 'liked' ? -1 : 0),
          dislikes: s.dislikes + (newVote === 'disliked' ? 1 : s.userVote === 'disliked' ? -1 : 0),
          userVote: newVote,
        },
      };
    });

    // Firebase 백그라운드 저장 (실패해도 UI는 유지)
    (async () => {
      let docId = metaphorDocId;
      if (!docId) {
        const currentContent = messages[0]?.content || '';
        const funcAnalysis = useLearningStore.getState().functionalAnalysis || '';
        docId = await saveOrUpdateMetaphor(repo.name, concept.path, currentContent, funcAnalysis);
        if (docId) setMetaphorDocId(docId);
      }
      if (docId) await voteSectionMetaphor(repo.name, concept.path, uid, section, vote);
    })();
  };

  // 섹션 피드백 버튼 (👍 도움됐다 / 👎 도움 안 됐다)
  const SectionVoteBar = ({ section }) => {
    const s = votes[section];
    const [poppingUp, setPoppingUp]   = useState(false);
    const [poppingDown, setPoppingDown] = useState(false);

    const pop = (which) => {
      if (which === 'liked')    { setPoppingUp(true);   setTimeout(() => setPoppingUp(false),   400); }
      else                      { setPoppingDown(true); setTimeout(() => setPoppingDown(false), 400); }
    };

    const handleVote = (vote, e) => {
      e.stopPropagation();
      e.preventDefault();
      pop(vote);
      handleSectionVote(section, vote);
    };

    const voted = s.userVote !== null;

    return (
      // 투표된 상태면 항상 보이고, 아니면 hover 시에만 보임
      <div
        className={`flex items-center justify-end gap-2 mt-1.5 transition-opacity duration-200 ${voted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => handleVote('liked', e)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border select-none ${poppingUp ? 'scale-110' : 'scale-100'}`}
          style={{
            transition: 'transform 0.15s ease, background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
            backgroundColor: s.userVote === 'liked' ? '#10b981' : 'rgba(255,255,255,0.05)',
            color:           s.userVote === 'liked' ? '#fff'    : '#9ca3af',
            borderColor:     s.userVote === 'liked' ? '#10b981' : 'rgba(255,255,255,0.1)',
            boxShadow:       s.userVote === 'liked' ? '0 0 12px rgba(16,185,129,0.45)' : 'none',
            fontWeight:      s.userVote === 'liked' ? 700 : 400,
          }}
        >
          👍 도움됐어요{s.likes > 0 ? ` · ${s.likes}` : ''}
        </button>
        <button
          onClick={(e) => handleVote('disliked', e)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border select-none ${poppingDown ? 'scale-110' : 'scale-100'}`}
          style={{
            transition: 'transform 0.15s ease, background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
            backgroundColor: s.userVote === 'disliked' ? '#ef4444' : 'rgba(255,255,255,0.05)',
            color:           s.userVote === 'disliked' ? '#fff'    : '#9ca3af',
            borderColor:     s.userVote === 'disliked' ? '#ef4444' : 'rgba(255,255,255,0.1)',
            boxShadow:       s.userVote === 'disliked' ? '0 0 12px rgba(239,68,68,0.45)' : 'none',
            fontWeight:      s.userVote === 'disliked' ? 700 : 400,
          }}
        >
          👎 별로예요{s.dislikes > 0 ? ` · ${s.dislikes}` : ''}
        </button>
      </div>
    );
  };

  // 메시지 렌더러 (일반 텍스트 및 퀴즈 옵션 분리 렌더링)
  const renderMessageContent = (msg, index) => {
    if (msg.role !== 'assistant') {
      return msg.content;
    }

    const proseBase = "prose prose-invert prose-base max-w-none prose-p:leading-relaxed prose-p:my-4 prose-li:my-1 prose-a:text-[#4ec9b0] prose-pre:bg-[#050505] prose-pre:border prose-pre:border-black/40 prose-code:text-[#ce9178] prose-code:bg-white/5 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none";

    // 제목 공통 컴포넌트 (흰색 + 굵게 + 크게)
    const headingComponents = {
      h1: ({ children }) => <h1 className="text-white font-extrabold text-2xl mt-6 mb-3">{children}</h1>,
      h2: ({ children }) => <h2 className="text-white font-extrabold text-xl mt-5 mb-2">{children}</h2>,
      h3: ({ children }) => <h3 className="text-white font-extrabold text-lg mt-5 mb-2">{children}</h3>,
    };

    const content = msg.content;
    const metaMarker = '### 🎯 메타포 설명';
    const metaIdx = content.indexOf(metaMarker);

    // 기능적 해석 + 메타포 설명 2분할 렌더링
    if (metaIdx !== -1) {
      const analysisPart = preprocessMarkdown(content.substring(0, metaIdx))
        .replace(/(?<!`)\b(\d+(?:\.\d+)?)\b(?!`)/g, '`$1`');
      const metaphorPart = preprocessMarkdown(content.substring(metaIdx))
        .replace(/(?<!`)\b(\d+(?:\.\d+)?)\b(?!`)/g, '`$1`');

      const analysisCode = "prose prose-invert prose-base max-w-none prose-p:leading-relaxed prose-p:my-4 prose-li:my-1 prose-code:bg-white/5 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none";

      return (
        <>
          {/* 🧩 기능적 해석 */}
          <div className="group relative rounded-xl border border-white/[0.06] hover:border-sky-500/30 bg-white/[0.02] hover:bg-sky-500/5 px-3 py-2 -mx-3 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(56,189,248,0.08)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className={analysisCode}
              components={{ ...headingComponents,
                code: ({ children }) => {
                  const txt = String(children).trim();
                  if (/^\d+(?:\.\d+)?$/.test(txt)) {
                    return <code style={{ color: '#fbbf24', fontWeight: 'bold' }}>{children}</code>;
                  }
                  return (
                    <code
                      className="code-token-clickable"
                      style={{ color: '#9cdcfe' }}
                      onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); highlightCodeToken(txt); } }}
                    >{children}</code>
                  );
                },
                strong: ({ children }) => <span className="text-sky-300 font-medium">{children}</span> }}
            >{analysisPart}</ReactMarkdown>
            <SectionVoteBar section="functional" />
          </div>

          {/* 🎯 메타포 설명 */}
          <div className="group relative rounded-xl border border-white/[0.06] hover:border-emerald-500/30 bg-white/[0.02] hover:bg-emerald-500/5 px-3 py-2 -mx-3 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className={proseBase}
              components={{ ...headingComponents,
                code: ({ children }) => {
                  const txt = String(children).trim();
                  if (/^\d+(?:\.\d+)?$/.test(txt)) {
                    return <code style={{ color: '#fbbf24', fontWeight: 'bold' }}>{children}</code>;
                  }
                  return (
                    <code
                      className="code-token-clickable"
                      style={{ color: '#ce9178' }}
                      onClick={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); highlightCodeToken(txt); } }}
                    >{children}</code>
                  );
                },
                strong: ({ children }) => <span className="text-emerald-400 font-medium">{children}</span> }}
            >{metaphorPart}</ReactMarkdown>
            <SectionVoteBar section="metaphor" />
          </div>
        </>
      );
    }

    // 그 외 일반 메시지
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} className={proseBase}
        components={{ ...headingComponents, strong: ({ children }) => <span className="text-emerald-400 font-medium">{children}</span> }}
      >
        {preprocessMarkdown(content)}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto">

      {/* 모바일 탭 전환 */}
      <div className="flex gap-2 md:hidden mb-4">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'code'
              ? 'bg-cyan-400 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          코드
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'chat'
              ? 'bg-cyan-400 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          채팅
        </button>
      </div>

      {/* PC: 2단 레이아웃 / 모바일: 탭 */}
      <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
        {/* 코드 패널 */}
        <div
          style={{ width: `${splitRatio * 100}%` }}
          className={`flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-[#333333] shadow-lg shrink-0 ${
            activeTab !== 'code' ? 'hidden md:flex' : ''
          }`}
        >
          {/* 상단 파일명 + 편집/미리보기 토글 */}
          <div className="px-4 py-2 border-b border-[#333333] bg-[#050505] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#dcdcaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-mono text-[#dcdcaa]">{concept?.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (!isTypingMode) {
                    // 타자연습 시작: package + import 줄만 미리 채움
                    const lines = code.split('\n');
                    const prefill = lines.filter(l => /^\s*(package |import )/.test(l)).join('\n');
                    setTypingCode(prefill ? prefill + '\n\n' : '');
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
                <span>⌨️</span>
                {isTypingMode ? '타자연습 중' : '타자연습'}
              </button>
              <button
                onClick={() => setIsEditMode(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold transition-all text-gray-400 hover:text-white"
              >
                {isEditMode ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    읽기 전용
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    편집
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {codeLoading ? (
              <p className="text-gray-400 text-sm p-4">코드 불러오는 중...</p>
            ) : (
              <Editor
                height="100%"
                language="java"
                value={code}
                onChange={(val) => setCode(val ?? '')}
                theme="vs-dark"
                onMount={handleEditorMount}
                options={{
                  readOnly: !isEditMode,
                  fontSize: editorFontSize,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: isEditMode ? 'line' : 'none',
                  cursorStyle: isEditMode ? 'line' : 'block',
                  tabSize: 4,
                  padding: { top: 12, bottom: 12 },
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                }}
              />
            )}
          </div>
        </div>

        {/* 스플리터 (드래그 핸들) */}
        <div
          onMouseDown={handleSplitMouseDown}
          className="hidden md:flex w-1.5 cursor-col-resize items-center justify-center group hover:bg-cyan-500/20 transition-colors rounded-full mx-0.5 shrink-0"
        >
          <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-cyan-400 rounded-full transition-colors" />
        </div>

        {/* 채팅 패널 */}
        <div
          ref={chatPanelRef}
          id="chat-panel-container"
          className={`flex-1 min-w-0 flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-[#333333] shadow-lg ${
            activeTab !== 'chat' ? 'hidden md:flex' : ''
          }`}
        >
          {/* 상단 타이틀 */}
          <div className="px-4 py-2 border-b border-[#333333] bg-[#050505] flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isTypingMode ? (
                <>
                  <span className="text-sm">⌨️</span>
                  <span className="text-xs font-bold text-[#a78bfa]">타자연습</span>
                  <span className="text-[10px] text-gray-600 ml-1">왼쪽 코드를 보고 직접 타이핑하세요</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-gray-300">Lucid Tutor Agent</span>
                </>
              )}
            </div>
            {isTypingMode ? (
              <button
                onClick={() => setIsTypingMode(false)}
                className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-[#111111] border border-[#333333] text-gray-400 hover:text-gray-200 hover:bg-[#222222] transition-all"
              >
                채팅으로 돌아가기
              </button>
            ) : (
              <button
                onClick={() => onComplete({ level: quizCount, score: 0 })}
                className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1 ${
                  learningPhase === 'completed'
                    ? 'bg-cyan-400 text-black hover:bg-cyan-300 shadow-[0_0_10px_rgba(78,201,176,0.4)] animate-pulse-glow'
                    : 'bg-[#111111] border border-[#333333] text-gray-400 hover:text-gray-200 hover:bg-[#222222]'
                }`}
              >
                {learningPhase === 'completed' ? '레벨 확인하기 ✨' : '학습 종료 ✕'}
              </button>
            )}
          </div>

          {/* 타자연습 모드 */}
          {isTypingMode ? (
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language="java"
                value={typingCode}
                onChange={(val) => setTypingCode(val ?? '')}
                theme="vs-dark"
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'line',
                  cursorStyle: 'line',
                  tabSize: 4,
                  padding: { top: 12, bottom: 12 },
                  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  parameterHints: { enabled: false },
                  wordBasedSuggestions: 'off',
                  acceptSuggestionOnEnter: 'off',
                }}
              />
            </div>
          ) : (
          <>
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-auto p-10 flex flex-col gap-10 bg-[#1e1e1e]">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-8">
                코드에 대해 질문해보세요
              </p>
            )}
            {messages
              .filter((msg) => !msg.hidden) // API 호출용 숨김 메시지 제외
              .map((msg, i) => (
              <div
                key={i}
                className={`w-full ${
                  msg.role === 'user'
                    ? 'flex flex-col items-end'
                    : 'flex flex-col items-start'
                }`}
              >
                <div
                  className={`max-w-[95%] transition-all ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/10 text-cyan-100 px-6 py-4 rounded-2xl border border-cyan-500/20 shadow-sm'
                      : 'bg-transparent text-gray-200 py-2 border-none shadow-none w-full'
                  }`}
                >
                  {/* 사용자일 경우만 '나' 표시 (선택사항) */}
                  {msg.role === 'user' && (
                    <div className="text-[10px] uppercase tracking-widest text-cyan-400/80 mb-2 font-bold opacity-60">You</div>
                  )}
                  {renderMessageContent(msg, i)}
                  
                  {/* 첫 번째 AI 응답 하단 셔플 버튼 */}
                  {i === 0 && msg.role === 'assistant' && learningPhase !== 'analyzing' && learningPhase !== 'metaphor' && (
                    <div className="mt-4 flex items-center justify-between">
                      {usingCachedMetaphor && (
                        <span className="text-[10px] text-gray-600">👥 다른 학생들이 좋아한 비유</span>
                      )}
                      <div className="ml-auto">
                        <button
                          onClick={handleShuffleMetaphor}
                          disabled={loading || isShuffling}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all disabled:opacity-50"
                        >
                          {isShuffling ? (
                            <div className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          메타포 셔플
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && !messages.some(m => m.isTemp) && (
              <div className="bg-[#111111] border border-[#333333] text-gray-400 self-start text-sm px-5 py-4 rounded-xl animate-pulse w-fit shadow-sm">
                <span className="flex items-center gap-2">
                   <div className="flex space-x-1">
                     <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                     <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                     <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                   </div>
                   입력하는 중...
                </span>
              </div>
            )}
            {/* 스크롤 포인터 */}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 + 퀴즈 버튼 */}
          <div className="border-t border-[#333333] p-2 md:p-3 flex flex-col gap-2 bg-[#050505]">

            {/* 퀴즈 통합 카드 - 문제 + 힌트 토글 + 선택지 */}
            {quizOptions.length > 0 && learningPhase === 'quiz' && (
              <div
                ref={quizCardRef}
                tabIndex={0}
                onFocus={() => { isQuizFocusedRef.current = true; }}
                onBlur={() => { isQuizFocusedRef.current = false; }}
                className="flex flex-col rounded-xl border border-[#2a2a2a] bg-[#111] overflow-hidden focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              >
                {/* 카드 헤더: 진행도 + 힌트 토글 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#0a0a0a]">
                  <span className="text-[10px] text-gray-500 font-bold tracking-widest">QUIZ {quizCount} / 5</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">카드 클릭 후 키보드 1~4 선택 가능</span>
                    <button
                      onClick={() => setShowHint(v => !v)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                        showHint
                          ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400'
                          : 'bg-white/5 border-white/10 text-gray-500 hover:text-yellow-400 hover:border-yellow-500/30'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      기능적 해석 힌트
                    </button>
                  </div>
                </div>

                {/* 힌트 영역 (토글) */}
                {showHint && functionalAnalysis && (
                  <div className="px-3 py-2 border-b border-[#222] bg-yellow-500/5 text-yellow-300/80 text-xs leading-relaxed">
                    {functionalAnalysis.replace(/^###\s*🧩\s*기능적\s*해석\s*/i, '').trim()}
                  </div>
                )}

                {/* 문제 텍스트 */}
                {quizQuestion && (
                  <div className="px-3 py-2.5 border-b border-[#222] text-gray-200 text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-code:text-[#ce9178] prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
                      components={{ strong: ({ children }) => <span className="text-violet-400 font-medium">{children}</span> }}
                    >
                      {preprocessMarkdown(quizQuestion)}
                    </ReactMarkdown>
                  </div>
                )}

                {/* 선택지 목록 */}
                <div className="flex flex-col gap-1 p-2">
                  {quizOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1a1a1a] hover:bg-[#1a2a2a] border border-[#2a2a2a] hover:border-cyan-500/40 transition-all group"
                    >
                      {/* 번호 뱃지 - 클릭 시 선택 */}
                      <button
                        onClick={() => sendMessage(`${idx + 1}번`)}
                        disabled={loading}
                        className="w-5 h-5 rounded-md bg-[#111] border border-[#3a3a3a] group-hover:bg-cyan-500/15 group-hover:border-cyan-500/40 flex items-center justify-center font-bold text-xs text-gray-500 group-hover:text-cyan-400 shrink-0 transition-all"
                      >
                        {idx + 1}
                      </button>

                      {/* 힌트 OFF: 일반 텍스트 버튼 */}
                      {!showHint && (
                        <button
                          onClick={() => sendMessage(`${idx + 1}번`)}
                          disabled={loading}
                          className="flex-1 text-left text-gray-300 text-sm group-hover:text-white transition-colors"
                        >
                          {opt}
                        </button>
                      )}

                      {/* 힌트 ON: 스포일러 박스 (드래그해서 긁으면 보임) */}
                      {showHint && (
                        <span
                          className="flex-1 text-sm px-2 py-0.5 rounded select-text cursor-text"
                          style={{
                            color: '#1a1a1a',          /* 배경과 동일한 색 → 안 보임 */
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            userSelect: 'text',
                          }}
                          title="드래그해서 힌트 확인"
                        >
                          {opt}
                        </span>
                      )}
                    </div>
                  ))}
                  {showHint && (
                    <p className="text-center text-[10px] text-gray-600 mt-1">드래그로 긁으면 힌트가 보여요</p>
                  )}
                </div>
              </div>
            )}

            {/* 퀴즈 시작 버튼은 일반 채팅 모드일 때만 노출 */}
            {learningPhase === 'chat' && (
              <div className="flex justify-end">
                <button
                  onClick={() => sendMessage('', true)}
                  disabled={loading}
                  tabIndex="0"
                  className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-bold px-4 py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  레벨 진단 퀴즈 시작
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    sendMessage(input);
                  }
                }}
                disabled={loading || learningPhase === 'idle' || learningPhase === 'analyzing' || learningPhase === 'metaphor' || learningPhase === 'completed'}
                placeholder={
                  learningPhase === 'analyzing' || learningPhase === 'metaphor' ? "AI가 분석 중입니다..." : 
                  learningPhase === 'completed' ? "학습이 완료되었습니다. 결과 화면으로 이동해주세요." : 
                  "질문이나 정답을 입력하세요... (퀴즈시 1,2,3,4 키보드 입력 가능)"
                }
                tabIndex="0"
                className="flex-1 bg-[#111111] text-white text-sm rounded-lg px-3 py-2 md:py-3 focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-[#333333] focus:border-cyan-500 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => sendMessage(input)}
                tabIndex="0"
                disabled={!input.trim() || loading || learningPhase === 'idle' || learningPhase === 'analyzing' || learningPhase === 'metaphor' || learningPhase === 'completed'}
                className="bg-cyan-500 text-black text-sm font-bold px-4 py-2 md:px-5 md:py-3 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                전송
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;
