import { useEffect, useState } from 'react';
import { calcLevel, LEVEL_TABLE } from '../../services/learningService';

const TIER_CONFIG = [
  { min: 1,  label: '브론즈', emoji: '🪨', gradient: 'from-amber-900 to-amber-700', glow: 'rgba(180,83,9,0.3)', textColor: '#d97706' },
  { min: 2,  label: '실버',  emoji: '🟡', gradient: 'from-gray-400 to-gray-300', glow: 'rgba(192,192,192,0.3)', textColor: '#C0C0C0' },
  { min: 3,  label: '골드',  emoji: '🟢', gradient: 'from-yellow-500 to-yellow-400', glow: 'rgba(234,179,8,0.3)', textColor: '#EAB308' },
  { min: 5,  label: '플래티넘', emoji: '🔵', gradient: 'from-cyan-500 to-blue-500', glow: 'rgba(6,182,212,0.3)', textColor: '#06B6D4' },
  { min: 7,  label: '다이아', emoji: '💎', gradient: 'from-purple-500 to-violet-500', glow: 'rgba(139,92,246,0.3)', textColor: '#8B5CF6' },
  { min: 10, label: '마스터', emoji: '🏆', gradient: 'from-red-500 to-orange-500', glow: 'rgba(239,68,68,0.3)', textColor: '#EF4444' },
];

const getTier = (level) => {
  let tier = TIER_CONFIG[0];
  for (const t of TIER_CONFIG) {
    if (level >= t.min) tier = t;
  }
  return tier;
};

const ResultView = ({ result, onReset, userData }) => {
  const [show, setShow] = useState(false);
  const [displayXP, setDisplayXP] = useState(0);
  const [barPercent, setBarPercent] = useState(0);

  const totalXP = userData?.totalXP || 0;
  const level = calcLevel(totalXP);
  const tier = getTier(level);
  const currentLevelXP = LEVEL_TABLE.find(r => r.level === level)?.xp || 0;
  const nextLevelXP = LEVEL_TABLE.find(r => r.level === level + 1)?.xp || (currentLevelXP + 500);
  const xpInLevel = totalXP - currentLevelXP;
  const xpForNext = nextLevelXP - currentLevelXP;
  const xpPercent = Math.min((xpInLevel / xpForNext) * 100, 100);

  const earnedXP = result?.earnedXP || result?.score || 0;
  const correctCount = result?.correctCount ?? result?.level ?? 0;

  // XP 획득 전 바 위치
  const prevXpInLevel = Math.max((totalXP - earnedXP) - currentLevelXP, 0);
  const prevXpPercent = Math.min((prevXpInLevel / xpForNext) * 100, 100);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  // XP 카운터 + 바 채우기 애니메이션
  useEffect(() => {
    if (!show) return;
    if (earnedXP <= 0) {
      setDisplayXP(0);
      setBarPercent(xpPercent);
      return;
    }
    const duration = 1800;
    const startTime = Date.now();
    let raf;
    const frame = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayXP(Math.round(earnedXP * eased));
      setBarPercent(prevXpPercent + (xpPercent - prevXpPercent) * eased);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, 400);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-transparent overflow-hidden">

      {/* 배경 아우라 */}
      <div
        className={`absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] mix-blend-screen transition-opacity duration-1000 ${show ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: tier.glow }}
      />

      {/* 결과 애니메이션 컨테이너 */}
      <div className={`relative flex flex-col items-center z-10 transition-all duration-1000 transform ${show ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-10 scale-90 opacity-0'}`}>

        {/* 타이틀 */}
        <h2 className="text-4xl font-black mb-8 tracking-tight text-center bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
          학습 달성!
        </h2>

        {/* XP 획득 카운터 애니메이션 */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="text-7xl sm:text-8xl font-black tabular-nums"
            style={{
              color: '#FBBF24',
              textShadow: `0 0 40px rgba(251,191,36,0.5), 0 0 80px rgba(251,191,36,0.2)`,
            }}
          >
            +{displayXP}
          </div>
          <div className="text-xl font-bold text-yellow-400/60 tracking-widest mt-1">XP</div>
        </div>

        {/* 세부 점수 카드 */}
        <div className="w-full max-w-sm bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl mb-4">
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-gray-400 font-medium">퀴즈 정답</span>
            <span className="text-2xl font-bold" style={{ color: tier.textColor }}>{correctCount}/5</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-gray-400 font-medium">티어</span>
            <span className="text-lg font-semibold" style={{ color: tier.textColor }}>{tier.emoji}</span>
          </div>
        </div>

        {/* XP 프로그레스바 (애니메이션) */}
        <div className="w-full max-w-sm mb-10">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1 px-1">
            <span>Lv.{level}</span>
            <span>{xpInLevel}/{xpForNext} XP</span>
            <span>Lv.{level + 1}</span>
          </div>
          <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${barPercent}%`,
                background: `linear-gradient(90deg, ${tier.textColor}, ${tier.textColor}80)`,
                boxShadow: `0 0 8px ${tier.glow}`,
                transition: 'none',
              }}
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <button
          onClick={onReset}
          className="relative overflow-hidden group px-10 py-4 rounded-2xl font-bold text-black shadow-lg hover:-translate-y-1 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${tier.textColor}, ${tier.textColor}CC)`,
            boxShadow: `0 10px 30px ${tier.glow}`,
          }}
        >
          <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
          <span className="relative z-10">확인</span>
        </button>
      </div>

    </div>
  );
};

export default ResultView;
