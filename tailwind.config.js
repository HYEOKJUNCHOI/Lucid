import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#0e1512',       // Dark Forest
          sidebar: '#121a16',  // Forest Sidebar
          card: '#172019',     // Forest Card
          border: '#1f2e25',   // Forest Border
          primary: '#4ec9b0',  // Teal accent
          secondary: '#7a9e8e',// Muted teal-gray
          icon: '#5bb89a',     // Soft teal
        },
        chat: {
          user: '#ffd966',          // 유저 말풍선 배경 (노랑)
          'user-border': '#e6b800', // 유저 말풍선 테두리
          assistant: '#1a2227',     // 어시스턴트 말풍선 배경 (다크)
          'input-bg': '#14161a',    // 입력창 배경
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'confetti-fall': {
          '0%':   { transform: 'translate3d(0, -20px, 0) rotate(0deg)',    opacity: '1' },
          '80%':  { opacity: '1' },
          '100%': { transform: 'translate3d(var(--cf-x, 0), 110vh, 0) rotate(var(--cf-rot, 720deg))', opacity: '0' },
        },
        'new-record-pop': {
          '0%':   { transform: 'scale(0.3) rotate(-8deg)', opacity: '0' },
          '50%':  { transform: 'scale(1.15) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)',    opacity: '1' },
        },
        'shimmer-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(251,191,36,0.25), 0 0 0 1px rgba(251,191,36,0.35)' },
          '50%':      { boxShadow: '0 0 28px rgba(251,191,36,0.6),  0 0 0 1px rgba(251,191,36,0.8)' },
        },
        'led-sweep': {
          '0%':   { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '-5% 50%' },
        },
        // 은은한 섬광 글리치: 대부분 완전 숨김, 85~87% 2% 구간만 살짝 ±1px 한 번
        'glitch-flash-red': {
          '0%, 85%':   { opacity: '0', transform: 'translate(0, 0)' },
          '86%':       { opacity: '0.1', transform: 'translate(-1px, 0)' },
          '87%, 100%': { opacity: '0', transform: 'translate(0, 0)' },
        },
        'glitch-flash-cyan': {
          '0%, 85%':   { opacity: '0', transform: 'translate(0, 0)' },
          '86%':       { opacity: '0.1', transform: 'translate(1px, 0)' },
          '87%, 100%': { opacity: '0', transform: 'translate(0, 0)' },
        },
        // 글자 탁탁 등장
        'char-pop': {
          '0%':   { opacity: '0', transform: 'translateY(6px) scale(0.6)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // 신기록 글자 팡팡 (크게 터지고 안착)
        'char-bang': {
          '0%':   { opacity: '0', transform: 'scale(3.5)', filter: 'blur(6px)' },
          '55%':  { opacity: '1', transform: 'scale(0.88)', filter: 'blur(0px)' },
          '75%':  { transform: 'scale(1.1)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0px)' },
        },
        // 1박 — 완주/입문자/클럽원
        'ring-breathe-1': {
          '0%, 100%': { opacity: '0.65' },
          '50%':      { opacity: '1.0' },
        },
        // 2박 — 실력자/상위권/고수
        'ring-breathe': {
          '0%, 100%': { opacity: '0.65' },
          '25%':      { opacity: '1.0' },
          '50%':      { opacity: '0.65' },
          '75%':      { opacity: '1.0' },
        },
        // 3박 — 프로/전설
        'ring-breathe-3': {
          '0%, 100%': { opacity: '0.65' },
          '17%':      { opacity: '1.0' },
          '33%':      { opacity: '0.65' },
          '50%':      { opacity: '1.0' },
          '67%':      { opacity: '0.65' },
          '83%':      { opacity: '1.0' },
        },
      },
      animation: {
        'confetti-fall':    'confetti-fall 2.8s ease-out forwards',
        'new-record-pop':   'new-record-pop 0.6s ease-out forwards',
        'shimmer-glow':     'shimmer-glow 1.8s ease-in-out infinite',
        'led-sweep':        'led-sweep 0.7s linear infinite',
        'glitch-flash-red': 'glitch-flash-red 1.3s step-end infinite',
        'glitch-flash-cyan':'glitch-flash-cyan 1.3s step-end infinite',
        'char-pop':         'char-pop 0.14s ease-out forwards',
        'char-bang':        'char-bang 0.45s cubic-bezier(0.2,0.8,0.3,1) forwards',
        'ring-breathe-1':   'ring-breathe-1 4s ease-in-out infinite',
        'ring-breathe':     'ring-breathe 2.4s ease-in-out infinite',
        'ring-breathe-3':   'ring-breathe-3 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    typography,
  ],
}
