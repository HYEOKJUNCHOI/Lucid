import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login/Login';
import StudentPage from './pages/Student/StudentPage';
import AdminPage from './pages/Admin/AdminPage';

function App() {
  const { user, role, loading, loginLoading, loginError, loginWithGoogle, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-svh bg-[#0f0f0f] text-gray-400 text-sm">
        로딩 중...
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"       element={role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/student" replace />} />
        <Route path="/student" element={<StudentPage user={user} onLogout={logout} />} />
        <Route path="/admin"   element={role === 'admin' ? <AdminPage user={user} onLogout={logout} /> : <Navigate to="/student" replace />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
