import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidSelect from '../../components/common/LucidSelect';
import LucidLoader from '../../components/common/LucidLoader';
import Toast, { showToast } from '../../components/common/Toast';

const GroupManagement = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 등록 폼 상태
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 그룹 편집 상태
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editTeacherId, setEditTeacherId] = useState('');
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);

  // 수업 기간 저장 상태 (그룹별)
  const [dateSaving, setDateSaving] = useState({});

  // 강사 등록 모달 상태
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUsername, setNewTeacherUsername] = useState('');
  const [addingTeacher, setAddingTeacher] = useState(false);

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherUsername.trim()) return;
    const isDuplicate = teachers.some(t =>
      t.name === newTeacherName.trim() ||
      (t.githubUsername && t.githubUsername === newTeacherUsername.trim())
    );
    if (isDuplicate) { showToast('이미 동일한 이름이나 유저네임을 사용하는 강사가 존재합니다.', 'warn'); return; }
    setAddingTeacher(true);
    try {
      const newRef = doc(collection(db, 'teachers'));
      await setDoc(newRef, { name: newTeacherName.trim(), githubUsername: newTeacherUsername.trim() });
      setNewTeacherName('');
      setNewTeacherUsername('');
      setShowTeacherModal(false);
    } catch (err) {
      showToast('강사 등록 실패', 'error');
    } finally {
      setAddingTeacher(false);
    }
  };

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
      showToast('그룹 이름과 담당 강사를 모두 선택해 주세요.', 'warn');
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
      showToast('추가 실패', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = async (groupId, field, value) => {
    setDateSaving(prev => ({ ...prev, [groupId]: true }));
    try {
      await updateDoc(doc(db, 'groups', groupId), { [field]: value });
    } catch (err) {
      showToast('날짜 저장 실패', 'error');
    } finally {
      setDateSaving(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const startEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditTeacherId(g.teacherId || '');
  };

  const handleUpdateGroup = async (id) => {
    if (!editTeacherId) return;
    setIsUpdatingGroup(true);
    try {
      await updateDoc(doc(db, 'groups', id), { teacherId: editTeacherId });
      setEditingGroupId(null);
    } catch (err) {
      console.error('그룹 수정 실패:', err);
      showToast('수정 실패', 'error');
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`정말로 '${name}' 그룹을 삭제하시겠습니까?`)) return;
    try {
      await deleteDoc(doc(db, 'groups', id));
    } catch (err) {
      console.error('그룹 삭제 실패:', err);
      showToast('삭제 실패', 'error');
    }
  };

  return (
    <>
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">수업 등록</h2>
          <p className="text-gray-400 text-sm mt-1">학생들이 소속될 그룹을 생성하고 담당 강사를 매핑합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowTeacherModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500 border border-purple-500/30 text-purple-400 hover:text-white font-bold text-sm transition-all whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            강사 등록
          </button>
          <button
            onClick={() => navigate('/admin?tab=dashboard')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 font-bold text-sm transition-all whitespace-nowrap"
          >
            ↩ 뒤로
          </button>
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
              sublabel: t.githubUsername || ''
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
              const isEditing = editingGroupId === g.id;
              return (
                <div key={g.id} className={`relative flex flex-col p-4 rounded-xl border transition-all duration-300 group shadow-sm min-h-[140px] ${isEditing ? 'border-[#4ec9b0]/40 bg-white/[0.05]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#4ec9b0]/30'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-[#4ec9b0]/10 rounded-lg border border-[#4ec9b0]/20 text-[#4ec9b0]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <button
                          onClick={() => startEditGroup(g)}
                          className="text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                          title="강사 변경"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(g.id, g.name)}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-[15px] font-bold text-white mb-2 group-hover:text-[#4ec9b0] transition-colors truncate" title={g.name}>{g.name}</h3>

                  <div className="flex flex-col gap-0.5 mt-auto pt-3 border-t border-white/5">
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">담당 강사</span>
                    {isEditing ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <LucidSelect
                          options={teachers.map(t => ({ value: t.id, label: t.name, sublabel: t.githubUsername || t.githubRepo || '' }))}
                          value={editTeacherId}
                          onChange={(val) => setEditTeacherId(val)}
                          placeholder="강사 선택"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="flex-1 text-xs text-gray-400 hover:text-white py-1.5 rounded-lg border border-white/10 transition"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleUpdateGroup(g.id)}
                            disabled={isUpdatingGroup || !editTeacherId}
                            className="flex-1 text-xs bg-[#4ec9b0] hover:bg-[#3db79e] text-black font-bold py-1.5 rounded-lg transition disabled:opacity-50"
                          >
                            {isUpdatingGroup ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      </div>
                    ) : matchedTeacher ? (
                      <span className="text-gray-300 font-medium text-[13px]">{matchedTeacher.name}</span>
                    ) : (
                      <span className="text-red-400 text-[13px] font-medium">강사 정보 없음</span>
                    )}
                  </div>

                  {/* 수업 기간 */}
                  <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-white/5">
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">수업 기간</span>
                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-600 w-7 shrink-0">개강</span>
                        <input
                          type="date"
                          value={g.startDate || ''}
                          onChange={(e) => handleDateChange(g.id, 'startDate', e.target.value)}
                          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-[#4ec9b0]/50"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-600 w-7 shrink-0">종강</span>
                        <input
                          type="date"
                          value={g.endDate || ''}
                          onChange={(e) => handleDateChange(g.id, 'endDate', e.target.value)}
                          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-[#4ec9b0]/50"
                        />
                      </div>
                      {dateSaving[g.id] && <span className="text-[9px] text-gray-600 italic">저장 중...</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 강사 등록 모달 */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-[90vw] md:max-w-md shadow-2xl animate-fade-in-up max-h-[85dvh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">강사 등록</h3>
              <button onClick={() => setShowTeacherModal(false)} className="text-gray-500 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddTeacher} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">강사 성함</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">GitHub 유저네임</label>
                <input
                  type="text"
                  placeholder="예: code1218"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  value={newTeacherUsername}
                  onChange={(e) => setNewTeacherUsername(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowTeacherModal(false)} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white transition">취소</button>
                <button
                  type="submit"
                  disabled={addingTeacher || !newTeacherName.trim() || !newTeacherUsername.trim()}
                  className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingTeacher ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    <Toast />
    </>
  );
};

export default GroupManagement;
