/**
 * Lucid 공용 채팅 말풍선
 * - 유저: 노란 #ffd966 / 어시스턴트: 다크 #1a2227
 * - role 에 따라 좌/우 정렬 + 꼬리 방향 자동
 * - children 으로 내용 받음 (ReactMarkdown, 텍스트, 카드 등 자유롭게 래핑 가능)
 */
export default function ChatBubble({ role, children, className = '' }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 leading-relaxed ${
          isUser
            ? 'bg-chat-user text-gray-900 rounded-br-sm border-2 border-chat-user-border/60'
            : 'bg-chat-assistant text-gray-100 rounded-bl-sm border border-white/10'
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
