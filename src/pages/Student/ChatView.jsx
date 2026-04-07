import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import useLearningStore from '../../store/useLearningStore';

// GPT 응답 텍스트의 단일 줄바꿈(\n)을 마크다운 문단 구분(\n\n)으로 변환하는 전처리 함수
// 이유: react-markdown은 단일 \n을 공백으로 처리하는 CommonMark 스펙을 따르기 때문
const preprocessMarkdown = (text) => {
  if (!text) return '';
  // OPTIONS 태그 내부는 건드리지 않고, 나머지 부분에서만 단일 \n → \n\n 치환
  return text
    .replace(/OPTIONS_START[\s\S]*?OPTIONS_END/g, (match) => match) // OPTIONS 블록 보호
    .replace(/(?<!\n)\n(?!\n)/g, '  \n'); // 단일 \n → 마크다운 강제 줄바꿈(스페이스 2개 + \n)
};

const ChatView = ({ teacher, repo, concept, onComplete, onBack }) => {
  const {
    messages, setMessages,
    learningPhase, setLearningPhase,
    quizCount, setQuizCount,
    functionalAnalysis, setFunctionalAnalysis,
    resetSession,
  } = useLearningStore();

  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 모바일 탭: "code" | "chat"
  const [isShuffling, setIsShuffling] = useState(false); // 비유 셔플 중 로딩 상태
  const [quizOptions, setQuizOptions] = useState([]); // 현재 퀴즈 선택지 (모달용)
  
  const messagesEndRef = useRef(null);
  const chatPanelRef = useRef(null);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 키보드 연동 (1~4번 선택, Tab 포커스 트랩)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. 단축키 1~4번 처리 (퀴즈 모달이 열려 있으면 포커스 위치 무관하게 작동)
      if (learningPhase === 'quiz' && !loading && quizOptions.length > 0 && ['1', '2', '3', '4'].includes(e.key)) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= quizOptions.length) {
          e.preventDefault();
          document.activeElement?.blur();
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
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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

        // Agent 1: 🧩 기능적 해석 (실제 동작 로직)
        const prompt1 = `${codeContext}\n\n위 코드의 실행 흐름을 설명해라.

[규칙]
- "값이 어떻게 변하는지"만 설명
- 불필요한 일반 설명 금지 (프로그램 시작점 등)
- 최대 3문장
- 변수명 반드시 포함
- 결과는 '### 🧩 기능적 해석'으로 시작
`;
        const res1 = await callOpenAI([{ role: 'user', content: prompt1 }]);
        
        // 기능 분석 결과 저장 (나중에 셔플 시 사용)
        useLearningStore.getState().setFunctionalAnalysis(res1);
        
        setLearningPhase('metaphor');
        
        // Agent 2: 🌿 메타포 해석 (감각적/비유 설명)
        const prompt2 = `위 기능 설명을 기반으로 서로 다른 두 가지 메타포를 만들어라.

[구성]
1. 🎮 게임 비유
2. 🏠 일상(생활) 비유

[필수 조건]
- 코드와 1:1 대응되는 비유만 사용
- 크기 또는 구조 차이 반드시 포함
- 값 이동 과정 포함
- 손실 가능성 표현 (있다면)
- 감성/성장/자연 비유 금지

[출력 규칙]
- 각각 '### 🎮 게임 비유', '### 🏠 생활 비유'로 시작
- 핵심 개념은 **굵게 + \`백틱\` 표시
- 각 2~4문장 이내
`;

        const res2 = await callOpenAI([
          { role: 'user', content: prompt1 }, 
          { role: 'assistant', content: res1 },
          { role: 'user', content: prompt2 }
        ]);
        
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
      const promptShuffle = `다음 기능 설명을 기반으로 새로운 두 가지 메타포를 만들어라:

${funcAnalysis}

[구성]
1. 🎮 게임 비유 (이전과 다른 컨셉)
2. 🏠 생활 비유 (이전과 다른 컨셉)

[필수 조건]
- 코드와 1:1 대응
- 크기/구조 차이 포함
- 값 이동 포함
- 감성 비유 금지

[출력 규칙]
- 각각 '### 🎮 게임 비유', '### 🏠 생활 비유'로 시작
- 각 2~4문장 이내
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
    } catch (e) {
      console.error('셔플 실패:', e);
    } finally {
      setIsShuffling(false);
      setLoading(false);
    }
  };


  // concept 변경 시 채팅 세션 초기화
  useEffect(() => {
    resetSession();
    setQuizOptions([]);
  }, [concept?.path, concept?.name]);

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

      const res = await callOpenAI(apiMessages, systemPrompt);

      // OPTIONS 파싱 → 모달 state에 저장, 채팅 메시지에서는 제거
      if ((learningPhase === 'quiz' || isQuizTrigger) && res.includes('OPTIONS_START') && res.includes('OPTIONS_END')) {
        const optionsPart = res.split('OPTIONS_START')[1].split('OPTIONS_END')[0];
        const parsed = optionsPart
          .split('\n')
          .filter((l) => l.trim().match(/^[1-4][\.\)]/))
          .map((l) => l.trim().replace(/^[1-4][\.\)]\s*/, ''));
        setQuizOptions(parsed);
        // 채팅에는 OPTIONS 블록 제거된 텍스트만 저장
        const cleanRes = res.replace(/OPTIONS_START[\s\S]*?OPTIONS_END/g, '').trim();
        setMessages(prev => [...prev, { role: 'assistant', content: cleanRes }]);
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

  // 메시지 렌더러 (일반 텍스트 및 퀴즈 옵션 분리 렌더링)
  const renderMessageContent = (msg, index) => {
    if (msg.role !== 'assistant') {
      return msg.content;
    }

    // OPTIONS는 모달로 처리되므로 채팅 렌더러에서는 일반 마크다운으로만 표시

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-invert prose-base max-w-none prose-p:leading-relaxed prose-p:my-4 prose-headings:text-cyan-400 prose-li:my-1 prose-strong:text-cyan-300 prose-a:text-[#4ec9b0] prose-pre:bg-[#050505] prose-pre:border prose-pre:border-black/40 prose-code:text-[#ce9178] prose-code:bg-white/5 prose-code:px-1.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
      >
        {preprocessMarkdown(msg.content)}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto relative">

      {/* 퀴즈 선택지 모달 오버레이 */}
      {quizOptions.length > 0 && learningPhase === 'quiz' && (
        <div className="absolute inset-0 z-20 flex items-end justify-center pb-24 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-sm font-bold text-white">선택지</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-gray-600 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2a2a2a] border border-[#3a3a3a] font-mono text-[10px] text-gray-400">1</kbd>
                  <span>~</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#2a2a2a] border border-[#3a3a3a] font-mono text-[10px] text-gray-400">4</kbd>
                  <span>키보드로 선택</span>
                </span>
                <span className="text-xs text-gray-500">{quizCount} / 5</span>
              </div>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {quizOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(`${idx + 1}번`)}
                  disabled={loading}
                  className="w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[#111] hover:bg-[#1e2a2a] border border-[#2a2a2a] hover:border-cyan-500/40 transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#222] border border-[#3a3a3a] group-hover:bg-cyan-500/15 group-hover:border-cyan-500/40 flex items-center justify-center font-bold text-sm text-gray-400 group-hover:text-cyan-400 shrink-0 transition-all">
                    {idx + 1}
                  </div>
                  <span className="text-gray-200 text-sm group-hover:text-white transition-colors">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
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
      <div className="flex-1 flex gap-2 md:gap-3 overflow-hidden">
        {/* 코드 패널 */}
        <div
          className={`flex-1 flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-[#333333] shadow-lg ${
            activeTab !== 'code' ? 'hidden md:block' : ''
          }`}
        >
          {/* 상단 파일명 */}
          <div className="px-4 py-2 border-b border-[#333333] bg-[#050505] flex items-center gap-2">
            <svg className="w-4 h-4 text-[#dcdcaa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-mono text-[#dcdcaa]">{concept?.name}</span>
          </div>

          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            {codeLoading ? (
              <p className="text-gray-400 text-sm p-4">코드 불러오는 중...</p>
            ) : (
              <SyntaxHighlighter
                language="java"
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '13px' }}
                showLineNumbers={true}
              >
                {code}
              </SyntaxHighlighter>
            )}
          </div>
        </div>

        {/* 채팅 패널 */}
        <div
          ref={chatPanelRef}
          id="chat-panel-container"
          className={`flex-1 flex flex-col bg-[#1e1e1e] rounded-lg overflow-hidden border border-[#333333] shadow-lg ${
            activeTab !== 'chat' ? 'hidden md:flex' : ''
          }`}
        >
          {/* 상단 타이틀 */}
          <div className="px-4 py-2 border-b border-[#333333] bg-[#050505] flex items-center justify-between">
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
               <span className="text-xs font-bold text-gray-300">Lucid Tutor Agent</span>
            </div>
            {/* 상단 콤팩트 학습 종료 버튼 */}
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
          </div>

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
                  
                  {/* 첫 번째 AI 응답(분석/비유) 하단에 셔플 버튼 노출 */}
                  {i === 0 && msg.role === 'assistant' && learningPhase !== 'analyzing' && learningPhase !== 'metaphor' && (
                    <div className="mt-6 flex justify-end">
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
                        비유 셔플 (다른 예시 보기)
                      </button>
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
        </div>
      </div>
    </div>
  );
};

export default ChatView;
