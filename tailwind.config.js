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
          bg: '#050505',       // IDE Deep Dark
          sidebar: '#111111',  // IDE Sidebar Dark
          card: '#1e1e1e',     // IDE Editor Dark
          border: '#333333',   // IDE Border
          primary: '#4ec9b0',  // VSCode Cyan (클래스/강조색)
          secondary: '#858585',// VSCode Comment/Muted
          icon: '#569cd6',     // VSCode Blue (메서드/포인트색)
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    typography,
  ],
}
