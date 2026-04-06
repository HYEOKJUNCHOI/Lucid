import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login/Login';
import StudentPage from './pages/Student/StudentPage';
import AdminPage from './pages/Admin/AdminPage';

function App() {
  const { user, userData, role, loading, loginLoading, loginError, loginWithGoogle, logout } = useAuth();

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

  if (!user) {
    return (
      <Login
        loginLoading={loginLoading}
        loginError={loginError}
        onLogin={loginWithGoogle}
      />
    );
  }

  // 권한 안전 장치 (DB 업데이트가 즉각 반영되지 않는 이슈 우회용)
  const isSuperAdmin = user?.email?.toLowerCase() === 'gurwns369@naver.com' || role === 'admin';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={isSuperAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/home" replace />} />
        <Route path="/home" element={<StudentPage user={user} userData={userData} onLogout={logout} />} />
        <Route path="/admin"   element={isSuperAdmin ? <AdminPage user={user} onLogout={logout} /> : <Navigate to="/home" replace />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
