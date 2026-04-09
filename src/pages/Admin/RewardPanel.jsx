import { useState, useEffect } from 'react';
import { getWeeklyTop3 } from '../../services/learningService';

const REWARD_TIERS = [
  { rank: 1, label: '1등', reward: '스타벅스 아메리카노', icon: '🥇', color: '#FCD34D', amount: '5,000원' },
  { rank: 2, label: '2등', reward: 'CU 편의점 상품권', icon: '🥈', color: '#C0C0C0', amount: '3,000원' },
  { rank: 3, label: '3등', reward: '간식 쿠폰', icon: '🥉', color: '#CD7F32', amount: '2,000원' },
];

const RewardPanel = () => {
  const [top3, setTop3] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rewardHistory, setRewardHistory] = useState([]); // v2: Firestore에서 로드

  useEffect(() => {
    getWeeklyTop3().then(data => {
      setTop3(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4ec9b0]/30 border-t-[#4ec9b0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── 이번 주 우수자 ───────────────── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-yellow-400">🎁</span> 이번 주 우수자 리워드
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REWARD_TIERS.map((tier, i) => {
            const student = top3[i];
            return (
              <div
                key={tier.rank}
                className="rounded-2xl border overflow-hidden transition-all hover:-translate-y-1"
                style={{
                  borderColor: `${tier.color}30`,
                  background: `linear-gradient(160deg, ${tier.color}06, transparent)`,
                }}
              >
                {/* 상단: 학생 정보 */}
                <div className="p-5 text-center">
                  <div className="text-3xl mb-2">{tier.icon}</div>
                  {student ? (
                    <>
                      <div
                        className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-black border-2"
                        style={{ borderColor: tier.color, color: tier.color, background: `${tier.color}10` }}
                      >
                        {student.photoBase64 ? (
                          <img src={student.photoBase64} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          (student.displayName || '?')[0]
                        )}
                      </div>
                      <p className="text-sm font-bold text-white">{student.displayName}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Lv.{student.currentLevel} · {(student.totalXP || 0).toLocaleString()} XP
                      </p>
                    </>
                  ) : (
                    <div className="py-4">
                      <p className="text-sm text-gray-600">아직 없음</p>
                    </div>
                  )}
                </div>

                {/* 하단: 리워드 정보 */}
                <div className="border-t px-4 py-3 flex items-center justify-between" style={{ borderColor: `${tier.color}15` }}>
                  <div>
                    <p className="text-xs font-bold text-gray-300">{tier.reward}</p>
                    <p className="text-[10px] text-gray-600">{tier.amount}</p>
                  </div>
                  <button
                    className="text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all border"
                    style={{
                      borderColor: `${tier.color}40`,
                      color: tier.color,
                      background: `${tier.color}10`,
                    }}
                    title="v2에서 실제 발급 예정"
                    disabled={!student}
                  >
                    {student ? '쿠폰 발급' : '대상 없음'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

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
