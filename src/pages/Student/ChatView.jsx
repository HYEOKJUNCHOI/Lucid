import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const ChatView = ({ teacher, repo, concept, onComplete, onBack }) => {
  const [code, setCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 모바일 탭: "code" | "chat"

  // GitHub에서 코드 불러오기
  useEffect(() => {
    const fetchCode = async () => {
      setCodeLoading(true);
      try {
        let url;
        if (concept.type === 'file') {
          // 직접 파일 URL로 코드 로드
          const fileRes = await fetch(concept.downloadUrl);
          setCode(await fileRes.text());
        } else if (concept.type === 'chapter') {
          // 챕터 모드: 해당 폴더의 파일 목록 → 첫 번째 파일 내용
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/contents/${concept.path}`
          );
          const files = await res.json();
          const javaFiles = files.filter((f) => f.name.endsWith('.java'));
          if (javaFiles.length > 0) {
            const fileRes = await fetch(javaFiles[0].download_url);
            setCode(await fileRes.text());
          }
        } else {
          // 날짜 모드: 해당 날짜의 커밋에서 변경된 파일 추출
          const res = await fetch(
            `https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/commits?since=${concept.name}T00:00:00Z&until=${concept.name}T23:59:59Z`
          );
          const commits = await res.json();
          if (commits.length > 0) {
            const detailRes = await fetch(commits[0].url);
            const detail = await detailRes.json();
            const javaFile = detail.files?.find((f) => f.filename.endsWith('.java'));
            if (javaFile?.raw_url) {
              const fileRes = await fetch(javaFile.raw_url);
              setCode(await fileRes.text());
            }
          }
        }
      } catch (e) {
        console.error('코드 로드 실패:', e);
        setCode('// 코드를 불러오지 못했습니다.');
      } finally {
        setCodeLoading(false);
      }
    };
    fetchCode();
  }, [teacher, repo, concept]);

  // GPT에게 메시지 보내기
  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // TODO: GPT API 호출 로직 구현
      // 현재는 플레이스홀더
      const assistantMsg = {
        role: 'assistant',
        content: 'GPT 응답이 여기에 표시됩니다. (API 연동 예정)',
      };
      setMessages([...newMessages, assistantMsg]);
    } catch (e) {
      console.error('GPT 호출 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100svh-8rem)]">
      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-300 self-start mb-4"
      >
        &larr; 뒤로
      </button>

      {/* 모바일 탭 전환 */}
      <div className="flex gap-2 md:hidden mb-4">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'code'
              ? 'bg-cyan-400 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          코드
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'chat'
              ? 'bg-cyan-400 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          채팅
        </button>
      </div>

      {/* PC: 2단 레이아웃 / 모바일: 탭 */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 코드 패널 */}
        <div
          className={`flex-1 bg-gray-900 rounded-lg p-4 overflow-auto ${
            activeTab !== 'code' ? 'hidden md:block' : ''
          }`}
        >
          {codeLoading ? (
            <p className="text-gray-400 text-sm">코드 불러오는 중...</p>
          ) : (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
              {code}
            </pre>
          )}
        </div>

        {/* 채팅 패널 */}
        <div
          className={`flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden ${
            activeTab !== 'chat' ? 'hidden md:flex' : ''
          }`}
        >
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-8">
                코드에 대해 질문해보세요
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-cyan-400/10 text-cyan-300 self-end max-w-[80%]'
                    : 'bg-gray-800 text-gray-300 self-start max-w-[80%]'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <p className="text-gray-400 text-sm">응답 생성 중...</p>
            )}
          </div>

          {/* 입력창 */}
          <div className="border-t border-gray-800 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              placeholder="질문을 입력하세요..."
              className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="bg-cyan-400 text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-cyan-300 transition disabled:opacity-50"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 학습 완료 버튼 */}
      <button
        onClick={() => onComplete({ level: 1, score: 0 })}
        className="mt-4 self-end bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-6 py-2 rounded-lg transition"
      >
        학습 완료
      </button>
    </div>
  );
};

export default ChatView;
