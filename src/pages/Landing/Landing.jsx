import { useNavigate } from 'react-router-dom';

/* ── 랜딩 페이지 (옵션 A: 미니멀 1 섹션) ──────────────────────
 * 첫 방문자에게 Lucid가 무엇인지 30초 안에 전달하는 것이 목표.
 * Login.jsx와 동일한 다크 톤(One Dark) + aurora blob 배경.
 * "시작하기" CTA 클릭 → /login 이동.
 * ────────────────────────────────────────────────────────── */

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex items-center justify-center min-h-svh bg-theme-bg overflow-hidden text-gray-200">

      {/* 배경: 잔잔한 aurora blob (Login과 동일 무드, 더 절제) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 flex justify-center items-center opacity-50">
          <div className="absolute w-[700px] h-[700px] bg-theme-sidebar/50 rounded-full blur-[140px] animate-aurora -top-20 -left-20 mix-blend-screen" />
          <div className="absolute w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] animate-aurora top-20 right-0 mix-blend-screen" style={{ animationDelay: '2s' }} />
          <div className="absolute w-[500px] h-[500px] bg-theme-sidebar/50 rounded-full blur-[140px] animate-aurora -bottom-10 right-20 mix-blend-screen" style={{ animationDelay: '5s' }} />
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full px-5 md:px-8 text-center animate-fade-in-up">

        {/* 로고 마크 (Login.jsx와 동일 SVG, 더 큰 사이즈) */}
        <div className="p-4 md:p-5 bg-[#1a1a1a] rounded-2xl md:rounded-3xl mb-6 md:mb-8 border border-[#2a2a2a] shadow-[0_0_40px_rgba(78,201,176,0.2)] flex items-center justify-center">
          <svg className="w-10 h-10 md:w-12 md:h-12" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m18 16 4-4-4-4"/>
            <path d="m6 8-4 4 4 4"/>
            <path d="m14.5 4-5 16"/>
          </svg>
        </div>

        {/* 브랜드명 */}
        <h1 className="text-6xl xs:text-7xl md:text-8xl font-black tracking-tight text-white mb-4 md:mb-6 pb-2">
          Lucid
        </h1>

        {/* 핵심 카피 */}
        <p className="text-lg xs:text-xl md:text-2xl text-gray-300 font-medium mb-10 md:mb-12 leading-relaxed">
          고요한 몰입, <span className="text-[#4ec9b0] font-bold">선명한 이해</span>
        </p>

        {/* CTA 버튼 */}
        <button
          onClick={() => navigate('/login')}
          className="group relative overflow-hidden flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3.5 md:py-4 px-8 md:px-10 rounded-xl shadow-lg hover:-translate-y-0.5 hover:shadow-xl hover:shadow-white/10 transition-all duration-300 text-base md:text-lg touch-target w-full xs:w-auto"
        >
          {/* shimmer 효과 (Login 버튼과 동일) */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
          시작하기
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/>
            <path d="m12 5 7 7-7 7"/>
          </svg>
        </button>

      </div>

    </div>
  );
};

export default Landing;
