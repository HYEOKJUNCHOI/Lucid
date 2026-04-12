/**
 * PlacementView — 배치고사
 * GitHub 코드 fetch → FreeStudyQuiz 전체화면
 */
import { useState, useEffect } from 'react';
import FreeStudyQuiz from '../../components/study/FreeStudyQuiz';

const PlacementView = ({ teacher, repo, chapters, chapterFilesMap, onBack, onPlaced }) => {
  const [phase, setPhase] = useState('intro'); // intro | loading | ready
  const [code, setCode] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [allFiles, setAllFiles] = useState([]);

  useEffect(() => {
    const flat = [];
    Object.values(chapterFilesMap || {}).forEach(files => {
      if (Array.isArray(files)) files.forEach(f => flat.push(f));
    });
    setAllFiles(flat);
  }, [chapterFilesMap]);

  const startPlacement = async () => {
    setPhase('loading');
    setLoadingMsg('파일 불러오는 중...');

    try {
      let pool = [...allFiles];

      if (pool.length === 0 && chapters?.length > 0) {
        for (const ch of chapters.slice(0, 5)) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${ch.path || ch.name}`
            );
            const items = await res.json();
            if (Array.isArray(items)) {
              items
                .filter(f => f.name.endsWith('.java') || f.name.endsWith('.js') || f.name.endsWith('.py'))
                .forEach(f => pool.push({ name: f.name, downloadUrl: f.download_url, path: f.path }));
            }
          } catch {}
        }
      }

      if (pool.length === 0) {
        setCode('// 샘플 코드\npublic class Sample {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}');
        setPhase('ready');
        return;
      }

      setLoadingMsg('코드 읽어오는 중...');
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, Math.min(3, shuffled.length));

      const snippets = await Promise.all(
        picked.map(async (f) => {
          try {
            const r = await fetch(f.downloadUrl);
            const text = await r.text();
            return `// ${f.name}\n${text.substring(0, 1000)}`;
          } catch {
            return '';
          }
        })
      );

      setCode(snippets.filter(Boolean).join('\n\n---\n\n'));
      setPhase('ready');
    } catch {
      setCode('// 코드를 불러오지 못했습니다');
      setPhase('ready');
    }
  };

  // ─── INTRO ──────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#0d0d0d' }}>
      <div className="max-w-sm w-full mx-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.12))', boxShadow: '0 0 24px rgba(245,158,11,0.15)' }}>
            <span className="text-3xl">🎯</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">배치고사</h2>
          <p className="text-sm text-gray-400">레포 코드를 분석해서 실력에 맞는 위치를 찾아드립니다</p>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: '#111', border: '1px solid #222' }}>
          <p className="text-[11px] text-gray-500 font-bold mb-3 tracking-widest">어떻게 진행되나요?</p>
          <div className="flex flex-col gap-2.5">
            {[
              { icon: '📂', text: '레포에서 코드 파일을 가져옵니다' },
              { icon: '🤖', text: 'AI가 코드 기반으로 문제를 생성합니다' },
              { icon: '🎯', text: '결과에 따라 시작 위치를 추천해드립니다' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base">{icon}</span>
                <span className="text-[12px] text-gray-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-white transition-all"
            style={{ border: '1px solid #333' }}>
            돌아가기
          </button>
          <button onClick={startPlacement}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 16px rgba(245,158,11,0.1)' }}>
            시작하기 →
          </button>
        </div>
      </div>
    </div>
  );

  // ─── LOADING ────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#0d0d0d' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: 'rgba(245,158,11,0.2)', borderTopColor: '#f59e0b' }} />
        <p className="text-sm text-gray-400">{loadingMsg}</p>
      </div>
    </div>
  );

  // ─── READY: FreeStudyQuiz 전체화면 ──────────────────
  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0d1117' }}>
      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 px-4 shrink-0"
        style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-white transition-colors"
        >
          ← 나가기
        </button>
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="text-[12px] font-bold text-gray-400">🎯 배치고사</span>
      </div>

      {/* FreeStudyQuiz */}
      <div className="flex-1 flex flex-col min-h-0">
        <FreeStudyQuiz
          getCodeContext={() => code}
          onSendToTutor={null}
          onHighlightToken={null}
        />
      </div>
    </div>
  );
};

export default PlacementView;
