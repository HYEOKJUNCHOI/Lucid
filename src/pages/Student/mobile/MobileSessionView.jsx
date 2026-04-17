import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import haptic from '@/lib/haptic';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import SegmentedControl from '@/components/common/mobile/SegmentedControl';
import HapticButton from '@/components/common/mobile/HapticButton';
import ActionSheet from '@/components/common/mobile/ActionSheet';

/**
 * MobileSessionView — 학생이 챕터 > 파일 선택 후 실제 학습하는 세션 화면 (모바일 전용).
 * 데스크탑 ChatView 의 모바일 이식 버전. Monaco 미사용(읽기 전용 정책).
 *
 * @param {object} props
 * @param {string} props.fileId   학습할 파일 ID
 * @param {() => void} [props.onExit]  뒤로가기 핸들러 (기본: history.back)
 */
export default function MobileSessionView({ fileId, onExit }) {
  const { user } = useAuth();

  // ─── 탭 상태 ──────────────────────────────────────
  const [tab, setTab] = useState('code');

  // ─── 파일/세션 데이터 ─────────────────────────────
  const [file, setFile] = useState(null);
  const [fileLoading, setFileLoading] = useState(true);

  // ─── 튜터 채팅 상태 ───────────────────────────────
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ─── 퀴즈 상태 ────────────────────────────────────
  const [quiz] = useState({
    question: '이 코드의 핵심 동작은 무엇인가요?',
    options: [
      '데이터를 정렬한다',
      '입출력을 처리한다',
      '반복문으로 순회한다',
      '조건 분기만 수행한다',
    ],
    answerIndex: 2,
  });
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizResult, setQuizResult] = useState(null); // 'correct' | 'wrong' | null

  // ─── 메모 상태 ────────────────────────────────────
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState('');
  const memoDebounceRef = useRef(null);

  // ─── 액션시트 상태 ────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);

  // ─── 뒤로가기 ─────────────────────────────────────
  const handleExit = useCallback(() => {
    haptic.tap();
    if (onExit) onExit();
    else if (typeof window !== 'undefined') window.history.back();
  }, [onExit]);

  // ─── Firestore: 파일 문서 구독 ────────────────────
  useEffect(() => {
    if (!fileId) {
      setFileLoading(false);
      return;
    }
    setFileLoading(true);
    const unsub = onSnapshot(
      doc(db, 'files', fileId),
      (snap) => {
        setFile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setFileLoading(false);
      },
      () => setFileLoading(false),
    );
    return () => unsub();
  }, [fileId]);

  // ─── Firestore: 메모 로드 ─────────────────────────
  useEffect(() => {
    if (!user || !fileId) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid, 'fileMemos', fileId),
      (snap) => {
        if (snap.exists()) setMemo(snap.data().content || '');
      },
      () => {},
    );
    return () => unsub();
  }, [user, fileId]);

  // ─── 메모 debounce 저장 ───────────────────────────
  const saveMemo = useCallback(
    async (content) => {
      if (!user || !fileId) return;
      try {
        await setDoc(doc(db, 'users', user.uid, 'fileMemos', fileId), {
          content,
          savedAt: serverTimestamp(),
        });
        setMemoSaved('저장됨 ✓');
        setTimeout(() => setMemoSaved(''), 1500);
      } catch {
        setMemoSaved('저장 실패');
        setTimeout(() => setMemoSaved(''), 1500);
      }
    },
    [user, fileId],
  );

  const handleMemoChange = (e) => {
    const val = e.target.value;
    setMemo(val);
    if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
    memoDebounceRef.current = setTimeout(() => saveMemo(val), 500);
  };

  useEffect(() => {
    return () => {
      if (memoDebounceRef.current) clearTimeout(memoDebounceRef.current);
    };
  }, []);

  // ─── 채팅 스크롤 하단 고정 ────────────────────────
  useEffect(() => {
    if (tab !== 'tutor') return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, chatLoading, tab]);

  // ─── 메시지 전송 (목업) ───────────────────────────
  // TODO: 실제 Gemini/OpenAI API 연결. 현재는 플레이스홀더 응답.
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    haptic.tap();
    setChatInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const reply = `"${text}" 에 대해 더 자세히 알려드릴게요. (TODO: 실제 AI API 연결)`;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      haptic.selection();
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ─── 퀴즈 정답 제출 ───────────────────────────────
  const handleSubmitQuiz = () => {
    if (selectedOption === null || quizResult) return;
    const isCorrect = selectedOption === quiz.answerIndex;
    if (isCorrect) {
      haptic.success();
      setQuizResult('correct');
    } else {
      haptic.error();
      setQuizResult('wrong');
    }
  };

  const handleResetQuiz = () => {
    haptic.tap();
    setSelectedOption(null);
    setQuizResult(null);
  };

  // ─── 액션시트 메뉴 ────────────────────────────────
  const sheetActions = useMemo(
    () => [
      {
        label: '북마크 추가',
        icon: '🔖',
        onPress: () => {
          // TODO: 실제 북마크 서비스 연결
        },
      },
      {
        label: '신고하기',
        icon: '🚩',
        destructive: true,
        onPress: () => {
          // TODO: 실제 신고 서비스 연결
        },
      },
    ],
    [],
  );

  // ─── SegmentedControl 탭 ──────────────────────────
  const tabs = [
    { id: 'code',  label: '💻 코드' },
    { id: 'tutor', label: '💬 튜터' },
    { id: 'quiz',  label: '🎯 퀴즈' },
    { id: 'memo',  label: '📝 메모' },
  ];

  // ─── 로딩 ─────────────────────────────────────────
  if (fileLoading) {
    return (
      <div
        className="flex items-center justify-center h-dvh-safe bg-theme-bg text-theme-primary"
      >
        <span className="animate-spin text-2xl">⏳</span>
      </div>
    );
  }

  // ─── 엠프티 스테이트 ──────────────────────────────
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh-safe bg-theme-bg px-6 gap-3">
        <span className="text-4xl">📄</span>
        <p className="text-sm text-gray-400 text-center">
          파일을 찾을 수 없어요.
        </p>
        <HapticButton variant="secondary" size="md" onClick={handleExit}>
          돌아가기
        </HapticButton>
      </div>
    );
  }

  const appBar = (
    <MobileTopBar
      leading="close"
      onLeadingClick={handleExit}
      title={file?.name || '학습'}
      largeTitle={false}
      blurBg={false}
      transparent={false}
      actions={
        <HapticButton
          variant="ghost"
          size="sm"
          hapticType="selection"
          onClick={() => setSheetOpen(true)}
          className="min-w-[44px]"
        >
          <span className="text-xl leading-none">⋯</span>
        </HapticButton>
      }
    />
  );

  return (
    <Screen appBar={appBar} bottomTab={false} onBack={handleExit}>
      <div className="flex flex-col min-h-0 flex-1">
        {/* SegmentedControl */}
        <div className="px-4 pt-3 pb-2 shrink-0 bg-theme-bg">
          <SegmentedControl items={tabs} value={tab} onChange={setTab} />
        </div>

        {/* 탭 콘텐츠 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto relative">
          {tab === 'code' && <CodeTab file={file} />}
          {tab === 'tutor' && (
            <TutorTab
              messages={messages}
              chatLoading={chatLoading}
              chatEndRef={chatEndRef}
            />
          )}
          {tab === 'quiz' && (
            <QuizTab
              quiz={quiz}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
              quizResult={quizResult}
              onReset={handleResetQuiz}
            />
          )}
          {tab === 'memo' && (
            <MemoTab memo={memo} onChange={handleMemoChange} savedMsg={memoSaved} />
          )}
        </div>

        {/* 탭별 하단 액션 (safe-area 고려) */}
        {tab === 'tutor' && (
          <div
            className="shrink-0 bg-theme-card border-t border-theme-border px-3 py-2 flex items-center gap-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="튜터에게 질문해보세요"
              className="flex-1 h-11 px-4 rounded-full bg-theme-bg border border-theme-border text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-theme-primary/50"
            />
            <HapticButton
              variant="primary"
              size="md"
              hapticType="tap"
              disabled={!chatInput.trim() || chatLoading}
              onClick={handleSendMessage}
              className="shrink-0 px-5"
            >
              {chatLoading ? '...' : '전송'}
            </HapticButton>
          </div>
        )}

        {tab === 'quiz' && (
          <div
            className="shrink-0 bg-theme-card border-t border-theme-border px-4 py-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
          >
            {quizResult ? (
              <HapticButton
                variant="secondary"
                size="lg"
                hapticType="tap"
                onClick={handleResetQuiz}
                className="w-full"
              >
                다시 풀기
              </HapticButton>
            ) : (
              <HapticButton
                variant="primary"
                size="lg"
                hapticType="none"
                disabled={selectedOption === null}
                onClick={handleSubmitQuiz}
                className="w-full"
              >
                정답 제출
              </HapticButton>
            )}
          </div>
        )}

        {tab === 'memo' && memoSaved && (
          <div
            className="shrink-0 bg-theme-card border-t border-theme-border px-4 py-2 text-center text-xs text-emerald-400"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
          >
            {memoSaved}
          </div>
        )}
      </div>

      {/* ⋯ 액션시트 */}
      <ActionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={file?.name}
        actions={sheetActions}
      />
    </Screen>
  );
}

