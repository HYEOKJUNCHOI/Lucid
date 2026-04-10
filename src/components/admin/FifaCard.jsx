// 마지막 접속 기준 활성도
export const getActivityTier = (lastStudiedAt) => {
  if (!lastStudiedAt) return { label: '미접속', color: '#ef4444' };
  const days = (Date.now() - (lastStudiedAt?.toDate ? lastStudiedAt.toDate().getTime() : new Date(lastStudiedAt).getTime())) / 86400000;
  if (days < 1)  return { label: '오늘',     color: '#4ec9b0' };
  if (days < 3)  return { label: '3일 이내', color: '#569cd6' };
  if (days < 7)  return { label: '7일 이내', color: '#dcdcaa' };
  return         { label: '이탈 위험',       color: '#ef4444' };
};

export const getTierBadge = (level) => {
  if (level >= 10) return { label: '마스터',  color: '#f59e0b' };
  if (level >= 7)  return { label: '다이아',  color: '#569cd6' };
  if (level >= 5)  return { label: '플래티넘', color: '#4ec9b0' };
  if (level >= 3)  return { label: '골드',    color: '#dcdcaa' };
  if (level >= 2)  return { label: '실버',    color: '#aaaaaa' };
  return                  { label: '브론즈',  color: '#ce9178' };
};

// RPG 아이템 등급: 전공=Unique(주황금), 경험자=Rare(파랑), 입문=Normal(흰색)
export const getCardTheme = (studentType) => {
  if (studentType === 'major') return {
    border: '#c77b14',
    inner: 'linear-gradient(160deg, #1a0e00 0%, #2a1800 100%)',
    shine: '#f59e0b',
    label: '★ 전공',
    typeColor: '#fde68a',
    typeBg: 'rgba(197,120,20,0.25)',
  };
  if (studentType === 'experienced') return {
    border: '#2563eb',
    inner: 'linear-gradient(160deg, #050d1a 0%, #0a1830 100%)',
    shine: '#60a5fa',
    label: '⚡ 경험자',
    typeColor: '#bfdbfe',
    typeBg: 'rgba(37,99,235,0.25)',
  };
  return {
    border: '#9ca3af',
    inner: 'linear-gradient(160deg, #111111 0%, #1c1c1c 100%)',
    shine: '#e5e7eb',
    label: '일반',
    typeColor: '#f3f4f6',
    typeBg: 'rgba(156,163,175,0.15)',
  };
};

import { useRef, useState, useEffect } from 'react';

