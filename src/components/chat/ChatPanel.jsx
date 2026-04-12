import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { getApiKey, getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, OPENAI_CHAT_URL, GEMINI_CHAT_URL, DEFAULTS } from '../../lib/aiConfig';
import { lucidTutorSystemPrompt } from '../../lib/prompts';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';

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
  onGoToQuiz,
}) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatFontSize, setChatFontSize] = useState(() => {
    const saved = localStorage.getItem('lucid_chat_font_size');
    return saved ? Number(saved) : 11;
  });

  const chatAreaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 새 메시지 들어오면 하단 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 글자 크기 변경 → localStorage 저장
  useEffect(() => {
    localStorage.setItem('lucid_chat_font_size', chatFontSize);
  }, [chatFontSize]);

  const adjustFontSize = (delta) =>
    setChatFontSize((prev) => Math.max(10, Math.min(24, prev + delta)));

  // Ctrl + 휠 → 글자 크기 조절
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const area = chatAreaRef.current;
      if (!area || !area.contains(e.target)) return;
      e.preventDefault();
      adjustFontSize(e.deltaY < 0 ? 1 : -1);
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, []);

  const sendMessage = async (directText) => {
    const text = (directText ?? input).trim();
    if (!text || chatLoading) return;
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

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {/* 채팅 영역 */}
      <div className="relative flex-1 min-h-0">
        {/* 글씨 크기 조절 버튼 */}
        <div className="absolute top-2 right-3 z-10 flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity">
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
        ref={chatAreaRef}
        className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3 chat-readable"
        style={{ fontSize: `${chatFontSize}px` }}
      >
        {messages.map((msg, i) => (
          <div key={i}>
          <ChatBubble role={msg.role}>
            <div
              className={msg.role === 'assistant'
                ? 'prose prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-hr:my-2 prose-code:text-[#9cdcfe] prose-code:bg-white/10 prose-code:px-1 prose-code:rounded prose-pre:bg-black/30'
                : ''}
              style={msg.role === 'assistant' ? { fontSize: 'inherit' } : undefined}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={msg.role === 'assistant' && onHighlightToken ? {
                  code({ inline, children }) {
                    const text = String(children).trim();
                    if (inline) {
                      return (
                        <code
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              e.preventDefault();
                              onHighlightToken(text);
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Ctrl+클릭으로 코드에서 찾기"
                        >
                          {children}
                        </code>
                      );
                    }
                    return <code>{children}</code>;
                  },
                } : undefined}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </ChatBubble>
          {/* AI가 퀴즈탭 안내 시 바로가기 버튼 */}
          {msg.role === 'assistant' && onGoToQuiz && msg.content.includes('문제풀기 탭') && (
            <div className="flex justify-start pl-1 mt-1">
              <button
                onClick={onGoToQuiz}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-violet-100 transition-all"
              >🎯 문제풀기로 가기</button>
            </div>
          )}
          {/* 그리팅 바로 아래 공식질문 버튼 */}
          {i === 0 && quickQuestion && messages.length === 1 && (
            <div className="flex justify-start pl-1 mt-1">
              <button
                onClick={() => sendMessage(quickQuestion)}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200 transition-all"
              >
                💬 {quickQuestion}
              </button>
            </div>
          )}
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <span className="text-gray-500 animate-pulse">
                답변 생성 중...
              </span>
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