// ─── 💻 코드 탭 ──────────────────────────────────────
function CodeTab({ file }) {
  const code = file?.code ?? file?.content ?? '';
  const description = file?.description ?? '';
  const language = file?.language ?? 'java';

  if (!code) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-500">
        코드가 아직 준비되지 않았어요.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 pb-6">
      <div className="rounded-xl overflow-hidden border border-theme-border">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '12px',
            fontSize: '12px',
            lineHeight: 1.55,
            background: 'rgba(0,0,0,0.3)',
          }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>

      {description && (
        <div className="rounded-xl border border-theme-border bg-theme-card px-4 py-3">
          <p className="text-xs font-semibold text-theme-primary mb-1.5">
            💡 코드 설명
          </p>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 💬 튜터 탭 ──────────────────────────────────────
function TutorTab({ messages, chatLoading, chatEndRef }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {messages.length === 0 && !chatLoading && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <span className="text-3xl">💬</span>
          <p className="text-sm text-gray-400">
            궁금한 점을 편하게 물어보세요.
          </p>
        </div>
      )}

      {messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            m.role === 'user'
              ? 'self-end bg-theme-primary text-theme-bg rounded-br-md'
              : 'self-start bg-theme-card border border-theme-border text-gray-200 rounded-bl-md'
          }`}
        >
          {m.content}
        </div>
      ))}

      {chatLoading && (
        <div className="self-start max-w-[60%] px-4 py-3 rounded-2xl rounded-bl-md bg-theme-card border border-theme-border">
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '240ms' }} />
          </span>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}

// ─── 🎯 퀴즈 탭 ──────────────────────────────────────
function QuizTab({ quiz, selectedOption, setSelectedOption, quizResult, onReset }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="rounded-xl bg-theme-card border border-theme-border px-4 py-3">
        <p className="text-xs font-semibold text-theme-primary mb-1">문제</p>
        <p className="text-base text-white leading-relaxed">{quiz.question}</p>
      </div>

      <div className="flex flex-col gap-2">
        {quiz.options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isAnswer = quiz.answerIndex === idx;
          const showCorrect = quizResult && isAnswer;
          const showWrong = quizResult === 'wrong' && isSelected && !isAnswer;

          let tone =
            'border-theme-border bg-theme-card text-gray-200 active:bg-white/10';
          if (showCorrect) {
            tone = 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200';
          } else if (showWrong) {
            tone = 'border-red-400/60 bg-red-500/15 text-red-200';
          } else if (isSelected) {
            tone = 'border-theme-primary/60 bg-theme-primary/15 text-white';
          }

          return (
            <HapticButton
              key={idx}
              as="div"
              variant="ghost"
              size="lg"
              hapticType="selection"
              disabled={!!quizResult}
              onClick={() => setSelectedOption(idx)}
              className={`!justify-start !font-medium text-left w-full border ${tone} !rounded-2xl !px-4 !h-auto !py-3`}
            >
              <span className="mr-3 w-6 h-6 shrink-0 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </span>
              <span className="text-sm leading-snug whitespace-pre-wrap">
                {opt}
              </span>
            </HapticButton>
          );
        })}
      </div>

      {quizResult && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            quizResult === 'correct'
              ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200'
              : 'bg-red-500/15 border border-red-400/40 text-red-200'
          }`}
        >
          {quizResult === 'correct'
            ? '🎉 정답이에요! 잘했어요.'
            : '😅 아쉬워요. 정답을 다시 확인해보세요.'}
          <button
            onClick={onReset}
            className="ml-2 underline text-xs opacity-80"
          >
            다시 풀기
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 📝 메모 탭 ──────────────────────────────────────
function MemoTab({ memo, onChange, savedMsg }) {
  return (
    <div className="flex flex-col p-3 gap-2 h-full">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-500">이 파일에 대한 학습 메모</span>
        {savedMsg && (
          <span className="text-[10px] text-emerald-400">{savedMsg}</span>
        )}
      </div>
      <textarea
        value={memo}
        onChange={onChange}
        placeholder="배운 점, 궁금한 점, 다시 볼 포인트를 자유롭게 적어보세요."
        className="flex-1 min-h-[320px] resize-none bg-theme-card border border-theme-border rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 leading-relaxed focus:outline-none focus:border-theme-primary/50"
        spellCheck={false}
      />
    </div>
  );
}
