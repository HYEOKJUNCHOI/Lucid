import React from 'react';
import MobileBottomTab from '@/components/common/mobile/MobileBottomTab';

/**
 * MobileAppShell — 모바일(<768px) 학생 앱 최상위 쉘.
 *
 * 구조: [children(Screen으로 감싸진 현재 탭 화면)] + [MobileBottomTab 5개]
 *
 * @param {object} props
 * @param {'home'|'learn'|'quest'|'levelup'|'profile'} props.currentTabId
 * @param {(tabId:string)=>void} props.onTabChange
 * @param {React.ReactNode} props.children — 현재 탭 화면 (Screen 으로 감싸져 있음 가정)
 */
export default function MobileAppShell({ currentTabId, onTabChange, children }) {
  const items = [
    { key: 'home',    label: '홈',     icon: '🏠', active: currentTabId === 'home',    onClick: () => onTabChange('home') },
    { key: 'learn',   label: '학습',   icon: '📚', active: currentTabId === 'learn',   onClick: () => onTabChange('learn') },
    { key: 'quest',   label: '퀘스트', icon: '🎯', active: currentTabId === 'quest',   onClick: () => onTabChange('quest') },
    { key: 'levelup', label: '레벨업', icon: '⚡', active: currentTabId === 'levelup', onClick: () => onTabChange('levelup') },
    { key: 'profile', label: '프로필', icon: '👤', active: currentTabId === 'profile', onClick: () => onTabChange('profile') },
  ];

  return (
    <div className="relative w-full md:hidden" style={{ minHeight: '100dvh' }}>
      {children}
      <MobileBottomTab items={items} />
    </div>
  );
}
