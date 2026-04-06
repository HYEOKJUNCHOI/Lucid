import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const TeacherSelect = ({ onSelect }) => {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Firestore에서 강사 목록 불러오기
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const snap = await getDocs(collection(db, 'teachers'));
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTeachers(list);
      } catch (e) {
        console.error('강사 목록 로드 실패:', e);
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();
  }, []);

  // 강사 선택 시 GitHub API로 레포 목록 조회
  useEffect(() => {
    if (!selectedTeacher) return;
    const fetchRepos = async () => {
      setLoadingRepos(true);
      setRepos([]);
      try {
        const res = await fetch(
          `https://api.github.com/users/${selectedTeacher.githubUsername}/repos?per_page=100&sort=updated`
        );
        const data = await res.json();
        // 레포명에서 과목 라벨 파싱: "korit_9_gov_java" → "java"
        const parsed = data
          .filter((r) => !r.fork)
          .map((r) => {
            const match = r.name.match(/_gov_(.+)$/);
            return {
              name: r.name,
              label: match ? match[1] : r.name,
              description: r.description || '',
            };
          });
        setRepos(parsed);
      } catch (e) {
        console.error('레포 목록 로드 실패:', e);
      } finally {
        setLoadingRepos(false);
      }
    };
    fetchRepos();
  }, [selectedTeacher]);

  if (loadingTeachers) {
    return <p className="text-gray-400 text-sm">강사 목록 불러오는 중...</p>;
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <h2 className="text-lg font-semibold">강사를 선택하세요</h2>

      {/* 강사 드롭다운 */}
      <select
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400"
        value={selectedTeacher?.id || ''}
        onChange={(e) => {
          const t = teachers.find((t) => t.id === e.target.value);
          setSelectedTeacher(t || null);
        }}
      >
        <option value="">-- 강사 선택 --</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* 레포 목록 */}
      {loadingRepos && (
        <p className="text-gray-400 text-sm">레포 목록 불러오는 중...</p>
      )}

      {!loadingRepos && repos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400">과목을 선택하세요</p>
          {repos.map((r) => (
            <button
              key={r.name}
              onClick={() => onSelect(selectedTeacher, r)}
              className="text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-400 rounded-lg px-4 py-3 transition"
            >
              <span className="text-cyan-400 font-medium">{r.label}</span>
              {r.description && (
                <span className="text-gray-500 text-xs ml-2">
                  {r.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherSelect;
