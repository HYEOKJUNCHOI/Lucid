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
