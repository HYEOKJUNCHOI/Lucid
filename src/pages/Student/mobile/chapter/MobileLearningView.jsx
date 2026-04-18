import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/cn';
import useLearningStore from '@/store/useLearningStore';
import ChatView from '@/pages/Student/ChatView';
import { getGithubFileCache, saveGithubFileCache } from '@/services/learningService';
import { useStudentContext } from '@/pages/Student/mobile/MobileStudentPage';

// ─── 코드 peek 훅 ─────────────────────────────────────────────────────────
/**
 * useCodePeek — 홀드 투 피크(hold-to-peek) 로직.
 *
 * - 버튼 누르는 동안만 오버레이 표시 (기획: "잠시 참고하는 느낌")
 * - 손가락 드래그로 코드 스크롤 1:1 추적
 * - 손가락 떼는 순간 닫힘
 */
function useCodePeek() {
  const [peeking, setPeeking] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const startYRef        = useRef(0);
  const startScrollRef   = useRef(0);
  const scrollTopRef     = useRef(0);
  const codeContainerRef = useRef(null);

  const getY = (e) => {
    if (e.touches?.[0])        return e.touches[0].clientY;
    if (e.changedTouches?.[0]) return e.changedTouches[0].clientY;
    return e.clientY ?? 0;
  };

  const clampScroll = (value) => {
    const el = codeContainerRef.current;
    if (!el) return Math.max(0, value);
    return Math.max(0, Math.min(value, el.scrollHeight - el.clientHeight));
  };

  const handleStart = useCallback((e) => {
    if (e.cancelable) e.preventDefault();
    startYRef.current      = getY(e);
    startScrollRef.current = scrollTopRef.current;
    setPeeking(true);
    // 햅틱 피드백 (지원 기기)
    try { navigator.vibrate?.(10); } catch { /* ignore */ }
  }, []);

  const handleMove = useCallback((e) => {
    if (!peeking) return;
    const dy   = startYRef.current - getY(e); // 위로 드래그 = 양수 = 아래 스크롤
    const next = clampScroll(startScrollRef.current + dy);
    scrollTopRef.current = next;
    setScrollTop(next);
  }, [peeking]);

  const handleEnd = useCallback(() => {
    if (!peeking) return;
    setPeeking(false);
    // 손 뗀 후 스크롤 위치는 리셋 (참고하는 느낌 — 원상복귀)
    scrollTopRef.current = 0;
    setScrollTop(0);
  }, [peeking]);

  // peeking 중 window 전역으로 end 감지 (버튼 밖으로 이탈해도 닫힘)
  useEffect(() => {
    if (!peeking) return;
    window.addEventListener('touchend',    handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    window.addEventListener('mouseup',     handleEnd);
    return () => {
      window.removeEventListener('touchend',    handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
      window.removeEventListener('mouseup',     handleEnd);
    };
  }, [peeking, handleEnd]);

  // scrollTop → DOM 동기화
  useEffect(() => {
    if (codeContainerRef.current) {
      codeContainerRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop, peeking]);

  return {
    peeking,
    codeContainerRef,
    handlers: {
      onTouchStart: handleStart,
      onTouchMove:  handleMove,
      onTouchEnd:   handleEnd,
      onTouchCancel: handleEnd,
      onMouseDown:  handleStart,
      onMouseMove:  handleMove,
      onMouseUp:    handleEnd,
      onMouseLeave: handleEnd,
      onContextMenu: (e) => e.preventDefault(),
    },
  };
}

// ─── 코드 peek 오버레이 + 버튼 ───────────────────────────────────────────
/**
 * CodePeekOverlay — 홀드 투 피크 버튼 + 오버레이 세트.
 *
 * 버튼 위치: 하단 BottomNav(56px) 위 16px + safe-area 고려.
 */
function CodePeekOverlay({ code }) {
  const disabled = !code || !code.trim();
  const { peeking, codeContainerRef, handlers } = useCodePeek();

  if (disabled) return null;

  return (
    <>
      {/* 피크 오버레이 */}
      {peeking && (
        <div
          className="fixed inset-0 z-[9998] bg-[#0d1117]"
          style={{ pointerEvents: 'none' }}
        >
          {/* 상단 힌트 배너 */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-2 bg-theme-primary/20 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-theme-primary">
              손가락 드래그로 스크롤 · 떼면 닫힘
            </span>
          </div>

          <pre
            ref={codeContainerRef}
            className="h-full overflow-hidden p-4 pt-10 text-[12px] text-gray-300 font-mono whitespace-pre leading-relaxed"
          >
            {code}
          </pre>
        </div>
      )}

      {/* 홀드 버튼 — BottomNav(56px) 위에 위치 */}
      <button
        type="button"
        aria-label="누르고 있으면 코드 미리보기"
        className={cn(
          'fixed right-4 z-[9999]',
          'flex items-center gap-1.5 px-4 py-2.5 rounded-full',
          'bg-theme-primary/15 border border-theme-primary/40 text-theme-primary',
          'text-[11px] font-bold shadow-lg select-none touch-none',
          'active:scale-95 transition-transform',
          peeking && 'bg-theme-primary/30 border-theme-primary/80',
        )}
        style={{
          // BottomNav 56px + safe-area + 12px 여유
          bottom: 'calc(56px + env(safe-area-inset-bottom) + 12px)',
        }}
        {...handlers}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>코드 보기</span>
      </button>
    </>
  );
}

// ─── 상단바 ──────────────────────────────────────────────────────────────
function TopBar({ title, subtitle, onBack }) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-[50]',
        'appbar-blur border-b border-theme-border/50',
        'flex items-center px-2 gap-1',
        'h-[56px]',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <button
        type="button"
        onClick={onBack}
        className="touch-target flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 active:bg-white/10 text-theme-icon transition-colors"
        aria-label="학습 종료"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 min-w-0 text-center">
        <p className="text-[14px] font-bold text-white truncate leading-tight">{title}</p>
        {subtitle && (
          <p className="text-[10px] text-theme-primary truncate leading-tight">{subtitle}</p>
        )}
      </div>

      <div className="w-10 shrink-0" />
    </header>
  );
}

// ─── 코드노트 탭 ─────────────────────────────────────────────────────────
function CodeNotePanel({ code, loading, error, file }) {
  const displayCode = code
    ? code.split('\n').slice(0, 500).join('\n') +
      (code.split('\n').length > 500 ? '\n\n// ... (이하 생략)' : '')
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="rounded-xl bg-theme-card border border-theme-border p-3">
          <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wider">코드노트</p>
          <p className="text-sm font-bold text-white mt-0.5 break-all">{file?.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[72px] px-4">
        <div className="rounded-xl bg-[#0f1716] border border-theme-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border/50">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {file?.name}
            </span>
            <span className="text-[10px] text-gray-600">읽기 전용</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-theme-primary/30 border-t-theme-primary rounded-full animate-spin" />
              <span>불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm text-red-400">{error}</div>
          ) : (
            <pre className="text-[11px] leading-relaxed text-gray-300 p-4 overflow-x-auto whitespace-pre font-mono">
              {displayCode}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 튜터 탭 (ChatView 재사용 + 코드 peek) ───────────────────────────────
function TutorPanel({ chapter, file, code, onBack }) {
  const teacher  = useLearningStore((s) => s.teacher);
  const repo     = useLearningStore((s) => s.repo);
  const concept  = useLearningStore((s) => s.concept);
  const setConcept      = useLearningStore((s) => s.setConcept);
  const setStep         = useLearningStore((s) => s.setStep);
  const markFileVisited = useLearningStore((s) => s.markFileVisited);

  useEffect(() => {
    if (!file) return;
    markFileVisited(file.path);
    setConcept({
      type: 'file',
      downloadUrl: file.downloadUrl,
      name: file.name,
      path: file.path,
      chapterLabel: chapter?.label || chapter?.name,
    });
    setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.path]);

  if (!teacher || !repo || !concept) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        <div className="text-center px-6">
          <p className="text-4xl mb-3">🔧</p>
          <p className="font-semibold text-white">학습 세션 준비 중...</p>
          <p className="text-xs mt-1 text-gray-500">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* ChatView: 내부적으로 isMobile 감지해 모바일 레이아웃 전환 */}
      <ChatView
        teacher={teacher}
        repo={repo}
        concept={concept}
        onComplete={onBack}
        onBack={onBack}
      />

      {/* 코드 peek 버튼 — 채팅하면서 코드를 잠깐 참고하고 싶을 때 */}
      <CodePeekOverlay code={code} />
    </div>
  );
}

// ─── 문제풀기 탭 ────────────────────────────────────────────────────────
function QuizPanel({ onGoLevelUp }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      <div className="w-20 h-20 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
        <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-white">문제 풀기</p>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
          레벨업 탭에서 이 챕터와 연관된<br />티어별 챌린지 문제를 풀어보세요.
        </p>
      </div>
      <button
        type="button"
        onClick={onGoLevelUp}
        className="mt-2 px-6 py-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold transition-all active:scale-95 hover:bg-amber-500/30"
      >
        레벨업 탭으로 이동 →
      </button>
    </div>
  );
}

// ─── 노트 탭 ────────────────────────────────────────────────────────────
function NotePanel({ file }) {
  const [note, setNote] = useState('');
  const noteKey = `lucid_note_${file?.path ?? 'default'}`;

  useEffect(() => {
    if (!file) return;
    const saved = localStorage.getItem(noteKey);
    if (saved) setNote(saved);
  }, [noteKey]);

  const handleChange = (e) => {
    const val = e.target.value;
    setNote(val);
    localStorage.setItem(noteKey, val);
  };

  return (
    <div className="flex flex-col h-full px-4 pt-3 pb-[72px]">
      <div className="shrink-0 mb-3">
        <div className="rounded-xl bg-theme-card border border-theme-border p-3">
          <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wider">노트</p>
          <p className="text-xs text-gray-400 mt-0.5">{file?.name} 학습 메모</p>
        </div>
      </div>

      <textarea
        value={note}
        onChange={handleChange}
        placeholder="이 파일을 공부하면서 기억하고 싶은 내용을 적어보세요..."
        className={cn(
          'flex-1 w-full rounded-xl bg-theme-card border border-theme-border',
          'p-4 text-sm text-white placeholder-gray-600',
          'resize-none outline-none focus:border-theme-primary/50',
          'transition-colors duration-150',
        )}
        onFocus={(e) => {
          // iOS 키보드 올라올 때 textarea 가림 방지
          setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 300);
        }}
      />

      <p className="text-[10px] text-gray-600 mt-2 text-right">
        {note.length}자 · 자동 저장됨
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MobileLearningView
//
// 파일 선택 후 풀스크린 학습 모드.
// 코드를 상위에서 한 번만 fetch → 하위 패널에 공유 (중복 fetch 방지).
//
// learningState: { chapter, file, subTab }
// subTab: 'tutor' | 'codenote' | 'quiz' | 'note'
// ═══════════════════════════════════════════════════════════════════════════
export default function MobileLearningView() {
  const { learningState, exitLearning, handleTabChange } = useStudentContext();

  // ── 코드 공유 fetch (하위 패널에 props로 전달) ──────────────────────
  const [code, setCode]       = useState(null);
  const [codeLoading, setCL]  = useState(true);
  const [codeError, setCE]    = useState(null);

  const file = learningState?.file ?? null;

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setCL(true);
    setCE(null);
    setCode(null);

    (async () => {
      try {
        let text = file.sha ? await getGithubFileCache(file.sha) : null;
        if (!text) {
          const resp = await fetch(file.downloadUrl);
          text = await resp.text();
          if (file.sha) saveGithubFileCache(file.sha, text);
        }
        if (!cancelled) setCode(text);
      } catch (e) {
        console.error('[MobileLearningView] 코드 fetch 실패:', e);
        if (!cancelled) setCE('코드를 불러오지 못했어요');
      } finally {
        if (!cancelled) setCL(false);
      }
    })();

    return () => { cancelled = true; };
  }, [file?.sha, file?.downloadUrl]);

  if (!learningState) return null;

  const { chapter, subTab } = learningState;
  const title    = file?.name ?? '학습 중';
  const subtitle = chapter?.label || chapter?.name;

  const handleGoLevelUp = () => {
    exitLearning();
    handleTabChange('levelup');
  };

  return (
    <div className="flex flex-col w-full" style={{ height: '100dvh' }}>

      {/* 상단바 */}
      <TopBar title={title} subtitle={subtitle} onBack={exitLearning} />

      {/* TopBar 높이 spacer */}
      <div style={{ height: 'calc(56px + env(safe-area-inset-top))' }} className="shrink-0" />

      {/* 서브탭 패널 */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'codenote' && (
          <CodeNotePanel
            code={code}
            loading={codeLoading}
            error={codeError}
            file={file}
          />
        )}
        {subTab === 'tutor' && (
          <TutorPanel
            chapter={chapter}
            file={file}
            code={code}   // 코드 peek 용
            onBack={exitLearning}
          />
        )}
        {subTab === 'quiz' && <QuizPanel onGoLevelUp={handleGoLevelUp} />}
        {subTab === 'note' && <NotePanel file={file} />}
      </div>

    </div>
  );
}
