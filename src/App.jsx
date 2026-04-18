import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import StudentPage from './pages/Student/StudentPage';
import MobileStudentRoot from './pages/Student/MobileStudentRoot';
import AdminPage from './pages/Admin/AdminPage';
import DictionaryPopup from './components/common/DictionaryPopup';
import { EditModeProvider } from './components/common/mobile/EditModeProvider';
import { useIsMobile } from './hooks/useMediaQuery';

/**
 * StudentRoot — 뷰포트 기반 분기 래퍼.
 * - 모바일(<768px): <MobileStudentRoot initialMode={...} />
 * - 데스크탑      : <StudentPage forcedMode={...} /> (기존 로직 유지)
 *
 * URL 체계는 기존과 동일하게 유지(북마크/딥링크 호환). 내부 렌더만 분기.
 */
function StudentRoot({ mode, user, userData, onLogout }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <MobileStudentRoot
        initialMode={mode}
        user={user}
        userData={userData}
        onLogout={onLogout}
      />
    );
  }
  return (
    <StudentPage
      user={user}
      userData={userData}
      onLogout={onLogout}
      forcedMode={mode}
    />
  );
}

function App() {
  const { user, userData, role, loading, loginLoading, loginError, loginWithGoogle, loginWithGithub, loginWithAdmin, loginOrSignupWithEmail, logout } = useAuth();

  // 인증 정보 확인 중이거나 로딩 중일 때
  if (loading || user === undefined) {
    return (
      <div className="flex items-center justify-center h-svh bg-theme-bg overflow-hidden">
        {/* 스피너 안에 Lucid 워드마크 + 아래 Loading 캡션 */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24">
            {/* 회전 링 */}
            <div className="absolute inset-0 border-4 border-theme-primary/15 border-t-theme-primary rounded-full animate-spin"></div>
            {/* 중앙 고정 워드마크 — LED 스윕 + RGB 글리치 섬광 (Loading 과 동일) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative text-[18px] font-black tracking-tight select-none">
                {/* Red 채널 섬광 */}
                <div className="absolute inset-0 text-[#ff2a6d] mix-blend-screen pointer-events-none animate-glitch-flash-red">Lucid</div>
                {/* Cyan 채널 섬광 */}
                <div className="absolute inset-0 text-[#00eaff] mix-blend-screen pointer-events-none animate-glitch-flash-cyan">Lucid</div>
                {/* 메인 텍스트: LED 스윕 */}
                <div
                  className="relative bg-clip-text text-transparent animate-led-sweep"
                  style={{
                    backgroundImage: 'linear-gradient(100deg, #7a9e8e 0%, #7a9e8e 42%, #ffffff 48%, #4ec9b0 50%, #ffffff 52%, #7a9e8e 58%, #7a9e8e 100%)',
                    backgroundSize: '250% 100%',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#7a9e8e',
                  }}
                >Lucid</div>
              </div>
            </div>
          </div>
          {/* 기본은 클린 LED 스윕, 주기적으로 아주 짧게 RGB 섬광만 파박 */}
          <div className="relative text-[11px] font-semibold tracking-wider uppercase select-none">
            {/* Red 채널 섬광 (대부분 숨김, 섬광 구간에만 ±1px) */}
            <div className="absolute inset-0 text-[#ff2a6d] mix-blend-screen pointer-events-none animate-glitch-flash-red">Loading</div>
            {/* Cyan 채널 섬광 */}
            <div className="absolute inset-0 text-[#00eaff] mix-blend-screen pointer-events-none animate-glitch-flash-cyan">Loading</div>
            {/* 메인 텍스트는 흔들림 없이 LED 스윕만 */}
            <div
              className="relative bg-clip-text text-transparent animate-led-sweep"
              style={{
                backgroundImage: 'linear-gradient(100deg, #7a9e8e 0%, #7a9e8e 42%, #ffffff 48%, #4ec9b0 50%, #ffffff 52%, #7a9e8e 58%, #7a9e8e 100%)',
                backgroundSize: '250% 100%',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#7a9e8e',
              }}
            >Loading</div>
          </div>
        </div>
      </div>
    );
  }

  // 권한 안전 장치 (DB 업데이트가 즉각 반영되지 않는 이슈 우회용)
  const isSuperAdmin = user?.email?.toLowerCase() === 'gurwns369@naver.com' || role === 'admin';

  // 보호 라우트 헬퍼 — 로그인 없으면 /login으로 리다이렉트
  const requireAuth = (el) => (user ? el : <Navigate to="/login" replace />);
  const studentRoot = (mode) => (
    <StudentRoot mode={mode} user={user} userData={userData} onLogout={logout} />
  );

  return (
    <BrowserRouter>
      <EditModeProvider>
      <DictionaryPopup />
      <Routes>
        {/* 로그인 페이지: 이미 로그인된 유저는 홈으로 */}
        <Route path="/login" element={
          user
            ? <Navigate to="/" replace />
            : <Login
                loginLoading={loginLoading}
                loginError={loginError}
                onLogin={loginWithGoogle}
                onGithubLogin={loginWithGithub}
                onAdminLogin={loginWithAdmin}
                onEmailLogin={loginOrSignupWithEmail}
              />
        } />

        {/* 루트: 비로그인은 랜딩, 로그인은 홈으로 (관리자도 동일) */}
        <Route path="/" element={
          !user
            ? <Landing />
            : <Navigate to="/home" replace />
        } />

        {/* 학생 보호 라우트 — 뷰포트 기반 분기(StudentRoot) */}
        <Route path="/home"         element={requireAuth(studentRoot(null))} />
        <Route path="/chapter"      element={requireAuth(studentRoot('chapter'))} />
        <Route path="/home/quest"   element={requireAuth(studentRoot('quest'))} />
        <Route path="/home/levelup" element={requireAuth(studentRoot('levelup'))} />
        <Route path="/study"        element={requireAuth(studentRoot('freeStudy'))} />
        {/* 구 URL 하위호환 */}
        <Route path="/home/chapter" element={requireAuth(studentRoot('chapter'))} />
        <Route path="/freestudy"    element={requireAuth(studentRoot('freeStudy'))} />

        {/* 관리자 보호 라우트 */}
        <Route path="/admin" element={
          !user
            ? <Navigate to="/login" replace />
            : isSuperAdmin
              ? <AdminPage user={user} userData={userData} onLogout={logout} />
              : <Navigate to="/home" replace />
        } />

        {/* 그 외 모든 경로 → 루트로 (루트가 다시 로그인 상태별로 분기) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </EditModeProvider>
    </BrowserRouter>
  );
}

export default App;
