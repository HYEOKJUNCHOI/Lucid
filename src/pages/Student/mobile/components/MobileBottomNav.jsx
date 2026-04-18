import { cn } from '@/lib/cn';
import { motion } from '@/lib/motion';
import haptic from '@/lib/haptic';
import { useStudentContext } from '@/pages/Student/mobile/MobileStudentPage';

// ─── 아이콘 컴포넌트 (SVG 인라인 — react-icons 번들 최소화) ───────────────
function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BookIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function QuestIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v1.5M12 19.5V21M3 12H1.5M22.5 12H21M6.22 6.22l-1.06-1.06M18.84 18.84l-1.06-1.06M6.22 17.78l-1.06 1.06M18.84 5.16l-1.06 1.06" />
    </svg>
  );
}

function LevelUpIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ProfileIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

// ─── 학습 모드 아이콘 ───────────────────────────────────────────────────────
function CodeNoteIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function TutorIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function QuizIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function NoteIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// ─── 탭 정의 ─────────────────────────────────────────────────────────────────
/** 기본 5탭 */
const BASE_TABS = [
  { key: 'home',    label: '홈',     Icon: HomeIcon },
  { key: 'learn',   label: '학습',   Icon: BookIcon },
  { key: 'quest',   label: '퀘스트', Icon: QuestIcon },
  { key: 'levelup', label: '레벨업', Icon: LevelUpIcon },
  { key: 'profile', label: '프로필', Icon: ProfileIcon },
];

/** 학습 모드 동적 서브탭 */
const LEARNING_TABS = [
  { key: 'codenote', label: '코드노트', Icon: CodeNoteIcon },
  { key: 'tutor',    label: '튜터',     Icon: TutorIcon },
  { key: 'quiz',     label: '문제풀기', Icon: QuizIcon },
  { key: 'note',     label: '노트',     Icon: NoteIcon },
  { key: 'back',     label: '나가기',   Icon: BackIcon },
];

// ─── MobileBottomNav ─────────────────────────────────────────────────────────
/**
 * MobileBottomNav — 동적 하단 탭바.
 *
 * - 탭 모드: 기본 5탭 (홈/학습/퀘스트/레벨업/프로필)
 * - 학습 모드: 학습 서브탭 (코드노트/튜터/문제풀기/노트/나가기)
 *
 * learningState의 유무로 자동 전환. 나가기 누르면 exitLearning() 호출.
 */
export default function MobileBottomNav() {
  const {
    currentTab,
    handleTabChange,
    learningState,
    setLearningSubTab,
    exitLearning,
  } = useStudentContext();

  const isLearning = !!learningState;
  const tabs = isLearning ? LEARNING_TABS : BASE_TABS;
  const activeKey = isLearning ? (learningState?.subTab ?? 'tutor') : currentTab;

  const handlePress = (key) => {
    if (isLearning) {
      if (key === 'back') {
        haptic.tap();
        exitLearning();
      } else {
        haptic.selection();
        setLearningSubTab(key);
      }
    } else {
      haptic.selection();
      handleTabChange(key);
    }
  };

  return (
    <nav
      className={cn(
        'md:hidden',
        'fixed bottom-0 left-0 right-0 z-[100]',
        'tabbar-blur border-t border-theme-border/50',
        // 학습 모드 전환 시 부드러운 색 변화
        isLearning && 'border-theme-primary/20',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 학습 모드 인디케이터 — 상단 선 강조 */}
      {isLearning && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-theme-primary to-transparent opacity-60" />
      )}

      <ul className="h-[56px] flex items-stretch">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          // 나가기 버튼은 별도 스타일 (빨간 계열)
          const isBack = tab.key === 'back';

          return (
            <li key={tab.key} className="flex-1">
              <button
                type="button"
                onClick={() => handlePress(tab.key)}
                className={cn(
                  'w-full h-full flex flex-col items-center justify-center gap-0.5',
                  'transition-all duration-150',
                  isBack
                    ? 'opacity-60 text-red-400 hover:opacity-90'
                    : active
                    ? 'opacity-100 text-theme-primary'
                    : 'opacity-[0.5] text-theme-secondary hover:opacity-75',
                  // 탭 전환 애니메이션 (탭 키가 바뀔 때 스프링 효과)
                  active && !isBack && motion('animate-tab-spring'),
                )}
              >
                <tab.Icon active={active} />
                <span className="text-[10px] font-semibold leading-none mt-0.5">
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
