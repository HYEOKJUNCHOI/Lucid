import { useEffect, useState } from 'react';

const ResultView = ({ result, onReset }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 렌더링 후 약간의 딜레이 뒤에 애니메이션 실행
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  const level = result?.level || 1;
  const score = result?.score || 0;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-transparent overflow-hidden">
      
      {/* 배경 아우라 */}
      <div className={`absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/20 rounded-full blur-[100px] mix-blend-screen transition-opacity duration-1000 ${show ? 'opacity-100' : 'opacity-0'}`} />

      {/* 결과 폭발 애니메이션 컨테이너 */}
      <div className={`relative flex flex-col items-center z-10 transition-all duration-1000 transform ${show ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-10 scale-90 opacity-0'}`}>
        
        {/* 타이틀 */}
        <h2 className="text-4xl font-black mb-12 tracking-tight text-center bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          학습 달성!
        </h2>

        {/* 클래시오브클랜 스타일 배지 (SVG) */}
        <div className="relative mb-8 group cursor-default">
          {/* 배지 뒷배경 글로우 */}
          <div className="absolute inset-0 bg-yellow-400/30 blur-2xl rounded-full scale-110 group-hover:bg-yellow-400/50 transition-all duration-500" />
          
          <svg className="w-48 h-48 sm:w-64 sm:h-64 drop-shadow-2xl z-10 relative" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 후면 프레임 */}
            <path d="M100 10L180 50V150L100 190L20 150V50L100 10Z" fill="url(#bgGrad)" stroke="url(#borderGrad)" strokeWidth="4" />
            <path d="M100 20L165 52V148L100 180L35 148V52L100 20Z" fill="#1f2937" />
            
            {/* 메인 쉴드 그라데이션 */}
            <path d="M100 25L160 55V145L100 175L40 145V55L100 25Z" fill="url(#shieldGrad)" />

            {/* 골드 별 3개 */}
            <path d="M100 35 L106 48 L121 50 L110 60 L113 74 L100 67 L87 74 L90 60 L79 50 L94 48 Z" fill="#FBBF24" />
            <path d="M65 55 L70 65 L82 67 L73 75 L76 86 L65 80 L54 86 L57 75 L48 67 L60 65 Z" fill="#D1D5DB" />
            <path d="M135 55 L140 65 L152 67 L143 75 L146 86 L135 80 L124 86 L127 75 L118 67 L130 65 Z" fill="#D1D5DB" />

            {/* 레벨 텍스트 */}
            <text x="100" y="115" fontSize="24" fontWeight="800" fill="#9CA3AF" textAnchor="middle" letterSpacing="2">LEVEL</text>
            <text x="100" y="155" fontSize="48" fontWeight="900" fill="#FCD34D" textAnchor="middle" filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.8))">{level}</text>

            <defs>
              {/* 외부 테두리 그라데이션 (골드 톤) */}
              <linearGradient id="borderGrad" x1="100" y1="10" x2="100" y2="190" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="0.5" stopColor="#D97706" />
                <stop offset="1" stopColor="#78350F" />
              </linearGradient>
              {/* 프레임 배경 */}
              <linearGradient id="bgGrad" x1="100" y1="10" x2="100" y2="190" gradientUnits="userSpaceOnUse">
                <stop stopColor="#374151" />
                <stop offset="1" stopColor="#111827" />
              </linearGradient>
              {/* 메인 쉴드 내부 */}
              <linearGradient id="shieldGrad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4B5563" />
                <stop offset="1" stopColor="#1F2937" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 세부 점수 카드 */}
        <div className="w-full max-w-sm bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl mb-10">
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-gray-400 font-medium">획득 경험치</span>
            <span className="text-2xl font-bold text-yellow-400">+{score} XP</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-400 font-medium">메타포 이해도</span>
            <span className="text-lg font-semibold text-white">우수함</span>
          </div>
        </div>

        {/* 하단 버튼 */}
        <button
          onClick={onReset}
          className="relative overflow-hidden group px-10 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl font-bold text-black shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:-translate-y-1 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
          <span className="relative z-10">새로운 학습 시작</span>
        </button>
      </div>

    </div>
  );
};

export default ResultView;
