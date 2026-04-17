import React, { useEffect } from 'react';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import ListRow from '@/components/common/mobile/ListRow';
import { useStack } from '@/components/common/mobile/StackNavigator';
import useLearningStore from '@/store/useLearningStore';
import FileDetailScreen from './FileDetailScreen';

/**
 * ChapterDetailScreen — 학습 탭 스택 Level 1.
 *
 * 챕터에 속한 파일 목록을 표시한다. 파일 목록이 아직 로드되지 않은 경우
 * GitHub API 로 직접 fetch 하여 useLearningStore 에 저장한다 (StudentPage.jsx 의 handleChapterToggle 로직 재현).
 *
 * @param {object} props
 * @param {object} props.chapter  — { name, label, fullPath, description }
 */
export default function ChapterDetailScreen({ chapter }) {
  const { push, pop } = useStack();
  const teacher = useLearningStore((s) => s.teacher);
  const repo = useLearningStore((s) => s.repo);
  const chapterFilesMap = useLearningStore((s) => s.chapterFilesMap);
  const setChapterFilesMap = useLearningStore((s) => s.setChapterFilesMap);
  const chapterFilesLoadingMap = useLearningStore((s) => s.chapterFilesLoadingMap);
  const setChapterFilesLoadingMap = useLearningStore((s) => s.setChapterFilesLoadingMap);
  const visitedFiles = useLearningStore((s) => s.visitedFiles);
  const completedFiles = useLearningStore((s) => s.completedFiles);

  const files = chapterFilesMap[chapter.name];
  const isLoading = chapterFilesLoadingMap[chapter.name];

  // 진입 시 파일 목록이 없으면 GitHub 에서 로드
  useEffect(() => {
    if (files && files.length > 0) return;
    if (isLoading) return;
    if (!teacher || !repo || !chapter?.fullPath) return;

    let cancelled = false;
    (async () => {
      setChapterFilesLoadingMap((prev) => ({ ...prev, [chapter.name]: true }));
      try {
        const headers = {};
        if (import.meta.env.VITE_GITHUB_TOKEN) {
          headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
        }
        const res = await fetch(
          `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${chapter.fullPath}`,
          { headers }
        );
        if (!res.ok) throw new Error(`GitHub API Error: ${res.status}`);
        const data = await res.json();
        const codeFiles = Array.isArray(data)
          ? data.filter((f) => f.type === 'file' && /\.(java|js|jsx|ts|tsx|py)$/.test(f.name))
          : [];
        if (cancelled) return;
        setChapterFilesMap((prev) => ({
          ...prev,
          [chapter.name]: codeFiles.map((f) => ({
            name: f.name,
            downloadUrl: f.download_url,
            path: f.path,
            sha: f.sha,
          })),
        }));
      } catch (e) {
        console.error('파일 로드 실패:', e);
      } finally {
        if (!cancelled) {
          setChapterFilesLoadingMap((prev) => ({ ...prev, [chapter.name]: false }));
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.name]);

  const handleFilePress = (file) => {
    push(
      <FileDetailScreen file={file} chapter={chapter} />,
      `file-${chapter.name}-${file.name}`
    );
  };

  const title = chapter.label || chapter.name.replace('ch', 'ch.');

  return (
    <Screen
      bottomTab
      appBar={
        <MobileTopBar
          title={title}
          leading="back"
          onLeadingClick={pop}
          blurBg
        />
      }
    >
      {/* 챕터 설명 헤더 카드 */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl bg-theme-card border border-theme-border p-4">
          <div className="text-xs text-theme-primary font-semibold mb-1">CHAPTER</div>
          <div className="text-lg font-bold text-white mb-1">{title}</div>
          {chapter.description && (
            <div className="text-sm text-gray-400 leading-relaxed">
              {chapter.description}
            </div>
          )}
        </div>
      </div>

      {/* 파일 목록 */}
      <div className="py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            파일 목록 불러오는 중...
          </div>
        ) : !files || files.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-gray-400 text-sm">이 챕터엔 아직 파일이 없어요</p>
          </div>
        ) : (
          files.map((file) => {
            const isVisited = visitedFiles.includes(file.path);
            const isCompleted = completedFiles.includes(file.path);
            const statusIcon = isCompleted ? '✅' : isVisited ? '📝' : '📄';
            const statusText = isCompleted ? '완료' : isVisited ? '학습 중' : null;
            return (
              <ListRow
                key={file.path}
                icon={statusIcon}
                label={file.name}
                sublabel={file.path}
                value={statusText}
                chevron
                onPress={() => handleFilePress(file)}
              />
            );
          })
        )}
      </div>
    </Screen>
  );
}
