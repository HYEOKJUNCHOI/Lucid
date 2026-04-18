import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { motion } from '@/lib/motion';
import haptic from '@/lib/haptic';
import useLearningStore from '@/store/useLearningStore';
import { useStudentContext } from '@/pages/Student/mobile/MobileStudentPage';

// ─── 상단바 (뒤로가기 지원) ────────────────────────────────────────────────
function TopBar({ title, onBack, right }) {
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
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="touch-target flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 active:bg-white/10 text-theme-icon transition-colors"
          aria-label="뒤로가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        // 뒤로가기 없을 때 — 좌측 공간 확보용
        <div className="w-10 shrink-0" />
      )}

      <h1 className="flex-1 text-center text-[15px] font-bold text-white truncate">
        {title}
      </h1>

      <div className="w-10 flex items-center justify-end">
        {right}
      </div>
    </header>
  );
}

// ─── 진행률 뱃지 ──────────────────────────────────────────────────────────
function ProgressBadge({ done, total }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className={cn(
      'text-[11px] font-semibold px-2 py-0.5 rounded-full',
      pct === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-400',
    )}>
      {pct === 100 ? '완료' : `${done}/${total}`}
    </span>
  );
}

// ─── 챕터 행 ─────────────────────────────────────────────────────────────
function ChapterRow({ chapter, done, total, onPress }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5',
        'border-b border-theme-border/40 last:border-0',
        'transition-colors active:bg-white/5',
      )}
    >
      {/* 챕터 아이콘 */}
      <div className="w-10 h-10 rounded-xl bg-theme-primary/15 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="text-theme-primary">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-white truncate">
          {chapter.label || chapter.name.replace('ch', 'ch.')}
        </p>
        {chapter.description && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{chapter.description}</p>
        )}
      </div>

      {/* 진행률 + 화살표 */}
      <div className="flex items-center gap-2 shrink-0">
        <ProgressBadge done={done} total={total} />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ─── 파일 행 ─────────────────────────────────────────────────────────────
