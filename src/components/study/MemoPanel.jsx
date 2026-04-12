import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

export default function MemoPanel() {
  const { user } = useAuth();
  const [content, setContent]         = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [mode, setMode]               = useState('edit'); // 'edit' | 'preview'
  const [isSaving, setIsSaving]       = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');    // 저장 완료 메시지
  const [codePopup, setCodePopup]     = useState(false);
  const [codeValue, setCodeValue]     = useState('');
  const [codeLang, setCodeLang]       = useState('java');

  const textareaRef  = useRef(null);
  const insertPosRef = useRef(0);
  const previewRef   = useRef(null);
  const contentRef   = useRef('');
  contentRef.current = content;

  // ── Firestore 로드 ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const memoRef = doc(db, 'users', user.uid, 'meta', 'memo');
    getDoc(memoRef)
      .then(snap => {
        if (snap.exists()) {
          const c = snap.data().content || '';
          setContent(c);
          setSavedContent(c);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  // ── 저장 함수 ────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const memoRef = doc(db, 'users', user.uid, 'meta', 'memo');
      await setDoc(memoRef, { content: contentRef.current, savedAt: serverTimestamp() });
      setSavedContent(contentRef.current);
      setSaveMsg('저장됨');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('저장 실패');
      setTimeout(() => setSaveMsg(''), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [user, isSaving]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // ── Ctrl+S ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── /코드 감지 ────────────────────────────────────
  const handleChange = (e) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const cmdMatch = before.match(/(^|\n)(\/코드)$/);
    if (cmdMatch) {
      const removeStart = before.lastIndexOf('/코드');
      const newContent = val.slice(0, removeStart) + val.slice(cursor);
      setContent(newContent);
      insertPosRef.current = removeStart;
      setCodeValue('');
      setCodePopup(true);
      return;
    }
    setContent(val);
  };

  const insertCodeBlock = () => {
    if (!codeValue.trim()) { setCodePopup(false); return; }
    const block = `\`\`\`${codeLang}\n${codeValue}\n\`\`\`\n`;
    const pos = insertPosRef.current;
    const newContent = content.slice(0, pos) + block + content.slice(pos);
    setContent(newContent);
    setCodePopup(false);
    setCodeValue('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ── PDF 인쇄 ─────────────────────────────────────
  const handlePrint = () => {
    const el = previewRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Lucid 학습 메모</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.7;
      background: #fff;
    }
    h1, h2, h3, h4 { margin: 1em 0 0.4em; font-weight: 700; }
    h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 4px; }
    h2 { font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    h3 { font-size: 12pt; }
    p  { margin: 0.4em 0; }
    ul, ol { padding-left: 1.5em; margin: 0.3em 0; }
    li { margin: 0.15em 0; }
    code {
      font-family: 'Consolas', 'D2Coding', 'Courier New', monospace;
      background: #f0f0f0;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10pt;
    }
    pre {
      background: #1e1e1e !important;
      color: #d4d4d4 !important;
      padding: 12px 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.6em 0;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      padding: 0;
      font-size: 9.5pt;
      color: inherit;
    }
    blockquote {
      border-left: 3px solid #999;
      margin: 0.5em 0;
      padding-left: 12px;
      color: #555;
    }
    hr { border: none; border-top: 1px solid #ddd; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
    th, td { border: 1px solid #ccc; padding: 5px 10px; }
    th { background: #f5f5f5; }
    .header-bar {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 16px;
    }
    .header-bar .title { font-size: 13pt; font-weight: 700; color: #333; }
    .header-bar .date  { font-size: 9pt; color: #777; }
  </style>
</head>
<body>
  <div class="header-bar">
    <span class="title">📝 Lucid 학습 메모</span>
    <span class="date">${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  </div>
  ${el.innerHTML}
</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const isUnsaved = content !== savedContent;
  const LANGS = ['java', 'javascript', 'python', 'cpp', 'text'];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-gray-500 animate-pulse">메모 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 font-semibold">학습 메모</span>
          {/* 편집 / 미리보기 토글 */}
          <div className="flex items-center bg-white/[0.05] rounded-lg p-0.5 gap-0.5">
            {['edit', 'preview'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                  mode === m
                    ? 'bg-white/15 text-gray-200 font-semibold'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'edit' ? '편집' : '미리보기'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">{content.length.toLocaleString()}자</span>
          {/* 저장 상태 */}
          {saveMsg ? (
            <span className="text-[10px] text-emerald-400">{saveMsg}</span>
          ) : (
            <span className={`text-[10px] transition-colors ${isUnsaved ? 'text-amber-400/80' : 'text-gray-600'}`}>
              {isUnsaved ? '● 미저장' : '저장됨'}
            </span>
          )}
          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={!user || isSaving || !isUnsaved}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
              isUnsaved && !isSaving
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 cursor-pointer'
                : 'border-white/[0.06] bg-white/[0.03] text-gray-600 cursor-default'
            }`}
          >
            {isSaving ? '저장 중...' : '저장 (Ctrl+S)'}
          </button>
        </div>
      </div>

      {/* 본문 영역 */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder={`배운 내용을 자유롭게 정리해보세요.\n\n## 제목\n- 항목\n\`\`\`java\n// 코드 블록\n\`\`\`\n\n/코드  ← 입력하면 코드 에디터가 열려요`}
          className="flex-1 min-h-0 resize-none bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-[13px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/15 leading-relaxed font-[Pretendard,sans-serif]"
          spellCheck={false}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-white/[0.03] border border-white/[0.07] rounded-xl px-5 py-4">
          {content.trim() ? (
            <div
              ref={previewRef}
              className="prose prose-invert max-w-none
                prose-headings:text-gray-200 prose-headings:font-bold
                prose-h1:text-[17px] prose-h1:border-b prose-h1:border-white/10 prose-h1:pb-1
                prose-h2:text-[15px] prose-h2:border-b prose-h2:border-white/[0.07] prose-h2:pb-0.5
                prose-h3:text-[13px]
                prose-p:text-gray-300 prose-p:text-[13px] prose-p:my-1.5 prose-p:leading-relaxed
                prose-li:text-gray-300 prose-li:text-[13px] prose-li:my-0.5
                prose-ul:my-1 prose-ol:my-1
                prose-strong:text-gray-100
                prose-code:text-[#9cdcfe] prose-code:bg-white/10 prose-code:px-1 prose-code:rounded prose-code:text-[12px]
                prose-pre:p-0 prose-pre:bg-transparent
                prose-blockquote:border-l-white/20 prose-blockquote:text-gray-400
                prose-hr:border-white/10
                prose-a:text-violet-400"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (!inline && match) {
                      return (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: '10px', margin: '6px 0', fontSize: '12px' }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    }
                    return (
                      <code className={className} {...props}>{children}</code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-[12px] text-gray-600">아직 내용이 없어요. 편집 탭에서 작성해보세요.</span>
            </div>
          )}
        </div>
      )}

      {/* 하단 */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] text-gray-600 px-1">
          {mode === 'edit' ? '/코드 → 코드 삽입  ·  Ctrl+S 저장' : ''}
        </span>
        <div className="flex items-center gap-2">
          {mode === 'preview' && (
            <button
              onClick={handlePrint}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-all"
            >📄 PDF 저장</button>
          )}
          <button
            onClick={() => {
              if (!content.trim()) return;
              if (window.confirm('메모를 모두 지울까요?')) setContent('');
            }}
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors px-2 py-1"
          >전체 지우기</button>
        </div>
      </div>

      {/* 미니 코드 에디터 팝업 */}
      {codePopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-2xl">
          <div
            className="flex flex-col gap-3 bg-[#1a2227] border border-white/10 rounded-2xl p-4 w-[90%] max-w-[480px] shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-gray-300">코드 삽입</span>
              <div className="flex items-center gap-1.5">
                {LANGS.map(l => (
                  <button
                    key={l}
                    onClick={() => setCodeLang(l)}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-all ${
                      codeLang === l
                        ? 'bg-violet-500/30 border border-violet-400/50 text-violet-200'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >{l}</button>
                ))}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/[0.07]" style={{ height: 220 }}>
              <Editor
                height="220px"
                language={codeLang}
                value={codeValue}
                onChange={v => setCodeValue(v || '')}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  padding: { top: 8, bottom: 8 },
                  stickyScroll: { enabled: false },
                }}
                onMount={(editor) => {
                  editor.focus();
                  editor.addCommand(2048 | 3, insertCodeBlock);
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCodePopup(false)}
                className="text-[11px] px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
              >취소 (Esc)</button>
              <button
                onClick={insertCodeBlock}
                className="text-[11px] px-4 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-200 hover:bg-violet-500/30 transition-all font-bold"
              >삽입 (Ctrl+Enter)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
