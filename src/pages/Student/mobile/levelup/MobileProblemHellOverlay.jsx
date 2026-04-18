import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { motion } from '@/lib/motion';
import LevelUpView from '@/pages/Student/LevelUpView';
import useLearningStore from '@/store/useLearningStore';

/**
 * MobileProblemHellOverlay — 문제지옥 모바일 오버레이.
 *
 * 데스크탑 LevelUpView를 모바일 풀스크린으로 감싸서 표시.
 * LevelUpView는 내부적으로 useIsMobile()을 감지해 모바일 레이아웃으로 전환한다.
 *
 * @param {boolean}    isOpen   - 오버레이 표시 여부
 * @param {()=>void}   onClose  - 닫기 콜백
 */
export default function MobileProblemHellOverlay({ isOpen, onClose }) {
  const teacher = useLearningStore((s) => s.teacher);
  const repo    = useLearningStore((s) => s.repo);

  // 오버레이 열리면 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200]',
        'flex flex-col bg-theme-bg',
        motion('animate-stack-push-in'),
      )}
      style={{ height: '100dvh' }}
    >
      {/* 상단바 */}
      <header
        className="flex items-center px-2 h-[56px] shrink-0 appbar-blur border-b border-theme-border/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/5 active:bg-white/10 text-theme-icon transition-colors"
          aria-label="문제지옥 닫기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-[15px] font-bold text-white">문제지옥</span>
          <span className="text-base">🔥</span>
        </div>

        <div className="w-10 shrink-0" />
      </header>

      {/* TopBar spacer */}
      {/* LevelUpView는 fixed 상단바 없이 바로 렌더되므로 spacer 불필요 */}

      {/* LevelUpView 컨텐츠 */}
      <div
        className="flex-1 overflow-y-auto pb-safe"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {teacher && repo ? (
          <LevelUpView
            teacher={teacher}
            repo={repo}
          />
        ) : (
          // 아직 학습 레포 선택 전
          <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
            <div className="text-5xl">📚</div>
            <p className="text-lg font-bold text-white">먼저 학습을 시작하세요</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              학습 탭에서 챕터를 선택하고<br />파일을 열면 문제지옥이 활성화돼요.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-6 py-3 rounded-xl bg-theme-primary/20 border border-theme-primary/30 text-theme-primary text-sm font-semibold active:scale-95 transition-all"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
