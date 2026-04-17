/**
 * 타자연습 배지 — 프로필 카드 우측 상단에 달리는 핀
 * 타자연습을 완주한 사람만 달림. 기록 없으면 아무것도 안 보임.
 * 호버 시 "이게 뭐야?" 설명 카드 표시 → 동기부여 유도
 */

import { useState } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';

function getTierRgb(cpm) {
  if (cpm >= 700) return '220,38,38';
  if (cpm >= 600) return '217,70,239';
  if (cpm >= 500) return '220,230,255';
  if (cpm >= 400) return '167,139,250';
  if (cpm >= 300) return '251,146,60';
  if (cpm >= 200) return '96,165,250';
  if (cpm >= 100) return '78,201,176';
  return '148,163,184';
}

function getTierName(cpm) {
  if (cpm >= 700) return '초월';
  if (cpm >= 600) return '유물';
  if (cpm >= 500) return '신화';
  if (cpm >= 400) return '전설';
  if (cpm >= 300) return '영웅';
  if (cpm >= 200) return '희귀';
  if (cpm >= 100) return '고급';
  return '일반';
}

export default function TypingBadge({ typingStats }) {
  const cpm = typingStats?.bestCpm || 0;
  // 📱 모바일 전용 탭 토글
  const isMobile = useIsMobile();
  const [showTip, setShowTip] = useState(false);

  if (!cpm) return null;

  const rgb = getTierRgb(cpm);

  return (
    <div
      className="group relative"
      onClick={isMobile ? (e) => { e.stopPropagation(); setShowTip(v => !v); } : undefined}
    >
      {/* 배지 본체 */}
      <div
        className="flex items-center gap-0.5 px-1 h-[22px] rounded cursor-default select-none"
        style={{
          background: `linear-gradient(135deg, rgba(${rgb},0.15) 0%, rgba(${rgb},0.05) 100%)`,
          border: `1px solid rgba(${rgb},0.6)`,
          boxShadow: `0 0 8px rgba(${rgb},0.25)`,
        }}
      >
        <span className="text-[11px] leading-none relative -top-[1.8px]">⌨️</span>
        <div className="flex items-baseline gap-[2px] leading-none">
          <span className="text-[11px] font-black tabular-nums" style={{ color: `rgba(${rgb},1)` }}>{cpm}</span>
          <span className="text-[9px] font-black" style={{ color: `rgba(${rgb},0.9)` }}>타</span>
        </div>
      </div>

      {/* 호버 설명 카드 */}
      <div className={`pointer-events-none absolute top-full right-0 mt-1.5 transition-opacity duration-150 z-50 ${showTip ? 'opacity-100' : 'opacity-0'} md:opacity-0 md:group-hover:opacity-100`}>
        <div className="bg-[#1a1f2e] rounded-xl px-4 py-3 shadow-2xl shadow-black/40 w-[210px]" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: `rgba(${rgb},0.35)` }}>
          {/* 헤더 */}
          <div className="text-[12px] font-black mb-2" style={{ color: `rgba(${rgb},1)` }}>⌨️ 타자 배지</div>
          {/* 티어 라벨 */}
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold tracking-wider" style={{ color: `rgba(${rgb},0.6)` }}>타자티어 :</span>
            <span className="text-[12px] font-black" style={{ color: `rgba(${rgb},1)` }}>{getTierName(cpm)}</span>
          </div>
          {/* CPM */}
          <div className="text-[18px] font-black tabular-nums leading-none mb-3" style={{ color: `rgba(${rgb},1)` }}>
            {cpm}<span className="text-[12px] font-bold ml-1" style={{ color: `rgba(${rgb},0.7)` }}>타</span>
          </div>
          {/* 설명 — 강조 단어 노란색 */}
          <div className="text-[11px] leading-relaxed" style={{ color: 'rgba(209,213,219,1)' }}>
            공부하던 <span style={{ color: '#facc15' }}>코드</span>로{' '}
            <span style={{ color: '#facc15' }}>기록</span>을 갱신하면<br />
            뱃지 <span style={{ color: '#facc15' }}>티어</span>가 바뀝니다.
          </div>
          {/* 조건 안내 */}
          <div className="text-[10px] leading-relaxed mt-1.5" style={{ color: 'rgba(107,114,128,1)' }}>
            (<span style={{ color: '#facc15' }}>10줄 이상</span>의 코드에서만<br />얻을 수 있습니다)
          </div>
        </div>
      </div>
    </div>
  );
}