function FileRow({ file, isVisited, isCompleted, onPress }) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const extColor = {
    java: 'text-orange-400',
    js: 'text-yellow-400',
    jsx: 'text-sky-400',
    ts: 'text-blue-400',
    tsx: 'text-blue-400',
    py: 'text-emerald-400',
  }[ext] ?? 'text-gray-400';

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5',
        'border-b border-theme-border/40 last:border-0',
        'transition-colors active:bg-white/5',
      )}
    >
      {/* 파일 아이콘 + 상태 */}
      <div className="relative w-10 h-10 rounded-xl bg-theme-card border border-theme-border flex items-center justify-center shrink-0">
        <span className={cn('text-xs font-bold uppercase', extColor)}>
          {ext}
        </span>
        {/* 완료 표시 */}
        {isCompleted && (
          <span className="absolute -top-1 -right-1 text-[10px]">✅</span>
        )}
      </div>

      {/* 파일명 */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-white truncate">{file.name}</p>
        {isVisited && !isCompleted && (
          <p className="text-[10px] text-amber-400 mt-0.5">학습 중</p>
        )}
        {isCompleted && (
          <p className="text-[10px] text-emerald-400 mt-0.5">완료</p>
        )}
      </div>

      {/* 시작 버튼 */}
      <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-theme-primary">
        <span>열기</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ─── 빈 상태 ─────────────────────────────────────────────────────────────
function EmptyState({ loading, message }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-theme-primary/30 border-t-theme-primary rounded-full animate-spin" />
        <span>불러오는 중...</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <span className="text-5xl">🌱</span>
      <p className="text-base font-bold text-white">{message ?? '내용이 없어요'}</p>
      <p className="text-sm text-gray-400">선생님이 챕터를 열면 여기에 표시돼요</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MobileChapterPicker — 학습 탭 메인 화면
//
// 3단 드릴다운: 챕터 목록 → 챕터 상세(파일 목록) → 파일 선택 → 학습 진입
// StackNavigator 없이 내부 state(screen)로 관리.
// ═══════════════════════════════════════════════════════════════════════════
export default function MobileChapterPicker() {
  const { enterLearning } = useStudentContext();

  const chapters            = useLearningStore((s) => s.chapters);
  const chaptersLoading     = useLearningStore((s) => s.chaptersLoading);
  const chapterFilesMap     = useLearningStore((s) => s.chapterFilesMap);
  const setChapterFilesMap  = useLearningStore((s) => s.setChapterFilesMap);
  const chapterFilesLoadingMap    = useLearningStore((s) => s.chapterFilesLoadingMap);
  const setChapterFilesLoadingMap = useLearningStore((s) => s.setChapterFilesLoadingMap);
  const teacher             = useLearningStore((s) => s.teacher);
  const repo                = useLearningStore((s) => s.repo);
  const visitedFiles        = useLearningStore((s) => s.visitedFiles);
  const completedFiles      = useLearningStore((s) => s.completedFiles);

  // 현재 선택된 챕터 (null = 챕터 목록 화면)
  const [selectedChapter, setSelectedChapter] = useState(null);

  // 선택된 챕터의 파일 목록 로드 (ChapterDetailScreen 로직 이식)
  useEffect(() => {
    if (!selectedChapter) return;
    const chName = selectedChapter.name;
    const files = chapterFilesMap[chName];
    const isLoading = chapterFilesLoadingMap[chName];

    if ((files && files.length > 0) || isLoading) return;
    if (!teacher || !repo || !selectedChapter?.fullPath) return;

    let cancelled = false;
    (async () => {
      setChapterFilesLoadingMap((prev) => ({ ...prev, [chName]: true }));
      try {
        const headers = {};
        if (import.meta.env.VITE_GITHUB_TOKEN) {
          headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
        }
        const res = await fetch(
          `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${selectedChapter.fullPath}`,
          { headers }
        );
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data = await res.json();
        const codeFiles = Array.isArray(data)
          ? data.filter((f) => f.type === 'file' && /\.(java|js|jsx|ts|tsx|py)$/.test(f.name))
          : [];
        if (cancelled) return;
        setChapterFilesMap((prev) => ({
          ...prev,
          [chName]: codeFiles.map((f) => ({
            name: f.name,
            downloadUrl: f.download_url,
            path: f.path,
            sha: f.sha,
          })),
        }));
      } catch (e) {
        console.error('[MobileChapterPicker] 파일 로드 실패:', e);
      } finally {
        if (!cancelled) {
          setChapterFilesLoadingMap((prev) => ({ ...prev, [chName]: false }));
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter?.name]);

  // 챕터별 완료 파일 수 계산
  const progressMap = useMemo(() => {
    const m = {};
    chapters.forEach((ch) => {
      const files = chapterFilesMap[ch.name];
      if (!files || files.length === 0) return;
      const done = files.filter((f) => completedFiles.includes(f.path)).length;
      m[ch.name] = { done, total: files.length };
    });
    return m;
  }, [chapters, chapterFilesMap, completedFiles]);

  const handleChapterPress = (ch) => {
    haptic.tap();
    setSelectedChapter(ch);
  };

  const handleFilePress = (file) => {
    haptic.tap();
    enterLearning(selectedChapter, file);
  };

  const handleBack = () => {
    haptic.tap();
    setSelectedChapter(null);
  };

  // ── 챕터 상세 화면 (파일 목록) ──────────────────────────────
  if (selectedChapter) {
    const files = chapterFilesMap[selectedChapter.name] ?? [];
    const isLoading = chapterFilesLoadingMap[selectedChapter.name] ?? false;
    const title = selectedChapter.label || selectedChapter.name.replace('ch', 'ch.');

    return (
      <div
        className={cn('flex flex-col w-full', motion('animate-stack-push-in'))}
        style={{ height: '100dvh' }}
      >
        <TopBar title={title} onBack={handleBack} />

        {/* TopBar 높이만큼 spacer */}
        <div style={{ height: 'calc(56px + env(safe-area-inset-top))' }} className="shrink-0" />

        {/* 챕터 설명 카드 */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="rounded-2xl bg-theme-card border border-theme-border p-4">
            <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wider mb-1">CHAPTER</p>
            <p className="text-lg font-bold text-white">{title}</p>
            {selectedChapter.description && (
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">{selectedChapter.description}</p>
            )}
          </div>
        </div>

        {/* 파일 목록 */}
        <div
          className="flex-1 overflow-y-auto pb-[72px]" // BottomNav 높이(56)+여유
        >
          {isLoading || files.length === 0 ? (
            <EmptyState
              loading={isLoading}
              message="이 챕터엔 아직 파일이 없어요"
            />
          ) : (
            <div className="bg-theme-card mx-4 rounded-2xl overflow-hidden border border-theme-border">
              {files.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  isVisited={visitedFiles.includes(file.path)}
                  isCompleted={completedFiles.includes(file.path)}
                  onPress={() => handleFilePress(file)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 챕터 목록 화면 ──────────────────────────────────────────
  return (
    <div
      className={cn('flex flex-col w-full', motion('animate-tab-fade'))}
      style={{ height: '100dvh' }}
    >
      <TopBar title="학습" />

      {/* TopBar 높이만큼 spacer */}
      <div style={{ height: 'calc(56px + env(safe-area-inset-top))' }} className="shrink-0" />

      {/* 챕터 목록 */}
      <div className="flex-1 overflow-y-auto pb-[72px]">
        {chaptersLoading || !chapters || chapters.length === 0 ? (
          <EmptyState
            loading={chaptersLoading}
            message="아직 학습 가능한 챕터가 없어요"
          />
        ) : (
          <div className="bg-theme-card mx-4 mt-3 rounded-2xl overflow-hidden border border-theme-border">
            {chapters.map((ch) => {
              const { done = 0, total = 0 } = progressMap[ch.name] ?? {};
              return (
                <ChapterRow
                  key={ch.name}
                  chapter={ch}
                  done={done}
                  total={total}
                  onPress={() => handleChapterPress(ch)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
