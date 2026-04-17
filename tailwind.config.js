import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // mobile:  <768 (prefix 없음 - 기본)
        // tablet:  768~1023 (md:)
        // desktop: >=1024 (lg:)
        'xs': '375px', // iPhone SE 가드
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        'tab-h': '56px',      // 모바일 하단 탭 높이
        'topbar-h': '48px',   // 모바일 상단바 높이 (compact)
        'appbar-h': '56px',   // 모바일 AppBar 기본 높이
        'appbar-large-h': '96px', // 모바일 AppBar largeTitle 모드 (scrollAware 축소 전)
      },
      // ─── 네이티브 앱 리디자인 토큰 (2026-04) ───
      borderRadius: {
        // 디자인 시스템 — 기존 Tailwind 기본 rounded-* 는 그대로 두고, semantic 토큰만 추가
        'card':  '12px',
        'sheet': '20px',
        'pill':  '999px',
      },
      boxShadow: {
        // elevation 0 (flat) / 1 (subtle) / 2 (card) / 3 (sheet)
        'e0': 'none',
        'e1': '0 1px 2px rgba(0,0,0,0.25)',
        'e2': '0 4px 12px rgba(0,0,0,0.32)',
        'e3': '0 12px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
      },
      transitionTimingFunction: {
        // Material 3 motion tokens
        'standard':     'cubic-bezier(0.2, 0, 0, 1)',
        'emphasized':   'cubic-bezier(0.3, 0, 0, 1)',
        'decelerate':   'cubic-bezier(0, 0, 0, 1)',
        'accelerate':   'cubic-bezier(0.3, 0, 1, 1)',
        'spring':       'cubic-bezier(0.2, 0.8, 0.3, 1)',
      },
      transitionDuration: {
        'instant': '0ms',
        'fast':    '150ms',
        'base':    '250ms',
        'slow':    '400ms',
        'page':    '350ms', // stack push/pop
        'sheet':   '320ms', // bottom sheet / action sheet
      },
      zIndex: {
        // 모바일 레이어 순서
        'tab':     '40',
        'appbar':  '45',
        'drawer':  '50',
        'sheet':   '60',
        'overlay': '70',
        'toast':   '80',
      },
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
        // iOS 홈화면 편집모드 jiggle (±1deg 미세 회전)
        'ios-jiggle': {
          '0%':   { transform: 'rotate(-1deg) translate(-0.5px, -0.5px)' },
          '50%':  { transform: 'rotate(1deg) translate(0.5px, 0.5px)' },
          '100%': { transform: 'rotate(-1deg) translate(-0.5px, -0.5px)' },
        },
        // iOS jiggle 변형 (살짝 다른 위상으로 자연스러움 증가)
        'ios-jiggle-alt': {
          '0%':   { transform: 'rotate(1deg) translate(0.5px, -0.5px)' },
          '50%':  { transform: 'rotate(-1deg) translate(-0.5px, 0.5px)' },
          '100%': { transform: 'rotate(1deg) translate(0.5px, -0.5px)' },
        },
        // iOS 길게누름 시 살짝 커지는 피드백
        'ios-press-in': {
          '0%':   { transform: 'scale(1)' },
          '100%': { transform: 'scale(0.95)' },
        },
        // 스택 네비게이션 푸시/팝
        'stack-push-in': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'stack-push-out': {
          '0%':   { transform: 'translateX(0)',      opacity: '1' },
          '100%': { transform: 'translateX(-30%)',   opacity: '0.6' },
        },
        'stack-pop-in': {
          '0%':   { transform: 'translateX(-30%)',   opacity: '0.6' },
          '100%': { transform: 'translateX(0)',      opacity: '1' },
        },
        'stack-pop-out': {
          '0%':   { transform: 'translateX(0)',      opacity: '1' },
          '100%': { transform: 'translateX(100%)',   opacity: '0' },
        },
        // 바텀 시트
        'sheet-in': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'sheet-out': {
          '0%':   { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        // 백드롭 페이드
        'backdrop-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'backdrop-out': {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        // 탭 전환 (매우 빠른 크로스페이드)
        'tab-fade': {
          '0%':   { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // 탭바 아이콘 활성 스프링
        'tab-spring': {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.18)' },
          '70%':  { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
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
        'ios-jiggle':       'ios-jiggle 0.3s ease-in-out infinite',
        'ios-jiggle-alt':   'ios-jiggle-alt 0.31s ease-in-out infinite', // 0.31로 약간 엇박
        'ios-press-in':     'ios-press-in 0.2s ease-out forwards',
        'stack-push-in':    'stack-push-in 350ms cubic-bezier(0.2, 0, 0, 1) forwards',
        'stack-push-out':   'stack-push-out 350ms cubic-bezier(0.2, 0, 0, 1) forwards',
        'stack-pop-in':     'stack-pop-in 350ms cubic-bezier(0.2, 0, 0, 1) forwards',
        'stack-pop-out':    'stack-pop-out 350ms cubic-bezier(0.2, 0, 0, 1) forwards',
        'sheet-in':         'sheet-in 320ms cubic-bezier(0.3, 0, 0, 1) forwards',
        'sheet-out':        'sheet-out 250ms cubic-bezier(0.3, 0, 1, 1) forwards',
        'backdrop-in':      'backdrop-in 250ms ease-out forwards',
        'backdrop-out':     'backdrop-out 200ms ease-in forwards',
        'tab-fade':         'tab-fade 150ms ease-out forwards',
        'tab-spring':       'tab-spring 320ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
      },
    },
  },
  plugins: [
    typography,
  ],
}
