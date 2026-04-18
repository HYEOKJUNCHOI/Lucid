/**
 * Lucid 공용 채팅 입력창
 * - 둥근 필 컨테이너 + 투명 input + SVG 전송 버튼
 * - Enter 전송 (한글 조합 중에는 무시)
 * - 로딩/비어있음 상태면 전송 비활성
 * - 모바일: 포커스 시 자동 스크롤 (키보드가 입력창 가리는 문제 방지)
 */
import { useRef } from 'react';

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '메시지를 입력하세요',
}) {
  const inputRef = useRef(null);
  const canSend = !disabled && !!value?.trim();

  const handleFocus = () => {
    // iOS Safari: 키보드가 올라온 뒤 살짝 딜레이 후 scrollIntoView
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl border-2 border-white/25 bg-chat-input-bg pl-4 pr-1.5 py-1 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/30 transition-all">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing
          ) {
            e.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-white text-sm py-2.5 focus:outline-none placeholder:text-gray-500 disabled:opacity-50"
      />
      <button
        onClick={() => canSend && onSubmit()}
        disabled={!canSend}
        aria-label="전송"
        className="flex items-center justify-center w-9 h-9 rounded-lg text-white/90 hover:text-amber-300 hover:bg-amber-400/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/90"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22 11 13 2 9l20-7z" />
        </svg>
      </button>
    </div>
  );
}