const FifaCard = ({ student, onClick, isActive, draggable, onDragStart, onDragEnd, onDragOver, onDrop, faded, onPhotoUpload, onPhotoDelete, minimal, compact }) => {
  const fileInputRef   = useRef();
  const [photoEdit, setPhotoEdit] = useState(false);

  useEffect(() => {
    if (!photoEdit) return;
    const close = () => setPhotoEdit(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [photoEdit]);
  const level       = student.level != null ? student.level : 1;
  const activity    = getActivityTier(student.lastStudiedAt);
  const theme       = getCardTheme(student.studentType);
  const streak      = student.streak || 0;
  const dailyXP     = student.dailyXP || 0;
  const weeklyQuest = student.weeklyQuestClear || student.weeklyRoutineClear || 0;
  const initials    = (student.displayName || '?')[0].toUpperCase();
  const outerProps = {
    className: `relative cursor-default transition-all duration-200 select-none print-card ${onClick ? `hover:-translate-y-1 ${compact ? 'hover:scale-[1.25]' : 'hover:scale-[1.03]'} cursor-grab active:cursor-grabbing` : 'hover:-translate-y-1 hover:scale-[1.02]'} ${isActive ? 'ring-2 ring-white/40' : ''} ${faded ? 'opacity-40 scale-95' : ''}`,
    style: { width: '120px', padding: '1.5px', borderRadius: '12px', background: theme.border, boxShadow: '0 2px 12px rgba(0,0,0,0.5)' },
    onClick, draggable, onDragStart, onDragEnd, onDragOver, onDrop,
  };

  // ── 간소 카드 (자리배치 모드용: h-full 채우기, 이름 크게, 스탯 없음) ─
  if (minimal) {
    return (
      <div {...outerProps} style={{ ...outerProps.style, height: '100%' }}>
        <div className="overflow-hidden flex flex-col h-full" style={{ background: theme.inner, borderRadius: '11px' }}>
          {/* 뱃지(왼쪽위) + 레벨(오른쪽) */}
          <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
              style={{ background: theme.typeBg, color: theme.typeColor, border: `1px solid ${theme.shine}40` }}>
              {theme.label}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <div className={`w-2 h-2 rounded-full ${activity.label === '오늘' ? 'animate-pulse' : ''}`}
                style={{ background: activity.color }} />
              <span className="text-[14px] font-black leading-none" style={{ color: theme.shine }}>Lv.{level}</span>
            </div>
          </div>
          {/* 아바타: 남은 공간 꽉 채우기 */}
          <div className="flex-1 flex items-center justify-center py-1">
            <div className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ width: '68px', height: '68px', border: `2px solid ${theme.shine}60`, boxShadow: `0 0 12px ${theme.shine}30`, background: `radial-gradient(circle, ${theme.shine}15, rgba(0,0,0,0.3))` }}>
              {student.photoBase64
                ? <img src={student.photoBase64} alt="" className="w-full h-full object-cover object-top" />
                : <span className="text-2xl font-black" style={{ color: theme.shine }}>{initials}</span>}
            </div>
          </div>
          {/* 이름 중앙 */}
          <div className="px-2.5 pb-2 flex items-center justify-center">
            <span className="text-[15px] font-black text-white/95 tracking-wide leading-tight text-center truncate w-full">
              {(student.displayName || '이름 없음').toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div {...outerProps}>
      <div className="overflow-hidden flex flex-col" style={{ background: theme.inner, borderRadius: '11px' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
            style={{ background: theme.typeBg, color: theme.typeColor, border: `1px solid ${theme.shine}40` }}>
            {theme.label}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <div className={`w-2 h-2 rounded-full ${activity.label === '오늘' ? 'animate-pulse' : ''}`}
              style={{ background: activity.color }} />
            <span className="text-[11px] font-black leading-none" style={{ color: theme.shine }}>
              Lv.{level}
            </span>
          </div>
        </div>

        {/* 아바타 */}
        <div className="flex items-center justify-center py-1">
          {onPhotoUpload ? (
            <div
              className="relative cursor-pointer"
              onDoubleClick={e => {
                e.stopPropagation();
                if (student.photoBase64) { setPhotoEdit(p => !p); }
                else { fileInputRef.current?.click(); }
              }}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { onPhotoUpload(e.target.files[0]); setPhotoEdit(false); }} />
              <div className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
                style={{ width: '52px', height: '52px', border: `2px solid ${theme.shine}60`, boxShadow: `0 0 10px ${theme.shine}30`, background: `radial-gradient(circle, ${theme.shine}15, rgba(0,0,0,0.3))` }}>
                {student.photoBase64
                  ? <img src={student.photoBase64} alt="" className="w-full h-full object-cover object-top" />
                  : <span className="text-lg font-black" style={{ color: theme.shine }}>{initials}</span>}
              </div>
              {/* 더블클릭 시 + / ✕ 배지 */}
              {photoEdit && (
                <>
                  {/* 서쪽아래 — 사진 추가/변경 */}
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); setPhotoEdit(false); }}
                    className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[#4ec9b0] text-black text-[10px] font-black flex items-center justify-center z-20 leading-none shadow-lg"
                    title="사진 변경"
                  >+</button>
                  {/* 동쪽아래 — 사진 삭제 */}
                  {onPhotoDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); onPhotoDelete(); setPhotoEdit(false); }}
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-white text-[8px] font-black flex items-center justify-center z-20 leading-none shadow-lg"
                      title="사진 삭제"
                    >✕</button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ width: '52px', height: '52px', border: `2px solid ${theme.shine}60`, boxShadow: `0 0 10px ${theme.shine}30`, background: `radial-gradient(circle, ${theme.shine}15, rgba(0,0,0,0.3))` }}>
              {student.photoBase64
                ? <img src={student.photoBase64} alt="" className="w-full h-full object-cover object-top" />
                : <span className="text-lg font-black" style={{ color: theme.shine }}>{initials}</span>}
            </div>
          )}
        </div>

        {/* 하단 패널 */}
        <div className="px-2 pt-0.5 pb-2">
          <div className="flex items-center justify-center mb-1">
            <span className="text-[13px] font-black text-white/95 tracking-wide leading-tight text-center truncate w-full">
              {(student.displayName || '이름 없음').toUpperCase()}
            </span>
          </div>
          {!compact && (
            <>
              <div className="flex items-center gap-0.5 mb-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex-1 h-[3px] rounded-full"
                    style={{ background: i <= weeklyQuest ? theme.shine : `${theme.shine}20` }} />
                ))}
              </div>
              <div className="h-px mb-1"
                style={{ background: `linear-gradient(to right, transparent, ${theme.shine}50, transparent)` }} />
              <div className="grid grid-cols-3 gap-1 text-center">
                {[
                  { val: streak,             label: '연속' },
                  { val: dailyXP,            label: 'XP' },
                  { val: `${weeklyQuest}/5`, label: '퀘스트' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div className="text-[10px] font-black leading-none" style={{ color: theme.shine }}>{val}</div>
                    <div className="text-[6px] font-bold text-white/35 tracking-widest mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FifaCard;
