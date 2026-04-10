import { useState } from 'react';

const RewardPanel = () => {
  const [rewardHistory] = useState([]); // v2: Firestore에서 로드

  return (
    <div className="space-y-8">
      {/* ─── 발급 이력 (v2) ──────────────── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-blue-400">📋</span> 발급 이력
        </h2>
        {rewardHistory.length === 0 ? (
          <div className="text-center py-10 rounded-xl border border-[#222] bg-[#111]">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-gray-500">아직 발급 이력이 없습니다.</p>
            <p className="text-xs text-gray-600 mt-1">v2에서 자동 발급 시스템이 추가됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rewardHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-[#222]">
                <span className="text-sm">{h.icon}</span>
                <span className="text-xs text-white font-bold">{h.name}</span>
                <span className="text-xs text-gray-500 flex-1">{h.reward}</span>
                <span className="text-[10px] text-gray-600">{h.date}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RewardPanel;
