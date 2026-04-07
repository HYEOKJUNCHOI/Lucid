import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, query, where, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import LucidLoader from '../../components/common/LucidLoader';

const StudentManagement = () => {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // 다중 선택 상태
  const [checkedIds, setCheckedIds] = useState([]);

  // 모달 상태 관리
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignMode, setAssignMode] = useState('single'); // 'single', 'batch', 'invite'
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let usersLoaded = false;
    let groupsLoaded = false;
    let invitesLoaded = false;

    const checkLoading = () => {
      if (usersLoaded && groupsLoaded && invitesLoaded) setLoading(false);
    };

    // 가입된 모든 유저 목록 (필요한 경우 UI에서 역할별로 필터링)
    const qUsers = collection(db, 'users');
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      usersLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("유저 목록 조회 실패 (규칙 필요):", err);
      usersLoaded = true;
      checkLoading();
    });

    // 가입 전 사전배정된 이메일 목록
    const unsubInvites = onSnapshot(collection(db, 'invited_students'), (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      invitesLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("초대 목록 불러오기 권한 필요:", err);
      invitesLoaded = true;
      checkLoading();
    });

    // 그룹 목록
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      groupsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("그룹 목록 조회 실패 (규칙 필요):", err);
      groupsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubUsers();
      unsubInvites();
      unsubGroups();
    };
  }, []);

  // 표시할 통합 학생 목록 (실제 가입 유저 + 가입 안한 사전할당 유저)
  const combinedList = [
    ...users.map(u => ({ ...u, isRegistered: true })),
    ...invites
      // 대소문자 구분 없이 이미 가입한 유저는 제외 (중복 방지)
      .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({ id: `invite_${inv.email}`, email: inv.email, displayName: inv.name ? `${inv.name}` : '이름 미상', phone: inv.phone, groupIDs: inv.groupIDs, isRegistered: false }))
  ];

  /* ------------------- 다중 선택 제어 ------------------- */
  const toggleCheck = (id) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCheckAll = () => {
    if (checkedIds.length === combinedList.length && combinedList.length > 0) {
      setCheckedIds([]);
    } else {
      setCheckedIds(combinedList.map(item => item.id));
    }
  };

  /* ------------------- 모달 오픈 ------------------- */
  const openSingleAssign = (userObj) => {
    setAssignMode('single');
    setSelectedUser(userObj);
    // 저장 시 normalizeToIds()가 이름→ID 변환을 처리하므로
    // 모달 오픈 시에는 원본 groupIDs를 그대로 사용 (타이밍 이슈로 groups 상태가 비어있으면 normalizedIds = [] 가 되는 버그 방지)
    setSelectedGroupIds(userObj.groupIDs || []);
    // 인적사항 정보 동기화
    setInviteName(userObj.displayName || '');
    setInvitePhone(userObj.phone || '');
    setInviteEmail(userObj.email || '');
    setIsModalOpen(true);
  };

  const openBatchAssign = () => {
    if (checkedIds.length === 0) return;
    setAssignMode('batch');
    setSelectedGroupIds([]); // 일괄 배정 시 기본적으로 선택 해제된 상태에서 덮어씌움
    setIsModalOpen(true);
  };

  const openInviteAssign = () => {
    setAssignMode('invite');
    setInviteEmail('');
    setInviteName('');
    setInvitePhone('');
    setSelectedGroupIds([]);
    setIsModalOpen(true);
  };

  const closeAssignModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setInviteEmail('');
    setInviteName('');
    setInvitePhone('');
    setSelectedGroupIds([]);
  };

  /* ------------------- 체크박스 토글 등 ------------------- */
  const toggleGroupSelection = (groupId) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // groupIDs 배열을 항상 Firebase 문서 ID로 정규화하는 헬퍼
  // 이름(name)으로 저장된 오염 데이터도 안전하게 ID로 변환
  const normalizeToIds = (rawIds) => {
    return rawIds.map(raw => {
      // 이미 유효한 ID인지 확인
      const byId = groups.find(g => g.id === raw);
      if (byId) return byId.id;
      // 이름으로 저장되어 있는 경우 → ID로 변환
      const byName = groups.find(g => g.name === raw);
      if (byName) return byName.id;
      return raw; // 알 수 없는 값은 그대로
    }).filter(Boolean);
  };

  // 실제 데이터 저장 분기
  const handleSaveGroups = async () => {
    setSaving(true);
    try {
      if (assignMode === 'single') {
        // 모달에서 선택한 상태를 그대로 저장 (체크 해제 = 제거)
        // 단, 저장 전 반드시 Firebase 문서 ID로 정규화
        const mergedGroups = [...new Set(normalizeToIds(selectedGroupIds))];

        // 안전장치: 기존에 그룹이 있었는데 전부 해제하면 확인 요청
        const hadGroups = (selectedUser.groupIDs || []).length > 0;
        if (hadGroups && mergedGroups.length === 0) {
          if (!window.confirm('소속 그룹을 전부 제거합니다. 계속할까요?')) {
            setSaving(false);
            return;
          }
        }
        const lowerEmail = (selectedUser.email || '').toLowerCase();

        if (selectedUser.isRegistered) {
          // 가입 유저: users 문서 업데이트
          const userRef = doc(db, 'users', selectedUser.id);
          await updateDoc(userRef, { 
            groupIDs: mergedGroups,
            displayName: inviteName.trim(),
            phone: invitePhone.trim()
          });
          // invited_students에도 동기화 (양쪽 컬렉션 일관성 유지)
          const inviteRef = doc(db, 'invited_students', lowerEmail);
          await setDoc(inviteRef, {
            email: lowerEmail,
            groupIDs: mergedGroups,
            name: inviteName.trim(),
            phone: invitePhone.trim()
          }, { merge: true });
        } else {
          // 미가입 유저: invited_students 문서 업데이트
          const inviteRef = doc(db, 'invited_students', lowerEmail);
          await setDoc(inviteRef, { 
            email: lowerEmail, 
            groupIDs: mergedGroups,
            name: inviteName.trim(),
            phone: invitePhone.trim()
          }, { merge: true });
        }
      } 
      else if (assignMode === 'batch') {
        const promises = checkedIds.map(async (sid) => {
          const target = combinedList.find(c => c.id === sid);
          if (!target) return;
          
          // 기존 그룹과 새 그룹 병합 (중복 제거)
          const currentGroups = normalizeToIds(target.groupIDs || []);
          const newGroups = normalizeToIds(selectedGroupIds);
          const mergedGroups = [...new Set([...currentGroups, ...newGroups])];

          if (target.isRegistered) {
            await updateDoc(doc(db, 'users', target.id), { groupIDs: mergedGroups });
          } else {
            await setDoc(doc(db, 'invited_students', target.email), { email: target.email, groupIDs: mergedGroups }, { merge: true });
          }
        });
        await Promise.all(promises);
        setCheckedIds([]);
        closeAssignModal();
      } 
      else if (assignMode === 'invite') {
        if (!inviteEmail.trim() || !inviteName.trim()) {
           alert("학생 이름과 이메일은 필수입니다.");
           setSaving(false);
           return;
        }
        const lowerEmail = inviteEmail.trim().toLowerCase();
        
        const payload = {
          email: lowerEmail,
          name: inviteName.trim(),
          phone: invitePhone.trim(),
          groupIDs: selectedGroupIds
        };

        // 이미 가입한 유저인지 확인 (모든 유저 대상)
        const q = query(collection(db, 'users'), where('email', '==', lowerEmail));
        const userSnap = await getDocs(q);
        
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          const userData = userDoc.data();
          const currentGroups = normalizeToIds(userData.groupIDs || []);
          const newGroups = normalizeToIds(selectedGroupIds);
          const mergedGroups = [...new Set([...currentGroups, ...newGroups])];

          await updateDoc(doc(db, 'users', userDoc.id), { 
            groupIDs: mergedGroups,
            displayName: inviteName.trim(), 
            phone: invitePhone.trim() 
          });
        } else {
          // 미가입 초대의 경우에도 기존 초대 정보가 있는지 확인 후 병합
          const inviteRef = doc(db, 'invited_students', lowerEmail);
          const inviteSnap = await getDoc(inviteRef);
          let finalGroups = selectedGroupIds;

          if (inviteSnap.exists()) {
            const currentInviteGroups = inviteSnap.data().groupIDs || [];
            finalGroups = [...new Set([...currentInviteGroups, ...selectedGroupIds])];
          }

          await setDoc(inviteRef, { 
            email: lowerEmail,
            name: inviteName.trim(),
            phone: invitePhone.trim(),
            groupIDs: finalGroups 
          }, { merge: true });
        }
      }
      alert('성공적으로 저장되었습니다!');
      closeAssignModal();
    } catch (err) {
      console.error('그룹 배정 실패:', err);
      alert('저장 중 권한 문제나 네트워크 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 학생 삭제 (개별 또는 일괄)
  const handleDeleteStudents = async (ids) => {
    if (!ids || ids.length === 0) return;
    const confirmMsg = ids.length === 1 
      ? "정말 이 학생을 삭제하시겠습니까?" 
      : `정말 선택한 ${ids.length}명의 학생을 모두 삭제하시겠습니까? (복구 불가능)`;
    
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const promises = ids.map(async (sid) => {
        const target = combinedList.find(c => c.id === sid);
        if (!target) return;
        
        if (target.isRegistered) {
          // 가입된 실제 유저 (users 컬렉션)
          await deleteDoc(doc(db, 'users', target.id));
        } else {
          // 사전 등록 유저 (invited_students 컬렉션)
          await deleteDoc(doc(db, 'invited_students', target.email));
        }
      });
      await Promise.all(promises);
      setCheckedIds(prev => prev.filter(id => !ids.includes(id)));
    } catch (err) {
      console.error('삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 그룹명 파싱 (뱃지 형태)
  const getGroupNames = (groupIds) => {
    if (!groupIds || groupIds.length === 0) return (
      <span className="text-gray-600 text-[12px] italic">배정된 그룹 없음</span>
    );
    
    return (
      <div className="flex flex-wrap gap-1.5">
        {groupIds.map(id => {
          const g = groups.find(group => group.id === id);
          if (!g) return null;
          return (
            <span 
              key={id} 
              className="px-2 py-0.5 bg-[#4ec9b0]/10 text-[#4ec9b0] text-[11px] font-bold rounded-md border border-[#4ec9b0]/20"
            >
              {g.name}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">학생 정보 및 그룹 반 배정</h2>
          <p className="text-gray-400 text-sm mt-1">이메일을 통해 학생 정보를 사전 등록하거나, 일괄적으로 반을 배정합니다.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {checkedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={openBatchAssign}
                className="px-6 py-2.5 bg-[#4ec9b0] text-black font-bold text-sm rounded-lg hover:bg-[#3db79e] transition-all whitespace-nowrap shadow-[0_0_20px_rgba(78,201,176,0.2)] flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                일괄 그룹 배정
              </button>
              <button
                onClick={() => handleDeleteStudents(checkedIds)}
                className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold text-sm border border-red-500/20 rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                선택 삭제
              </button>
            </div>
          )}
          <button
            onClick={openInviteAssign}
            className="px-6 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] text-white font-bold text-sm border border-white/10 rounded-lg transition-all whitespace-nowrap flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[#4ec9b0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            신규 학생 등록
          </button>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <LucidLoader text="Initializing Students..." />
        ) : combinedList.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록되거나 가입한 학생이 없습니다. 상단에서 학생 정보를 등록해주세요.</div>
        ) : (
          <div className="w-full overflow-x-auto text-left">
            <table className="w-full min-w-[700px] border-collapse">
              <thead className="bg-[#111111] border-b border-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-5 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-white/10 bg-black/50 text-[#4ec9b0] focus:ring-[#4ec9b0] focus:ring-offset-0"
                      checked={checkedIds.length === combinedList.length && combinedList.length > 0}
                      onChange={toggleCheckAll}
                    />
                  </th>
                  <th className="px-6 py-5 font-bold">학생 성명</th>
                  <th className="px-6 py-5 font-bold">로그인 이메일</th>
                  <th className="px-6 py-5 font-bold">소속 그룹(반)</th>
                  <th className="px-6 py-5 font-bold text-right">설정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {combinedList.map(u => {
                  const isUnassigned = !u.groupIDs || u.groupIDs.length === 0;
                  const isChecked = checkedIds.includes(u.id);

                  return (
                    <tr key={u.id} className={`transition-all duration-200 ${isChecked ? 'bg-[#4ec9b0]/5' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-white/10 bg-black/50 text-[#4ec9b0] focus:ring-[#4ec9b0] focus:ring-offset-0 cursor-pointer"
                          checked={isChecked}
                          onChange={() => toggleCheck(u.id)}
                        />
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px]">{u.displayName}</span>
                          {!u.isRegistered && (
                             <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#4ec9b0]/10 text-[#4ec9b0] border border-[#4ec9b0]/20">사전등록</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        {isUnassigned ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-500 border border-red-500/30">
                            미배정 (배정 대기)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.groupIDs.map(id => (
                              <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#4ec9b0]/10 text-[#4ec9b0] border border-[#4ec9b0]/20 whitespace-nowrap">
                                {groups.find(g => g.id === id)?.name || id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openSingleAssign(u)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-[11px] shadow-sm ${
                              isUnassigned
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                                : 'bg-white/[0.05] text-gray-400 hover:text-white border border-white/5 hover:border-white/10'
                            }`}
                          >
                            {isUnassigned ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                배정
                              </>
                            ) : '수정'}
                          </button>
                          <button
                            onClick={() => handleDeleteStudents([u.id])}
                            className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                            title="전체 삭제"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 할당/등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col scale-100 animate-fade-in-up">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {assignMode === 'invite' ? '신규 학생 정보 등록' : 
                   assignMode === 'batch' ? '일괄 그룹 배정' : '그룹 개별 배정'}
                </h3>
                <p className="text-xs text-theme-secondary mt-1">
                  {assignMode === 'single' && `${selectedUser.displayName} (${selectedUser.email})`}
                  {assignMode === 'batch' && `선택된 학생 총 ${checkedIds.length}명 대량 배정`}
                  {assignMode === 'invite' && `가입 전 학생의 인적사항을 시스템에 미리 등록합니다.`}
                </p>
              </div>
              <button onClick={closeAssignModal} className="text-theme-secondary hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] flex flex-col gap-4">
              
              {/* 상단 인적사항 폼 (초대 또는 개별 수정 시) */}
              {(assignMode === 'invite' || assignMode === 'single') && (
                <div className="flex flex-col gap-4 mb-2 p-4 bg-black/30 border border-theme-border rounded-xl">
                  {assignMode === 'single' && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="px-2 py-0.5 bg-theme-primary/10 text-theme-primary text-[10px] font-bold rounded border border-theme-primary/20 uppercase tracking-tight">
                        ID: {selectedUser?.id?.substring(0, 8)}...
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">실시간 정보 수정 중</div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-1.5">학생 이름 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="예: 홍길동"
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary transition"
                    />
                  </div>
                  {assignMode === 'invite' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1.5">구글 로그인에 사용된 이메일 <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="student@gmail.com"
                        className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary transition"
                      />
                    </div>
                  )}
                  {assignMode === 'single' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-300 mb-1.5">등록된 이메일 (변경 불가)</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        readOnly
                        disabled
                        className="w-full bg-black/30 border border-gray-800 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-gray-300 mb-1.5">연락처 (선택)</label>
                    <input
                      type="text"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-theme-primary focus:ring-1 focus:ring-theme-primary transition"
                    />
                  </div>
                </div>
              )}

              {/* 그룹 선택 리스트 */}
              <div>
                <label className="block text-sm font-bold text-gray-300 mb-2">소속될 그룹 (중복 선택 가능)</label>
                {groups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 border border-white/5 border-dashed rounded-2xl bg-white/[0.02] text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 text-gray-500">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-400">생성된 그룹이 없습니다.</p>
                    <p className="text-xs text-gray-500 mt-1">[신규 그룹 생성] 탭에서 먼저 그룹을 만들어주세요.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {groups.map(g => {
                      const isSelected = selectedGroupIds.includes(g.id);
                      return (
                        <label 
                          key={g.id} 
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected ? 'bg-theme-primary/10 border-theme-primary/50' : 'bg-black/30 border-theme-border hover:border-gray-500'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGroupSelection(g.id)}
                            className="w-5 h-5 rounded border-gray-600 bg-black/50 text-theme-primary focus:ring-theme-primary focus:ring-offset-black transition"
                          />
                          <span className={`font-semibold ${isSelected ? 'text-theme-primary' : 'text-gray-300'}`}>
                            {g.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <div className="px-6 py-4 bg-black/40 border-t border-[#2a2a2a] flex justify-end gap-3">
              <button 
                onClick={closeAssignModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white font-medium transition"
              >
                취소
              </button>
              <button 
                onClick={handleSaveGroups}
                disabled={saving || (assignMode === 'invite' && (!inviteEmail.trim() || !inviteName.trim()))}
                className="px-6 py-2.5 bg-[#4ec9b0] hover:bg-[#3db79e] text-black text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(78,201,176,0.2)] disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {saving ? '처리 중...' : 
                 assignMode === 'invite' ? '등록 완료' : 
                 assignMode === 'single' ? '수정 완료' : '일괄 배정 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentManagement;
