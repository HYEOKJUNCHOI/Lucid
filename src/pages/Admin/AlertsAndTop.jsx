import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getWeeklyTop3 } from '../../services/learningService';

// 활동 상태 기준
const getActivityStatus = (lastStudiedAt) => {
  if (!lastStudiedAt) return { label: '미접속', color: '#ef4444', dot: 'bg-red-500' };
  const now = new Date();
  const last = lastStudiedAt.toDate ? lastStudiedAt.toDate() : new Date(lastStudiedAt);
  const diffDays = Math.floor((now - last) / 86400000);
  if (diffDays <= 0) return { label: '오늘 접속', color: '#4ec9b0', dot: 'bg-emerald-400' };
  if (diffDays <= 3) return { label: `${diffDays}일 전`, color: '#569cd6', dot: 'bg-blue-400' };
  if (diffDays <= 7) return { label: `${diffDays}일 전`, color: '#dcdcaa', dot: 'bg-yellow-400' };
  return { label: `${diffDays}일 미접속`, color: '#ef4444', dot: 'bg-red-500' };
};

const AlertsAndTop = () => {
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [top3, setTop3] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 이탈 위험 학생: 3일 이상 미접속
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const riskQ = query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('lastStudiedAt', '<', threeDaysAgo),
          orderBy('lastStudiedAt', 'asc'),
        );
        const riskSnap = await getDocs(riskQ);
        setAtRiskStudents(riskSnap.docs.map(d => ({ uid: d.id, ...d.data() })));

        // TOP 3
        const topData = await getWeeklyTop3();
        setTop3(topData);
      } catch (e) {
        console.warn('알림/TOP3 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const medalColors = ['#FCD34D', '#C0C0C0', '#CD7F32'];
  const medalLabels = ['🥇', '🥈', '🥉'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#4ec9b0]/30 border-t-[#4ec9b0] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── 주간 TOP 3 ───────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-yellow-400">🏆</span> 주간 TOP 3
        </h2>
        {top3.length === 0 ? (
          <p className="text-sm text-gray-500">아직 학습 데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((s, i) => (
              <div
                key={s.uid}
                className="relative overflow-hidden rounded-2xl border p-5 text-center transition-all hover:-translate-y-1"
                style={{
                  borderColor: `${medalColors[i]}40`,
                  background: `linear-gradient(135deg, ${medalColors[i]}08, ${medalColors[i]}03)`,
                }}
              >
                {/* 메달 */}
                <div className="text-4xl mb-2">{medalLabels[i]}</div>
                {/* 아바타 */}
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black border-2"
                  style={{
                    borderColor: medalColors[i],
                    background: `${medalColors[i]}15`,
                    color: medalColors[i],
                  }}
                >
                  {s.photoBase64 ? (
                    <img src={s.photoBase64} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    (s.displayName || '?')[0]
                  )}
                </div>
                <p className="text-sm font-bold text-white">{s.displayName}</p>
                <p className="text-xs text-gray-400 mt-1">Lv.{s.currentLevel} · {(s.totalXP || 0).toLocaleString()} XP</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── 이탈 위험 알림 ──────────────── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-red-400">🚨</span> 이탈 위험 학생
          <span className="text-xs font-normal text-gray-500 ml-auto">3일 이상 미접속</span>
        </h2>
        {atRiskStudents.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm">모든 학생이 활발히 학습 중입니다!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {atRiskStudents.map(s => {
              const status = getActivityStatus(s.lastStudiedAt);
              return (
                <div
                  key={s.uid}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-red-500/20 hover:border-red-500/40 transition-colors"
                >
                  {/* 상태 표시등 */}
                  <div className={`w-2.5 h-2.5 rounded-full ${status.dot} shrink-0`} />
                  {/* 아바타 */}
                  <div className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {s.photoBase64 ? (
                      <img src={s.photoBase64} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (s.displayName || '?')[0]
                    )}
                  </div>
                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.displayName || '이름 없음'}</p>
                    <p className="text-[11px] text-gray-500">{s.email}</p>
                  </div>
                  {/* 마지막 접속 */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold" style={{ color: status.color }}>{status.label}</p>
                    <p className="text-[10px] text-gray-600">Lv.{s.currentLevel || 1}</p>
                  </div>
                  {/* 알림 버튼 (v2 예정) */}
                  <button
                    className="text-[10px] px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors font-bold shrink-0"
                    title="v2에서 실제 알림 발송 예정"
                  >
                    알림 보내기
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AlertsAndTop;
