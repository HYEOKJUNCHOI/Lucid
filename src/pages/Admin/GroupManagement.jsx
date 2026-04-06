import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidSelect from '../../components/common/LucidSelect';
import LucidLoader from '../../components/common/LucidLoader';

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 등록 폼 상태
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 그룹 데이터 및 강사 목록 실시간 모니터링
  useEffect(() => {
    let groupsLoaded = false;
    let teachersLoaded = false;

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      groupsLoaded = true;
      if (teachersLoaded) setLoading(false);
    }, (err) => {
      console.error("그룹 목록 조회 권한 에러:", err);
      groupsLoaded = true;
      if (teachersLoaded) setLoading(false);
    });

    const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      teachersLoaded = true;
      if (groupsLoaded) setLoading(false);
    }, (err) => {
      console.error("강사 목록 조회 권한 에러:", err);
      teachersLoaded = true;
      if (groupsLoaded) setLoading(false);
    });

    return () => {
      unsubGroups();
      unsubTeachers();
    };
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || !selectedTeacherId) {
      alert('그룹 이름과 담당 강사를 모두 선택해 주세요.');
      return;
    }
    
    setSubmitting(true);
    try {
      const newRef = doc(collection(db, 'groups'));
      await setDoc(newRef, {
        name: newGroupName.trim(),
        teacherId: selectedTeacherId
      });
      setNewGroupName('');
      setSelectedTeacherId('');
    } catch (err) {
      console.error('그룹 추가 실패:', err);
      alert('추가 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`정말로 '${name}' 그룹을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'groups', id));
    } catch (err) {
      console.error('그룹 삭제 실패:', err);
      alert('삭제 실패');
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">그룹(반) 관리</h2>
          <p className="text-gray-400 text-sm mt-1">학생들이 소속될 그룹을 생성하고 담당 강사를 매핑합니다.</p>
        </div>
      </div>

      {/* 등록 폼 */}
      <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl shadow-sm">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">그룹명</label>
          <input 
            type="text" 
            placeholder="반 이름 (예: 파이썬 기초반)" 
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0] focus:ring-1 focus:ring-[#4ec9b0] transition-all"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-500 uppercase ml-1">담당 강사</label>
          <LucidSelect 
            options={teachers.map(t => ({
              value: t.id,
              label: t.name,
              sublabel: t.githubRepo || 'No GitHub Repo'
            }))}
            value={selectedTeacherId}
            onChange={(val) => setSelectedTeacherId(val)}
            placeholder="담당 강사를 선택하세요"
          />
        </div>
        <button 
          type="submit" 
          disabled={submitting || teachers.length === 0 || !newGroupName.trim() || !selectedTeacherId}
          className="md:mt-5 bg-[#4ec9b0] hover:bg-[#3db79e] text-black font-bold px-8 py-3 rounded-xl transition-all whitespace-nowrap shadow-[0_0_20px_rgba(78,201,176,0.15)] disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed h-[50px]"
        >
          {submitting ? '생성 중...' : '신규 그룹 생성'}
        </button>
      </form>

      {/* 목록 리스트 */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <LucidLoader text="Initializing Groups..." />
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 그룹이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 p-4">
            {groups.map(g => {
              const matchedTeacher = teachers.find(t => t.id === g.teacherId);
              return (
                <div key={g.id} className="relative flex flex-col p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#4ec9b0]/30 transition-all duration-300 group shadow-sm min-h-[140px]">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-[#4ec9b0]/10 rounded-lg border border-[#4ec9b0]/20 text-[#4ec9b0]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <button 
                      onClick={() => handleDelete(g.id, g.name)}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <h3 className="text-[15px] font-bold text-white mb-2 group-hover:text-[#4ec9b0] transition-colors truncate" title={g.name}>{g.name}</h3>
                  
                  <div className="flex flex-col gap-0.5 mt-auto pt-3 border-t border-white/5">
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">담당 강사</span>
                    {matchedTeacher ? (
                      <span className="text-gray-300 font-medium text-[13px]">{matchedTeacher.name}</span>
                    ) : (
                      <span className="text-red-400 text-[13px] font-medium">강사 정보 없음</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupManagement;
