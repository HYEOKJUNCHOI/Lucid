/**
 * AttendanceCalendar — 관리자 디버그용 출석 달력
 * 날짜 클릭 → 출석 토글 (add/remove)
 */
import { useState } from 'react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function AttendanceCalendar({ attendedDates = [], onAdd, onRemove }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  const yearStr = String(year);
  const monStr = String(month + 1).padStart(2, '0');

  const attendedSet = new Set(
    attendedDates.filter(s => s.startsWith(`${yearStr}-${monStr}-`))
  );

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const remainder = cells.length % 7;
  if (remainder > 0) for (let i = 0; i < 7 - remainder; i++) cells.push(null);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const toggle = (d) => {
    const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
    if (attendedSet.has(dateStr)) onRemove(dateStr);
    else onAdd(dateStr);
  };

  const monthAttendCount = attendedDates.filter(s => s.startsWith(`${yearStr}-${monStr}-`)).length;

  return (
    <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.05) 0%, rgba(245,158,11,0.03) 100%)', border: '1px solid rgba(251,191,36,0.18)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black text-white">{year}년 {month + 1}월</span>
          <div className="flex flex-col" style={{ gap: '1px' }}>
            <button onClick={nextMonth} className="flex items-center justify-center w-3.5 h-3.5 text-gray-500 hover:text-white transition-colors" style={{ fontSize: '7px', lineHeight: 1 }}>▲</button>
            <button onClick={prevMonth} className="flex items-center justify-center w-3.5 h-3.5 text-gray-500 hover:text-white transition-colors" style={{ fontSize: '7px', lineHeight: 1 }}>▼</button>
          </div>
          <span className="text-[9px] text-[#fbbf24]/70 font-bold">{monthAttendCount}일 출석</span>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, idx) => (
          <div key={d} className="text-center text-[9px] font-bold py-0.5"
            style={{ color: idx === 0 ? 'rgba(248,113,113,0.8)' : idx === 6 ? 'rgba(96,165,250,0.8)' : 'rgba(255,255,255,0.3)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;

          const dateStr = `${yearStr}-${monStr}-${String(d).padStart(2, '0')}`;
          const attended = attendedSet.has(dateStr);
          const isToday = year === todayYear && month === todayMonth && d === todayDate;
          const col = i % 7;
          const isSun = col === 0;
          const isSat = col === 6;

          return (
            <div
              key={i}
              onClick={() => toggle(d)}
              className="aspect-square flex flex-col items-center justify-center rounded cursor-pointer text-[9px] font-bold transition-all hover:scale-105 select-none relative"
              style={
                isToday ? {
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.55), rgba(16,185,129,0.35))',
                  border: '1px solid rgba(34,197,94,0.8)',
                  color: '#4ade80',
                  boxShadow: '0 0 8px rgba(34,197,94,0.45)',
                } : attended ? {
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.55), rgba(245,158,11,0.35))',
                  border: '1px solid rgba(251,191,36,0.8)',
                  color: '#fbbf24',
                  boxShadow: '0 0 6px rgba(251,191,36,0.4)',
                } : {
                  background: isSun || isSat ? 'rgba(167,139,250,0.04)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: isSun ? 'rgba(248,113,113,0.7)' : isSat ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.45)',
                }
              }
            >
              {(isToday || attended) && (
                <span className="absolute top-0.5 right-1 text-[7px] leading-none" style={{ color: isToday ? '#4ade80' : '#fbbf24' }}>✓</span>
              )}
              {d}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-gray-600 text-center mt-2">날짜 클릭으로 출석 토글</p>
    </div>
  );
}
