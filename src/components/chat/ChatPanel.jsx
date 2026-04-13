import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { getApiKey, getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, OPENAI_CHAT_URL, GEMINI_CHAT_URL, DEFAULTS } from '../../lib/aiConfig';
import { lucidTutorSystemPrompt } from '../../lib/prompts';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

// ─── 토큰 색상 (QuestionText와 동일한 규칙) ──────────────
const JAVA_KW = new Set([
  'private','public','protected','static','final','abstract','synchronized',
  'void','int','long','double','float','boolean','char','byte','short',
  'class','interface','extends','implements','new','return','this','super',
  'if','else','for','while','do','switch','case','break','continue','default',
  'try','catch','finally','throw','throws','null','true','false','instanceof',
  'import','package','enum','var','String','ArrayList','HashMap','List','Map','Set',
]);
const getTokenColor = (token) => {
  const base = token.replace(/\(\)$/, '').trim();
  if (token.endsWith('()'))    return '#dcdcaa';
  if (JAVA_KW.has(base))       return '#569cd6';
  if (/^[A-Z]/.test(base))     return '#4ec9b0';
  return '#9cdcfe';
};

// 텍스트 안의 `token` · 'token' 패턴을 찾아 색상 코드 span으로 변환
const processTokens = (text, onHighlightToken, keyPrefix = '') => {
  const regex = /`([^`\n]+)`|'([^'\n]{1,40})'/g;
  const parts = [];
  let last = 0, m, k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[1] ?? m[2];
    const color = getTokenColor(token);
    parts.push(
      <code
        key={`${keyPrefix}-${k++}`}
        className="text-[0.9em] bg-white/[0.08] px-1 py-0.5 rounded font-mono"
        style={{ color, cursor: onHighlightToken ? 'pointer' : undefined }}
        title={onHighlightToken ? '클릭으로 코드에서 찾기' : undefined}
        onClick={() => { if (onHighlightToken) onHighlightToken(token); }}
      >{token}</code>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

// ReactMarkdown children 중 string만 processTokens 적용
const applyTokens = (children, onHighlightToken, keyPrefix = '') =>
  Array.isArray(children)
    ? children.flatMap((child, i) =>
        typeof child === 'string'
          ? processTokens(child, onHighlightToken, `${keyPrefix}-${i}`)
          : [child]
      )
    : typeof children === 'string'
      ? processTokens(children, onHighlightToken, keyPrefix)
      : children;

/**
 * Lucid 공용 채팅 패널
 * - FreeStudy / QuestView / ChatView 공통 스타일
 * - 말풍선: 유저(노란 #ffd966) · 어시스턴트(다크 #1a2227)
 * - 입력창: 라운드 컨테이너 + 전송 버튼
 * - Ctrl + 휠 글씨 크기 조절 (10~24)
 * - 코드 컨텍스트 prop (getCodeContext) 지원 — 있으면 system 프롬프트 앞에 포함
 *
 * Props
 *  - systemPrompt: string                      — 기본 튜터 프롬프트
 *  - getCodeContext?: () => string             — 현재 에디터 코드를 리턴하는 함수 (선택)
 *  - greeting?: string                         — 최초 어시스턴트 메시지
 *  - placeholder?: string                      — 입력창 플레이스홀더
 *  - className?: string                        — 래퍼 추가 클래스
 *  - model?: string                            — OpenAI 모델명 (기본 MODELS.CHAT)
 *  - temperature?: number                      — 기본 DEFAULTS.temperature
 */
export default function ChatPanel({
  systemPrompt,
  getCodeContext,
  greeting = '코드에 대해 뭐든 물어보세요',
  placeholder = 'Lucid에게 물어보기',
  className = '',
  model = MODELS.CHAT,
  temperature = DEFAULTS.temperature,
  splitRatio = 0.5,
  onHighlightToken,
  quickQuestion,
  quickQuestions,
  onGoToQuiz,
  notice = null,
  chatScrollRef = null,
  fontSize: fontSizeProp = null,
  onFontSizeChange = null,
}) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatFontSizeInternal, setChatFontSizeInternal] = useState(13);
  // prop이 있으면 외부 값 사용, 없으면 내부 상태 사용
  const chatFontSize = fontSizeProp ?? chatFontSizeInternal;
  const setChatFontSize = (updater) => {
    const next = typeof updater === 'function' ? updater(chatFontSize) : updater;
    if (onFontSizeChange) onFontSizeChange(next);
    else setChatFontSizeInternal(next);
  };
  const [favoriteGame, setFavoriteGame] = useState('');

  const chatAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fontSizeControlRef = useRef(null);

  // 새 메시지 들어오면 하단 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const adjustFontSize = (delta) =>
    setChatFontSize((prev) => Math.max(10, Math.min(24, prev + delta)));

  // Ctrl+휠 (채팅 전체) 또는 그냥 휠 (크기 컨트롤 위) → 글자 크기 조절
  useEffect(() => {
    const handler = (e) => {
      const area = chatAreaRef.current;
      const ctrl = fontSizeControlRef.current;
      const onCtrl = ctrl?.contains(e.target);
      const onChat = area?.contains(e.target);
      if (!onCtrl && !onChat) return;
      if (!onCtrl && !(e.ctrlKey || e.metaKey)) return; // 채팅 전체는 Ctrl 필요
      e.preventDefault();
      adjustFontSize(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  const sendMessage = async (directText) => {
    const text = (directText ?? input).trim();
    if (!text || chatLoading) return;
    // 코드 없을 때 질문 시 경고 메시지
    if (notice && getCodeContext?.() === null) {
      setMessages(prev => [...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: '← 코드를 생성 또는 입력 후 질문해주세요' },
      ]);
      setInput('');
      return;
    }
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setChatLoading(true);
    try {
      const code = getCodeContext?.() || '';
      const finalSystemPrompt = systemPrompt
        ? [
            systemPrompt,
            code ? `[현재 에디터 코드]\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\`` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : lucidTutorSystemPrompt(code, chatFontSize, splitRatio);

      const isGemini = model.startsWith('gemini-');
      let reply;

      if (isGemini) {
        // Gemini: contents 첫 메시지는 반드시 user여야 함 → 첫 user 메시지부터 포함
        const allMsgs = [...messages, userMsg];
        const firstUserIdx = allMsgs.findIndex((m) => m.role === 'user');
        const geminiMessages = allMsgs.slice(firstUserIdx).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
        const res = await fetch(
          `${GEMINI_CHAT_URL(model)}?key=${getGeminiApiKey()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: finalSystemPrompt }] },
              contents: geminiMessages,
              generationConfig: { temperature },
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          reply = `[Gemini 오류 ${res.status}] ${data.error?.message || JSON.stringify(data)}`;
        } else {
          reply =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            '응답을 받지 못했습니다.';
        }
      } else {
        const res = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: finalSystemPrompt },
              ...messages,
              userMsg,
            ],
            temperature,
          }),
        });
        const data = await res.json();
        reply =
          data.choices?.[0]?.message?.content?.trim() ||
          '응답을 받지 못했습니다.';
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'API 호출 중 오류가 발생했습니다.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // 퀵 질문 데이터 (항상 표시용)
  const rawQs = quickQuestions ?? (quickQuestion ? [quickQuestion] : []);

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>

      {/* ── 상단 고정: 퀵 질문 바로가기 ── */}
      {rawQs.length > 0 && (
        <div className="shrink-0 px-3 pt-2 pb-1.5 flex flex-col gap-1.5 border-b border-white/[0.05]">
          {rawQs.map((rawQ, qi) => {
            const isGameBtn = rawQ.includes('비유로 설명해줘');
            const fullQ = isGameBtn && favoriteGame.trim()
              ? `${favoriteGame} 배경과 세계관을 바탕으로 비유로 설명해줘`
              : rawQ;
            return (
              <div key={qi} className="flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 overflow-hidden">
                {isGameBtn && (
                  <input
                    type="text"
                    value={favoriteGame}
                    onChange={e => setFavoriteGame(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && favoriteGame.trim() && sendMessage(fullQ)}
                    placeholder="좋아하는 게임 입력"
                    className="text-[10px] px-2.5 py-1 bg-transparent border-r border-amber-500/20 text-white placeholder-white/40 outline-none w-[7.5rem] shrink-0"
                  />
                )}
                <button
                  onClick={() => sendMessage(fullQ)}
                  className="flex-1 text-[10px] px-2.5 py-1 text-amber-400 hover:bg-amber-500/20 hover:text-amber-200 transition-all text-left"
                >
                  💬 {isGameBtn ? `${favoriteGame ? favoriteGame + ' ' : ''}배경과 세계관을 바탕으로 비유로 설명해줘` : rawQ}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 채팅 영역 */}
      <div className="relative flex-1 min-h-0">
        {/* 글씨 크기 조절 */}
        <div ref={fontSizeControlRef} className="absolute top-2 right-3 z-10 flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <button
            onClick={() => adjustFontSize(-1)}
            className="w-7 h-7 flex items-center justify-center rounded text-[13px] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >−</button>
          <span className="text-[11px] text-gray-500 w-6 text-center">{chatFontSize}</span>
          <button
            onClick={() => adjustFontSize(1)}
            className="w-7 h-7 flex items-center justify-center rounded text-[13px] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >+</button>
        </div>
        <div
          ref={el => { chatAreaRef.current = el; if (chatScrollRef) chatScrollRef.current = el; }}
          className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3 chat-readable"
          style={{ fontSize: `${chatFontSize}px` }}
        >
          {messages.map((msg, i) => (
            <div key={i}>
              {i === 0 ? (
                <div className="flex justify-center mb-1">
                  <span className="text-[11px] text-white/70 font-medium px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08]">
                    {msg.content}
                  </span>
                </div>
              ) : (
                <ChatBubble role={msg.role}>
                  <div
                    className={msg.role === 'assistant'
                      ? 'prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-hr:my-2 prose-pre:bg-black/30'
                      : ''}
                    style={msg.role === 'assistant' ? { fontSize: 'inherit' } : undefined}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={msg.role === 'assistant' ? {
                        // p, li 텍스트 → regex로 직접 파싱 (백틱 문자 제거 + 색상)
                        p({ children }) { return <p>{applyTokens(children, onHighlightToken, `p${i}`)}</p>; },
                        li({ children }) { return <li>{applyTokens(children, onHighlightToken, `li${i}`)}</li>; },
                        // 블록 코드 그대로, 인라인 코드도 같은 색상 처리
                        code({ inline, className, children }) {
                          if (className?.startsWith('language-') || inline === false) {
                            return <code className={className}>{children}</code>;
                          }
                          const text = String(children).trim().replace(/^`+|`+$/g, '');
                          const color = getTokenColor(text);
                          return (
                            <code
                              className="text-[0.9em] bg-white/[0.08] px-1 py-0.5 rounded font-mono"
                              style={{ color, cursor: onHighlightToken ? 'pointer' : undefined }}
                              title={onHighlightToken ? '클릭으로 코드에서 찾기' : undefined}
                              onClick={() => { if (onHighlightToken) onHighlightToken(text); }}
                            >{text}</code>
                          );
                        },
                      } : undefined}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </ChatBubble>
              )}
              {/* AI가 퀴즈탭 안내 시 바로가기 버튼 */}
              {msg.role === 'assistant' && onGoToQuiz && msg.content.includes('문제풀기 탭') && (
                <div className="flex justify-start pl-1 mt-1">
                  <button
                    onClick={onGoToQuiz}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-100 transition-all"
                  >🎯 문제풀기로 가기</button>
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <span className="text-gray-500 animate-pulse">답변 생성 중...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력창 (공용 ChatInput) */}
      <div className="px-1.5 pb-1.5 pt-1 shrink-0">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          disabled={chatLoading}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
