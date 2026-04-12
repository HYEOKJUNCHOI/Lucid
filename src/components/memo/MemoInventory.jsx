import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

export default function MemoInventory({ isOpen, onClose, onSelectMemo }) {
  const { user } = useAuth();
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    setLoading(true);
    const loadMemos = async () => {
      try {
        // Firestore에서 사용자의 메모 로드
        const docRef = await getDocs(
          query(
            collection(db, 'users', user.uid, 'meta'),
            where('__name__', '==', 'memo')
          )
        );

        // 단일 메모 문서 로드
        const memoDocSnap = await getDocs(
          query(collection(db, 'users', user.uid, 'meta'))
        );

        const memoList = [];
        memoDocSnap.forEach(doc => {
          if (doc.id === 'memo' && doc.data().content) {
            memoList.push({
              id: doc.id,
              content: doc.data().content,
              savedAt: doc.data().savedAt?.toDate?.() || new Date(),
              summary: doc.data().summary || '',
            });
          }
        });

        setMemos(memoList);
      } catch (err) {
        console.error('메모 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMemos();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const formatDate = (date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
  };

  const getPreview = (content) => {
    return content.slice(0, 100).replace(/\n/g, ' ').trim() + (content.length > 100 ? '...' : '');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
        style={{ background: '#111827', border: '1px solid rgba(167,139,250,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">📚 학습 메모 인벤토리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-400 text-sm animate-pulse">메모 불러오는 중...</span>
          </div>
        ) : memos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-gray-500 text-sm">저장된 메모가 없습니다.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {memos.map((memo) => (
              <button
                key={memo.id}
                onClick={() => {
                  onSelectMemo(memo);
                  onClose();
                }}
                className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-violet-400/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {formatDate(memo.savedAt)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {Math.ceil(memo.content.length / 100)} 섹션
                  </span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2">
                  {getPreview(memo.content) || '(비어있음)'}
                </p>
                {memo.summary && (
                  <p className="text-xs text-violet-300 mt-2">
                    📌 {memo.summary}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
