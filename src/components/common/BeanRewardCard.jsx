/**
 * BeanRewardCard — 원두 획득 시 표시되는 아이템 카드
 *
 * Props:
 *   isFirst  : boolean — 첫 원두 획득 여부 (확정 드랍 / 튜토리얼)
 *   beanCount: number  — 현재 보유 원두 수
 *   onClose  : () => void
 */
const BeanRewardCard = ({ isFirst = false, beanCount = 1, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm bean-card-in" onClick={onClose}>
      {/* 배경 아우라 (1겹) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div style={{
          width: 500, height: 500,
          background: 'radial-gradient(ellipse, rgba(245,158,11,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
      </div>

      <div
        className="relative w-[320px] rounded-3xl p-7 text-center bean-card-in"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,15,15,0.95) 50%, rgba(245,158,11,0.06) 100%)',
          // 카드 테두리 글로우 (2겹)
          boxShadow: '0 0 0 1px rgba(245,158,11,0.35), 0 0 32px rgba(245,158,11,0.25), 0 0 64px rgba(245,158,11,0.10), inset 0 0 32px rgba(245,158,11,0.04)',
          border: '1px solid rgba(245,158,11,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 샤인 스윕 오버레이 (4겹) */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="bean-shine absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ left: 0 }} />
        </div>

        {/* 원두 이모지 빛남 (3겹) */}
        <div className="text-6xl mb-4 bean-pulse inline-block">🫘</div>

        {isFirst ? (
          <>
            <p className="text-xs font-bold tracking-widest text-[#f59e0b]/60 uppercase mb-2">NEW ITEM</p>
            <h2 className="text-xl font-black text-white mb-1">첫 원두를 얻었어요</h2>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              퀘스트를 완료하면 확률적으로 원두가 드랍됩니다.<br />
              원두 5개를 모으면 커피 한 잔으로 교환할 수 있어요.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold tracking-widest text-[#f59e0b]/60 uppercase mb-2">REWARD DROP</p>
            <h2 className="text-xl font-black text-white mb-1">원두를 얻었어요</h2>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              퀘스트 완료 보상이 드랍됐습니다.
            </p>
          </>
        )}

        {/* 플레이버 문구 */}
        <p className="text-[11px] text-[#f59e0b]/50 italic leading-relaxed mb-5 px-2">
          "깊은 향이 감도는 원두 한 알.<br />부지런한 자에게만 허락된 보상이다."
        </p>

        {/* 현재 보유 카운터 */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={`text-lg transition-all ${i < beanCount ? 'opacity-100' : 'opacity-20'}`}>
              🫘
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mb-5">
          {beanCount}/5개 — {5 - beanCount > 0 ? `☕ 커피까지 ${5 - beanCount}개 남음` : '☕ 커피 교환 가능!'}
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold text-sm text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-[#f59e0b]/10 transition-all"
          style={{ background: 'rgba(245,158,11,0.06)' }}
        >
          확인
        </button>
      </div>
    </div>
  );
};

export default BeanRewardCard;
