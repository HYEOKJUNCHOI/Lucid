import { useState } from 'react';
import { saveApiKey, hasPersonalApiKey, getApiKey } from '../../lib/apiKey';

const ApiKeyModal = ({ onClose }) => {
  const [input, setInput] = useState(() => {
    const k = localStorage.getItem('lucid_openai_api_key') || '';
    return k;
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (input && !input.startsWith('sk-')) {
      setError('올바른 OpenAI API 키는 sk- 로 시작합니다.');
      return;
    }
    saveApiKey(input);
    setSaved(true);
    setError('');
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const handleDelete = () => {
    saveApiKey('');
    setInput('');
    setSaved(false);
  };

  const isPersonal = hasPersonalApiKey();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[420px] bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h2 className="text-white font-bold text-base">내 OpenAI API 키</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none transition-colors">×</button>
        </div>

        {/* 상태 뱃지 */}
        <div className={`text-xs px-3 py-1.5 rounded-lg w-fit ${isPersonal ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
          {isPersonal ? '✅ 개인 키 사용 중' : '⚠️ 공용 키 사용 중 (기본값)'}
        </div>

        {/* 설명 */}
        <p className="text-gray-400 text-xs leading-relaxed">
          본인의 OpenAI API 키를 입력하면 이후 모든 AI 기능이 내 키로 동작합니다.<br />
          키는 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>

        {/* 입력 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-gray-500">API 키 (sk-...)</label>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            className="bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50 font-mono placeholder:text-gray-600"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 mt-1">
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-sm font-medium transition-colors border border-cyan-500/20"
          >
            {saved ? '✅ 저장됨' : '저장'}
          </button>
          {isPersonal && (
            <button
              onClick={handleDelete}
              className="py-2 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors border border-red-500/20"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition-colors"
          >
            취소
          </button>
        </div>

        {/* 안내 링크 */}
        <p className="text-gray-600 text-[10px] text-center">
          API 키 발급: platform.openai.com → API Keys
        </p>
      </div>
    </div>
  );
};

export default ApiKeyModal;
