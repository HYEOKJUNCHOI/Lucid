import React from 'react';
import StackNavigator from '@/components/common/mobile/StackNavigator';
import ChapterListScreen from './learn/ChapterListScreen';

/**
 * LearnTab — 학습 탭 루트 (모바일).
 *
 * StackNavigator 로 챕터 리스트 → 챕터 상세 → 파일 상세 3단 스택을 구성한다.
 * 각 스크린에서 useStack() 훅으로 push/pop 을 호출한다.
 */
export default function LearnTab() {
  return <StackNavigator initialScreen={<ChapterListScreen />} />;
}
