import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import TeacherManagement from './TeacherManagement';
import GroupManagement from './GroupManagement';
import StudentManagement from './StudentManagement';
import StudentDashboard from './StudentDashboard';
import SeatChart from './SeatChart';
import AlertsAndTop from './AlertsAndTop';
import MetaphorLibrary from './MetaphorLibrary';
import RewardPanel from './RewardPanel';

const AdminPage = ({ user, userData, onLogout }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="h-svh bg-theme-bg text-white flex flex-col md:flex-row overflow-hidden">
      
      {/* 관리자 사이드바 (데스크톱) / 상단바 (모바일) */}
      <aside className="w-full md:w-64 bg-theme-sidebar border-r border-theme-border flex flex-col justify-between p-4 shrink-0 hidden md:flex">
        
        {/* 상단 (로고 및 탭 맵업) */}
        <div>
          <div className="flex items-center gap-3 p-2 rounded-xl mb-6">
            <div className="p-2 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-xl backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shadow-[0_0_15px_rgba(78,201,176,0.2)] shrink-0">
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
            <h1 className="text-2xl font-black tracking-tight text-white mb-0.5">
              Admin
            </h1>
          </div>

          <div className="px-2 space-y-1 text-sm mb-4">
            <p className="text-theme-secondary font-medium px-2 pb-2">메뉴</p>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'dashboard'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              학생 현황 대시보드
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'students'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'students' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354l8 4.354-8 4.354-8-4.354 8-4.354zm0 6l8 4.354-8 4.354-8-4.354 8-4.354zm0 6l8 4.354-8 4.354-8-4.354 8-4.354z" />
              </svg>
              학생 정보 관리
            </button>
            
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'groups' 
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]' 
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'groups' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              신규 그룹 생성
            </button>
            
            <button
              onClick={() => setActiveTab('teachers')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'teachers' 
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]' 
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'teachers' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              강사 등록
            </button>
            <button
              onClick={() => setActiveTab('seats')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'seats'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'seats' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              좌석 배치도
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'alerts'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'alerts' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              알림 · TOP3
            </button>
            <button
              onClick={() => setActiveTab('metaphors')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'metaphors'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'metaphors' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              메타포 라이브러리
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
                activeTab === 'rewards'
                  ? 'bg-[#4ec9b0]/10 border-[#4ec9b0]/30 text-[#4ec9b0] font-bold shadow-[0_0_15px_rgba(78,201,176,0.1)]'
                  : 'border-transparent text-gray-500 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <svg className={`w-4 h-4 shrink-0 ${activeTab === 'rewards' ? 'text-[#4ec9b0]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              리워드
            </button>
          </nav>
        </div>

        {/* 하단 프로필 및 설정 메뉴 */}
        <div className="relative mt-auto pt-6">
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-[#202020] border border-white/[0.08] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
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
            className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#444] flex items-center justify-center shrink-0 text-xs font-semibold text-white">
              {(userData?.displayName || user?.displayName || 'A')[0].toUpperCase()}
            </div>
            <span className="text-[13px] text-white/80 truncate flex-1 text-left">
              {userData?.displayName || user?.displayName || 'Admin'}
            </span>
            <svg className={`w-3.5 h-3.5 text-white/30 shrink-0 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>
        </div>
      </aside>

      {/* 모바일 상단 바 (관리자용) */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-theme-sidebar border-b border-theme-border flex-shrink-0 relative z-20">
         <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-lg backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-theme-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 16 4-4-4-4"/>
                <path d="m6 8-4 4 4 4"/>
                <path d="m14.5 4-5 16"/>
              </svg>
            </div>
           Admin
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

      {/* 모바일 탭 (헤더 바로 아래) */}
      <div className="md:hidden flex overflow-x-auto border-b border-theme-border bg-theme-bg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'dashboard' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >대시보드</button>
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'students' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >학생 관리</button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'groups' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >신규 그룹</button>
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'teachers' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >강사 등록</button>
        <button
          onClick={() => setActiveTab('seats')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'seats' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >좌석 배치</button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'alerts' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >알림·TOP3</button>
        <button
          onClick={() => setActiveTab('metaphors')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'metaphors' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >메타포</button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 py-3 px-4 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === 'rewards' ? 'border-theme-primary text-theme-primary' : 'border-transparent text-gray-400'
          }`}
        >리워드</button>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className={activeTab === 'seats' ? 'w-full' : 'max-w-5xl mx-auto'}>
          {activeTab === 'dashboard' && <StudentDashboard />}
          {activeTab === 'seats' && <SeatChart />}
          {activeTab === 'students' && <StudentManagement />}
          {activeTab === 'groups' && <GroupManagement />}
          {activeTab === 'teachers' && <TeacherManagement />}
          {activeTab === 'alerts' && <AlertsAndTop />}
          {activeTab === 'metaphors' && <MetaphorLibrary />}
          {activeTab === 'rewards' && <RewardPanel />}
        </div>
      </main>

    </div>
  );
};

export default AdminPage;
