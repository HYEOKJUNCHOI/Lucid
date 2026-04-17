import React, { useMemo } from 'react';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import ListRow from '@/components/common/mobile/ListRow';
import { useStack } from '@/components/common/mobile/StackNavigator';
import useLearningStore from '@/store/useLearningStore';
import ChapterDetailScreen from './ChapterDetailScreen';

/**
 * ChapterListScreen — 학습 탭 스택 Level 0.
 *
 * 챕터 목록을 보여주고, 각 챕터 탭 시 ChapterDetailScreen 을 push 한다.
 * 챕터 데이터는 useLearningStore (zustand) 에서 읽는다.
 */
export default function ChapterListScreen() {
  const { push } = useStack();
  const chapters = useLearningStore((s) => s.chapters);
  const chaptersLoading = useLearningStore((s) => s.chaptersLoading);
  const chapterFilesMap = useLearningStore((s) => s.chapterFilesMap);
  const completedFiles = useLearningStore((s) => s.completedFiles);

  // 챕터별 진행률 (완료 파일 수 / 전체 파일 수) — 파일 목록이 로드된 챕터만 산정
  const progressMap = useMemo(() => {
    const m = {};
    chapters.forEach((ch) => {
      const files = chapterFilesMap[ch.name];
      if (!files || files.length === 0) return;
      const done = files.filter((f) => completedFiles.includes(f.path)).length;
      m[ch.name] = Math.round((done / files.length) * 100);
    });
    return m;
  }, [chapters, chapterFilesMap, completedFiles]);

  const handlePress = (ch) => {
    push(<ChapterDetailScreen chapter={ch} />, `chapter-${ch.name}`);
  };

  return (
    <Screen
      bottomTab
      appBar={<MobileTopBar title="학습" largeTitle blurBg />}
      animate="fade"
    >
      {chaptersLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">
          챕터 불러오는 중...
        </div>
      ) : !chapters || chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="text-4xl mb-3">🌱</div>
          <p className="text-white text-base font-semibold mb-1">
            아직 학습 가능한 챕터가 없어요
          </p>
          <p className="text-gray-400 text-sm">
            선생님이 챕터를 열면 여기에 표시돼요
          </p>
        </div>
      ) : (
        <div className="py-2">
          {chapters.map((ch) => {
            const progress = progressMap[ch.name];
            return (
              <ListRow
                key={ch.name}
                icon="📘"
                label={ch.label || ch.name.replace('ch', 'ch.')}
                sublabel={ch.description || null}
                value={progress !== undefined ? `${progress}%` : null}
                chevron
                onPress={() => handlePress(ch)}
              />
            );
          })}
        </div>
      )}
    </Screen>
  );
}
