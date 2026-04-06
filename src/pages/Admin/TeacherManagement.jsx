import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';

const TeacherManagement = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 새로운 강사 등록 폼 상태
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 강사 수정 상태
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRepo, setEditRepo] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'teachers'), 
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTeachers(list);
        setLoading(false);
      },
      (err) => {
        console.error('강사 목록 불러오기 에러:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim()) return;
    
    // 중복 검사
    const isDuplicate = teachers.some(t => 
      t.name === newName.trim() || 
      (t.githubRepo && t.githubRepo === newUsername.trim()) || 
      (t.githubUsername && t.githubUsername === newUsername.trim())
    );

    if (isDuplicate) {
      alert('이미 동일한 이름이나 레포지토리를 사용하는 강사가 존재합니다.');
      return;
    }

    setSubmitting(true);
    try {
      // 문서 ID를 자동 생성
      const newRef = doc(collection(db, 'teachers'));
      await setDoc(newRef, {
        name: newName.trim(),
        githubRepo: newUsername.trim()
      });
      setNewName('');
      setNewUsername('');
    } catch (err) {
      console.error('강사 추가 실패:', err);
      alert('추가 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`정말로 '${name}' 강사님을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
    } catch (err) {
      console.error('강사 삭제 실패:', err);
      alert('삭제 실패');
    }
  };

  const startEditing = (t) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditRepo(t.githubRepo || t.githubUsername || '');
  };

  const handleUpdate = async (id) => {
    if (!editName.trim() || !editRepo.trim()) return;

    // 중복 검사 (본인 제외)
    const isDuplicate = teachers.some(t => 
      t.id !== id && (
        t.name === editName.trim() || 
        (t.githubRepo && t.githubRepo === editRepo.trim()) ||
        (t.githubUsername && t.githubUsername === editRepo.trim())
      )
    );

    if (isDuplicate) {
      alert('해당 이름이나 레포지토리는 이미 다른 강사가 사용 중입니다.');
      return;
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'teachers', id), {
        name: editName.trim(),
        githubRepo: editRepo.trim()
      });
      setEditingId(null);
    } catch (err) {
      console.error('강사 수정 실패:', err);
      alert('수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">강사 관리</h2>
          <p className="text-gray-400 text-sm mt-1">시스템에 등록된 강사 목록을 확인하고 관리합니다.</p>
        </div>
      </div>

      {/* 등록 폼 */}
      <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">강사 성함</label>
          <input 
            type="text" 
            placeholder="예: 홍길동" 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0] focus:ring-1 focus:ring-[#4ec9b0] transition-all"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">GitHub 레포지토리 URL</label>
          <input 
            type="text" 
            placeholder="https://github.com/..." 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0] focus:ring-1 focus:ring-[#4ec9b0] transition-all"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={submitting || !newName.trim() || !newUsername.trim()}
          style={{ 
            opacity: (submitting || !newName.trim() || !newUsername.trim()) ? 0.5 : 1,
            cursor: (submitting || !newName.trim() || !newUsername.trim()) ? 'not-allowed' : 'pointer'
          }}
          className="md:mt-5 bg-[#4ec9b0] hover:bg-[#3db79e] text-black font-bold px-8 py-3 rounded-xl transition-all whitespace-nowrap shadow-[0_0_20px_rgba(78,201,176,0.15)] disabled:shadow-none h-[50px]"
        >
          {submitting ? '등록 중...' : '신규 강사 등록'}
        </button>
      </form>

      {/* 목록 리스트 */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <LucidLoader text="Initializing Teachers..." />
        ) : teachers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 강사가 없습니다.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {teachers.map(t => (
              editingId === t.id ? (
                <div key={t.id} className="flex flex-col md:flex-row items-center gap-4 p-5 bg-white/[0.04] transition-all animate-fade-in border-y border-[#4ec9b0]/20">
                  <div className="flex-1 w-full md:w-auto">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="강사 성함"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#4ec9b0] focus:ring-1 focus:ring-[#4ec9b0] transition-all"
                    />
                  </div>
                  <div className="flex-[2] w-full md:w-auto">
                    <input
                      type="text"
                      value={editRepo}
                      onChange={(e) => setEditRepo(e.target.value)}
                      placeholder="GitHub 레포지토리 URL"
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-4 py-2.5 text-white shadow-inner focus:outline-none focus:border-[#4ec9b0] focus:ring-1 focus:ring-[#4ec9b0] transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
                    <button 
                      onClick={() => setEditingId(null)}
                      className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition"
                    >
                      취소
                    </button>
                    <button 
                      onClick={() => handleUpdate(t.id)}
                      disabled={isUpdating || !editName.trim() || !editRepo.trim()}
                      style={{ 
                        opacity: (isUpdating || !editName.trim() || !editRepo.trim()) ? 0.5 : 1,
                        cursor: (isUpdating || !editName.trim() || !editRepo.trim()) ? 'not-allowed' : 'pointer'
                      }}
                      className="bg-[#4ec9b0] hover:bg-[#3db79e] text-black text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(78,201,176,0.2)]"
                    >
                      {isUpdating ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="flex items-center justify-between p-5 hover:bg-white/[0.03] transition-all group">
                  <div className="flex flex-row items-center gap-6 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-gray-500 group-hover:text-[#4ec9b0] transition-colors font-bold text-sm">
                        {t.name[0]}
                      </div>
                      <span className="text-white font-bold whitespace-nowrap text-lg tracking-tight">{t.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 truncate max-w-md font-mono group-hover:border-[#4ec9b0]/20 transition-colors">
                      {t.githubRepo || t.githubUsername}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => startEditing(t)}
                      className="text-gray-500 hover:text-blue-400 transition-colors p-2"
                      title="강사 정보 수정"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id, t.name)}
                      className="text-gray-500 hover:text-red-400 transition-colors p-2"
                      title="강사 삭제"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherManagement;
