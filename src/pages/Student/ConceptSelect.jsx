import { useState, useEffect } from 'react';

const ConceptSelect = ({ teacher, repo, mode, onSelect, onBack }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        if (mode === 'chapter') {
          // GitHub API로 레포의 디렉토리 구조를 읽어 챕터(폴더) 목록 추출
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents`
          );
          const data = await res.json();
          const folders = data
            .filter((item) => item.type === 'dir')
            .map((item) => ({
              name: item.name,
              path: item.path,
              type: 'chapter',
            }));
          setItems(folders);
        } else {
          // 날짜 모드: 커밋 날짜별로 그룹핑
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/commits?per_page=100`
          );
          const data = await res.json();
          // 날짜별 그룹핑 (YYYY-MM-DD)
          const dateMap = {};
          data.forEach((commit) => {
            const date = commit.commit.author.date.split('T')[0];
            if (!dateMap[date]) {
              dateMap[date] = { name: date, path: date, type: 'date', count: 0 };
            }
            dateMap[date].count += 1;
          });
          setItems(Object.values(dateMap).sort((a, b) => b.name.localeCompare(a.name)));
        }
      } catch (e) {
        console.error('목록 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [teacher, repo, mode]);

  if (loading) {
    return <p className="text-gray-400 text-sm">목록 불러오는 중...</p>;
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-300 self-start"
      >
        &larr; 뒤로
      </button>

      <h2 className="text-lg font-semibold">
        {mode === 'chapter' ? '챕터를 선택하세요' : '날짜를 선택하세요'}
      </h2>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">항목이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.name}
              onClick={() => onSelect(item)}
              className="text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-400 rounded-lg px-4 py-3 transition"
            >
              <span className="text-white">{item.name}</span>
              {item.count && (
                <span className="text-gray-500 text-xs ml-2">
                  커밋 {item.count}개
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConceptSelect;
