import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import StudentPage from './pages/Student/StudentPage';
import AdminPage from './pages/Admin/AdminPage';
import DictionaryPopup from './components/common/DictionaryPopup';

function App() {
  const { user, userData, role, loading, loginLoading, loginError, loginWithGoogle, loginWithGithub, logout } = useAuth();

  // 인증 정보 확인 중이거나 로딩 중일 때
  if (loading || user === undefined) {
    return (
      <div className="flex items-center justify-center h-svh bg-theme-bg overflow-hidden">
        {/* 아주 깔끔한 최소 로딩 화면 */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin"></div>
          <div className="text-theme-primary/40 text-[11px] font-medium tracking-widest uppercase italic">Initializing...</div>
        </div>
      </div>
    );
  }

  // 권한 안전 장치 (DB 업데이트가 즉각 반영되지 않는 이슈 우회용)
  const isSuperAdmin = user?.email?.toLowerCase() === 'gurwns369@naver.com' || role === 'admin';

  // 보호 라우트 헬퍼 — 로그인 없으면 /login으로 리다이렉트
  const requireAuth = (el) => (user ? el : <Navigate to="/login" replace />);
  const studentPage = <StudentPage user={user} userData={userData} onLogout={logout} />;

  return (
    <BrowserRouter>
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
              />
        } />

        {/* 루트: 비로그인은 랜딩, 로그인은 권한에 따라 분기 */}
        <Route path="/" element={
          !user
            ? <Landing />
            : isSuperAdmin
              ? <Navigate to="/admin" replace />
              : <Navigate to="/home" replace />
        } />

        {/* 학생 보호 라우트 */}
        <Route path="/home"         element={requireAuth(studentPage)} />
        <Route path="/home/chapter" element={requireAuth(studentPage)} />
        <Route path="/home/quest"   element={requireAuth(studentPage)} />
        <Route path="/home/levelup" element={requireAuth(studentPage)} />

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
    </BrowserRouter>
  );
}

export default App;
