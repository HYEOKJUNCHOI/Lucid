import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import TeacherManagement from './TeacherManagement';
import GroupManagement from './GroupManagement';
import StudentManagement from './StudentManagement';
import StudentDashboard from './StudentDashboard';
import SeatChart from './SeatChart';
import AlertsAndTop from './AlertsAndTop';
import MetaphorLibrary from './MetaphorLibrary';
import RewardPanel from './RewardPanel';
import DebugPanel from './DebugPanel';

const AdminPage = ({ user, userData, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab) => setSearchParams({ tab });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const NAV_ITEMS = [
    {
      tab: 'dashboard',
      label: '학생 현황 대시보드',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      ),
    },
    // 디버그 패널은 DEV 빌드에서만 노출 — 프로덕션에선 완전히 숨김
    ...(import.meta.env.DEV ? [{
      tab: 'debug',
      label: '⚠️ 디버그 패널',
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      ),
    }] : []),
  ];

  return (
    <div className="h-svh bg-theme-bg text-white flex flex-col md:flex-row overflow-hidden">

      {/* 관리자 사이드바 (데스크톱) */}
      <aside
        className={`hidden md:flex flex-col justify-between bg-theme-sidebar border-r border-theme-border shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[60px] p-2' : 'w-64 p-4'
        }`}
      >
        {/* 상단 */}
        <div>
          {/* 로고 + 접기 버튼 */}
          <div className={`flex items-center mb-6 ${collapsed ? 'justify-center' : 'justify-between gap-2 px-1'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-xl backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#admin-logo-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="admin-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4ec9b0" />
                      <stop offset="100%" stopColor="#569cd6" />
                    </linearGradient>
                  </defs>
                  <path d="m18 16 4-4-4-4"/>
                  <path d="m6 8-4 4 4 4"/>
                  <path d="m14.5 4-5 16"/>
                </svg>
              </div>
              {!collapsed && (
                <h1 className="text-base font-black tracking-tight text-white whitespace-nowrap">
                  관리콘솔
                </h1>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                title="사이드바 접기"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* 접혔을 때 펼치기 버튼 */}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center p-1.5 mb-4 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="사이드바 펼치기"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M6 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {!collapsed && (
            <div className="px-2 space-y-1 text-sm mb-4">
              <p className="text-theme-secondary font-medium px-2 pb-2">메뉴</p>
            </div>
          )}

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ tab, label, icon }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-xl transition-all duration-200 border ${
                  collapsed ? 'px-2 py-2.5 justify-center' : 'px-4 py-3'
                } ${
                  activeTab === tab
                    ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                    : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 ${activeTab === tab ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {icon}
                </svg>
                {!collapsed && label}
              </button>
            ))}
          </nav>
        </div>

        {/* 하단 프로필 */}
        <div className="relative mt-auto pt-6">
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-[220px] bg-[#202020] border border-white/[0.08] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3 py-2.5 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#444] flex items-center justify-center shrink-0 text-xs font-semibold text-white">
                  {(userData?.displayName || user?.displayName || 'A')[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium text-white truncate leading-tight">
                    {userData?.displayName || user?.displayName || 'Admin'}
                  </span>
                  <span className="text-[11px] text-white/40 truncate leading-tight">{user?.email}</span>
                </div>
              </div>
              <div className="h-px bg-white/[0.06] mx-2 my-0.5" />
              <button
                onClick={() => { setIsMenuOpen(false); navigate('/home'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                홈으로 돌아가기
              </button>
              <div className="h-px bg-white/[0.06] mx-2 my-0.5" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </button>
            </div>
          )}

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title={collapsed ? (userData?.displayName || user?.displayName || 'Admin') : undefined}
            className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-[#444] flex items-center justify-center shrink-0 text-xs font-semibold text-white">
              {(userData?.displayName || user?.displayName || 'A')[0].toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="text-[13px] text-white/80 truncate flex-1 text-left">
                  {userData?.displayName || user?.displayName || 'Admin'}
                </span>
                <svg className={`w-3.5 h-3.5 text-white/30 shrink-0 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* 모바일 상단 바 */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-theme-sidebar border-b border-theme-border flex-shrink-0 relative z-20">
         <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-lg backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-theme-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 16 4-4-4-4"/>
                <path d="m6 8-4 4 4 4"/>
                <path d="m14.5 4-5 16"/>
              </svg>
            </div>
           관리콘솔
         </h1>
         <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="text-theme-secondary hover:text-white transition p-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
           <button onClick={onLogout} className="text-theme-secondary text-sm font-medium">
             로그아웃
           </button>
         </div>
      </header>

      {/* 모바일 탭 */}
      <div className="md:hidden flex overflow-x-auto border-b border-theme-border bg-theme-bg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'dashboard' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >대시보드</button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'rewards' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >리워드</button>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-3 md:px-[15px] md:pb-[15px] md:pt-[15px] overflow-y-auto overflow-x-auto">
        <div className={activeTab === 'seats' ? 'w-full' : 'max-w-5xl mx-auto'}>
          {activeTab === 'dashboard' && <StudentDashboard />}
          {activeTab === 'seats' && <SeatChart />}
          {activeTab === 'students' && <StudentManagement />}
          {activeTab === 'groups' && <GroupManagement />}
          {activeTab === 'teachers' && <TeacherManagement />}
          {activeTab === 'alerts' && <AlertsAndTop />}
          {activeTab === 'metaphors' && <MetaphorLibrary />}
          {activeTab === 'rewards' && <RewardPanel />}
          {activeTab === 'debug' && import.meta.env.DEV && <DebugPanel />}
        </div>
      </main>

    </div>
  );
};

export default AdminPage;
