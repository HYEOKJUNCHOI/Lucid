import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import useLearningStore from '@/store/useLearningStore';
import ChatView from '@/pages/Student/ChatView';
import { getGithubFileCache, saveGithubFileCache } from '@/services/learningService';
import { useStudentContext } from '@/pages/Student/mobile/MobileStudentPage';

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

      {/* 우측 공간 유지용 */}
      <div className="w-10 shrink-0" />
    </header>
  );
}

// ─── 코드노트 탭 (파일 코드 읽기전용 + 메모 공간) ─────────────────────
function CodeNotePanel({ file }) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let text = file.sha ? await getGithubFileCache(file.sha) : null;
        if (!text) {
          const resp = await fetch(file.downloadUrl);
          text = await resp.text();
          if (file.sha) saveGithubFileCache(file.sha, text);
        }
        if (!cancelled) setCode(text);
      } catch (e) {
        console.error('[MobileLearningView] 코드 로드 실패:', e);
        if (!cancelled) setError('코드를 불러오지 못했어요');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file?.sha, file?.downloadUrl]);

  // 모바일 렌더링 부담 경감 — 코드 500줄 제한
  const displayCode = code
    ? code.split('\n').slice(0, 500).join('\n') +
      (code.split('\n').length > 500 ? '\n\n// ... (이하 생략)' : '')
    : '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 파일 헤더 */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="rounded-xl bg-theme-card border border-theme-border p-3">
          <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wider">코드노트</p>
          <p className="text-sm font-bold text-white mt-0.5 break-all">{file?.name}</p>
        </div>
      </div>

      {/* 코드 영역 */}
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

// ─── 튜터 탭 (데스크탑 ChatView 재사용) ──────────────────────────────
function TutorPanel({ chapter, file, onBack }) {
  const teacher  = useLearningStore((s) => s.teacher);
  const repo     = useLearningStore((s) => s.repo);
  const concept  = useLearningStore((s) => s.concept);
  const setConcept = useLearningStore((s) => s.setConcept);
  const setStep    = useLearningStore((s) => s.setStep);
  const markFileVisited = useLearningStore((s) => s.markFileVisited);

  // 학습 세션 초기화 — 처음 진입 시 concept 설정
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
    /**
     * ChatView는 내부적으로 isMobile 감지해서 모바일 레이아웃으로 전환.
     * pt-[56px]: TopBar(fixed) 높이만큼 밀어냄.
     * pb-[56px]: MobileBottomNav(fixed) 높이만큼 밀어냄.
     */
    <div className="h-full">
      <ChatView
        teacher={teacher}
        repo={repo}
        concept={concept}
        onComplete={onBack}
        onBack={onBack}
      />
    </div>
  );
}

// ─── 문제풀기 탭 (티어별 챌린지 안내) ────────────────────────────────
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
        <p className="text-sm text-gray-400 mt-1">레벨업 탭에서 티어별 챌린지 문제를 풀어보세요.</p>
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

// ─── 노트 탭 (간단한 메모장) ─────────────────────────────────────────
function NotePanel({ file }) {
  const [note, setNote] = useState('');
  const noteKey = `note_${file?.path ?? 'default'}`;

  // 파일별 노트 로드 (localStorage 임시 저장)
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
          // iOS 키보드 올라올 때 textarea가 가리지 않도록 스크롤
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
// MobileLearningView — 파일 학습 모드 풀스크린
//
// learningState: { chapter, file, subTab }
// subTab: 'tutor' | 'codenote' | 'quiz' | 'note'
//
// TopBar에는 파일명 표시. 하단 동적 메뉴는 MobileBottomNav가 처리.
// ═══════════════════════════════════════════════════════════════════════════
export default function MobileLearningView() {
  const { learningState, exitLearning, handleTabChange } = useStudentContext();

  if (!learningState) return null;

  const { chapter, file, subTab } = learningState;
  const title = file?.name ?? '학습 중';
  const subtitle = chapter?.label || chapter?.name;

  const handleGoLevelUp = () => {
    exitLearning();
    handleTabChange('levelup');
  };

  return (
    <div className="flex flex-col w-full" style={{ height: '100dvh' }}>
      {/* TopBar — 파일명 + 뒤로가기 */}
      <TopBar
        title={title}
        subtitle={subtitle}
        onBack={exitLearning}
      />

      {/* TopBar 높이 spacer */}
      <div style={{ height: 'calc(56px + env(safe-area-inset-top))' }} className="shrink-0" />

      {/* 서브탭 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'codenote' && <CodeNotePanel file={file} />}
        {subTab === 'tutor'    && <TutorPanel chapter={chapter} file={file} onBack={exitLearning} />}
        {subTab === 'quiz'     && <QuizPanel onGoLevelUp={handleGoLevelUp} />}
        {subTab === 'note'     && <NotePanel file={file} />}
      </div>
    </div>
  );
}
