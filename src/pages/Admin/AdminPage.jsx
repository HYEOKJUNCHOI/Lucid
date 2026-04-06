const AdminPage = ({ user, onLogout }) => {
  return (
    <div className="min-h-svh bg-[#0f0f0f] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-tight">Lucid Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.displayName}</span>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="p-6">
        <p className="text-gray-400">관리자 화면 (Day 3에 구현 예정)</p>
      </main>
    </div>
  );
};

export default AdminPage;
