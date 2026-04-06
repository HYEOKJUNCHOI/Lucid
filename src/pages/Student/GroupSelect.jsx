import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const GroupSelect = ({ userId, onComplete }) => {
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'groups'));
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setGroups(list);
    } catch (e) {
      console.error('그룹 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const toggleGroup = (groupId) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    if (selectedGroupIds.length === 0) {
      alert('최소 1개 이상의 그룹을 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), { groupIDs: selectedGroupIds });
      onComplete(selectedGroupIds);
    } catch (error) {
      console.error('그룹 저장 실패:', error);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-6 bg-theme-bg text-theme-primary">
      <div className="max-w-md w-full animate-fade-in-up">
        <div className="relative p-8 md:p-10 rounded-[2rem] bg-theme-card/90 backdrop-blur-xl border border-theme-border shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden">
          {/* 장식 효과 */}
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-theme-primary/20 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />

          <div className="relative z-10 flex flex-col gap-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              그룹 선택
            </h2>
            <p className="text-sm text-gray-400">
              소속된 반이나 그룹을 모두 선택해 주세요. (여럿 선택 가능)
            </p>

            {loading ? (
              <div className="flex items-center gap-3 text-theme-primary font-medium py-4">
                <div className="w-5 h-5 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
                목록을 불러오는 중...
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-theme-border rounded-2xl bg-black/50">
                <p className="text-theme-secondary mb-2 text-sm">등록된 그룹이 없습니다.</p>
                <p className="text-theme-secondary text-xs">관리자에게 문의하여 그룹에 배정받으세요.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      disabled={saving}
                      onClick={() => toggleGroup(g.id)}
                      className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all outline-none ${
                        isSelected 
                          ? 'bg-theme-primary/10 border-theme-primary text-theme-primary' 
                          : 'border-theme-border bg-black/40 hover:border-gray-500 text-gray-300'
                      }`}
                    >
                      <span className="font-semibold">{g.name}</span>
                      {isSelected && (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={handleSave}
                  disabled={saving || selectedGroupIds.length === 0}
                  className="mt-6 w-full py-4 bg-theme-primary text-black font-bold rounded-xl shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none transition-all"
                >
                  선택 완료 및 시작하기
                </button>
              </div>
            )}

            {saving && <p className="text-sm text-theme-primary text-center mt-2 animate-pulse">그룹을 저장하고 설정 중입니다...</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupSelect;
