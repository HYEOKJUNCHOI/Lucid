import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { getGeminiApiKey } from '../../lib/apiKey';
import { MODELS, GEMINI_CHAT_URL } from '../../lib/aiConfig';

const TODAY = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
});

const SLASH_COMMANDS = {
  '/구분선': '\n\n---\n\n',
  '/체크':   '- [ ] ',
  '/중요':   '> ⚠️ **중요:** ',
};

export default function MemoPanel() {
  const { user } = useAuth();
  const [content, setContent]             = useState('');
  const [savedContent, setSavedContent]   = useState('');
  const [mode, setMode]                   = useState('edit');
  const [isSaving, setIsSaving]           = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [saveMsg, setSaveMsg]             = useState('');
  const [summary, setSummary]             = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIndex, setSearchIndex]     = useState(0);
  const [codePopup, setCodePopup]         = useState(false);
  const [codeValue, setCodeValue]         = useState('');
  const [codeLang, setCodeLang]           = useState('java');

  const textareaRef   = useRef(null);
  const insertPosRef  = useRef(0);
  const previewRef    = useRef(null);
  const searchInputRef = useRef(null);
  const contentRef    = useRef('');
  contentRef.current  = content;

  // ── Firestore 로드 ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getDoc(doc(db, 'users', user.uid, 'meta', 'memo'))
      .then(snap => {
        if (snap.exists()) {
          const c = snap.data().content || '';
          setContent(c);
          setSavedContent(c);
          if (snap.data().summary) setSummary(snap.data().summary);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user]);

  // ── 저장 ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'meta', 'memo'), {
        content: contentRef.current,
        summary,
        savedAt: serverTimestamp(),
      });
      setSavedContent(contentRef.current);
      setSaveMsg('저장됨 ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('저장 실패');
      setTimeout(() => setSaveMsg(''), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [user, isSaving, summary]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // ── Ctrl+S / Ctrl+F 전역 핸들러 ─────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(v => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 50);
          return !v;
        });
      }
      if (e.key === 'Escape') {
        setSearchVisible(false);
        setCodePopup(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── 검색 매칭 ────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchMatches([]); setSearchIndex(0); return; }
    const lower = content.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matches = [];
    let i = 0;
    while (true) {
      const pos = lower.indexOf(q, i);
      if (pos === -1) break;
      matches.push(pos);
      i = pos + 1;
    }
    setSearchMatches(matches);
    setSearchIndex(0);
    scrollToMatch(matches, 0, searchQuery);
  }, [searchQuery, content]);

  const scrollToMatch = (matches, idx, q) => {
    if (!matches.length || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = matches[idx];
    ta.focus();
    ta.setSelectionRange(pos, pos + q.length);
    const lines = content.slice(0, pos).split('\n').length;
    ta.scrollTop = Math.max(0, (lines - 4) * 20);
  };

  const goNextMatch = (dir = 1) => {
    if (!searchMatches.length) return;
    const ni = (searchIndex + dir + searchMatches.length) % searchMatches.length;
    setSearchIndex(ni);
    scrollToMatch(searchMatches, ni, searchQuery);
  };

  // ── 슬래시 명령어 + /코드 감지 ────────────────────
  const handleChange = (e) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);

    // 슬래시 명령어 일반 (/구분선, /체크, /중요)
    for (const [cmd, insert] of Object.entries(SLASH_COMMANDS)) {
      const re = new RegExp(`(^|\\n)(${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`);
      if (re.test(before)) {
        const removeStart = before.lastIndexOf(cmd);
        const newContent = val.slice(0, removeStart) + insert + val.slice(cursor);
        setContent(newContent);
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = removeStart + insert.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return;
      }
    }

    // /요약 → AI 3줄 요약 실행
    if (/(^|\n)(\/요약)$/.test(before)) {
      const removeStart = before.lastIndexOf('/요약');
      setContent(val.slice(0, removeStart) + val.slice(cursor));
      setTimeout(() => handleSummarize(), 0);
      return;
    }

    // /코드 → Monaco 팝업
    if (/(^|\n)(\/코드)$/.test(before)) {
      const removeStart = before.lastIndexOf('/코드');
      setContent(val.slice(0, removeStart) + val.slice(cursor));
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
    setContent(content.slice(0, pos) + block + content.slice(pos));
    setCodePopup(false);
    setCodeValue('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // ── AI 3줄 요약 ────────────────────────────────────
  const handleSummarize = async () => {
    if (!content.trim() || isSummarizing) return;
    setIsSummarizing(true);
    setSummary('');
    try {
      const res = await fetch(
        `${GEMINI_CHAT_URL(MODELS.GEMINI_QUIZ)}?key=${getGeminiApiKey()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `다음 학습 메모를 핵심 내용 3줄로 요약해줘. 번호 붙여서, 각 줄은 짧고 명확하게.\n\n${content.slice(0, 3000)}` }],
            }],
            generationConfig: { temperature: 0.4 },
          }),
        }
      );
      const data = await res.json();
      setSummary(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '요약 실패');
    } catch {
      setSummary('요약 중 오류가 발생했습니다.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // ── 내보내기 ──────────────────────────────────────
  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lucid_메모_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const el = previewRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>Lucid 학습 메모</title>
<style>
@page{size:A4;margin:20mm}*{box-sizing:border-box}
body{font-family:'Pretendard','Malgun Gothic',sans-serif;font-size:11pt;color:#1a1a1a;line-height:1.7;background:#fff}
h1,h2,h3,h4{margin:1em 0 .4em;font-weight:700}
h1{font-size:18pt;border-bottom:2px solid #333;padding-bottom:4px}
h2{font-size:14pt;border-bottom:1px solid #ccc;padding-bottom:2px}
h3{font-size:12pt}p{margin:.4em 0}
ul,ol{padding-left:1.5em;margin:.3em 0}li{margin:.15em 0}
code{font-family:'Consolas',monospace;background:#f0f0f0;padding:1px 5px;border-radius:3px;font-size:10pt}
pre{background:#1e1e1e!important;color:#d4d4d4!important;padding:12px 16px;border-radius:6px;overflow-x:auto;margin:.6em 0;page-break-inside:avoid}
pre code{background:transparent;padding:0;font-size:9.5pt;color:inherit}
blockquote{border-left:3px solid #f59e0b;background:#fffbeb;margin:.5em 0;padding:8px 12px;border-radius:0 6px 6px 0;color:#555}
hr{border:none;border-top:1px solid #ddd;margin:1em 0}
table{border-collapse:collapse;width:100%;margin:.5em 0}th,td{border:1px solid #ccc;padding:5px 10px}th{background:#f5f5f5}
.hbar{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:16px}
.hbar .t{font-size:13pt;font-weight:700;color:#333}.hbar .d{font-size:9pt;color:#777}
</style></head><body>
<div class="hbar"><span class="t">📝 Lucid 학습 메모</span><span class="d">${TODAY}</span></div>
${el.innerHTML}
</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const isUnsaved = content !== savedContent;
  const LANGS = ['java', 'javascript', 'python', 'cpp', 'text'];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-gray-400 animate-pulse">메모 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">

      {/* 헤더 */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-300 font-semibold">학습 메모</span>
          <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5 gap-0.5">
            {['edit', 'preview'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                  mode === m ? 'bg-white/20 text-white font-semibold' : 'text-gray-400 hover:text-white'
                }`}
              >{m === 'edit' ? '편집' : '미리보기'}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{content.length.toLocaleString()}자</span>
          {saveMsg
            ? <span className="text-[10px] text-emerald-400">{saveMsg}</span>
            : <span className={`text-[10px] ${isUnsaved ? 'text-amber-400' : 'text-gray-500'}`}>{isUnsaved ? '● 미저장' : '저장됨'}</span>
          }
          <button onClick={handleSave} disabled={!user || isSaving || !isUnsaved}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
              isUnsaved && !isSaving
                ? 'border-violet-400/50 bg-violet-500/20 text-violet-200 hover:bg-violet-500/35 hover:text-white cursor-pointer'
                : 'border-white/[0.07] bg-white/[0.03] text-gray-600 cursor-default'
            }`}
          >{isSaving ? '저장 중...' : '저장 (Ctrl+S)'}</button>
        </div>
      </div>

      {/* 날짜 */}
      <div className="shrink-0 px-1">
        <span className="text-[14px] font-semibold text-white">{TODAY}</span>
      </div>

      {/* 검색바 */}
      {searchVisible && (
        <div className="shrink-0 flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1.5">
          <span className="text-[11px] text-gray-400">🔍</span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); goNextMatch(e.shiftKey ? -1 : 1); }
              if (e.key === 'Escape') setSearchVisible(false);
            }}
            placeholder="검색..."
            className="flex-1 bg-transparent text-[12px] text-gray-200 placeholder:text-gray-600 outline-none"
          />
          {searchMatches.length > 0 && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap">
              {searchIndex + 1} / {searchMatches.length}
            </span>
          )}
          {searchQuery && !searchMatches.length && (
            <span className="text-[10px] text-gray-600">없음</span>
          )}
          <div className="flex items-center gap-0.5">
            <button onClick={() => goNextMatch(-1)} className="text-[11px] text-gray-400 hover:text-white px-1 py-0.5 transition-colors">↑</button>
            <button onClick={() => goNextMatch(1)}  className="text-[11px] text-gray-400 hover:text-white px-1 py-0.5 transition-colors">↓</button>
            <button onClick={() => setSearchVisible(false)} className="text-[11px] text-gray-500 hover:text-gray-200 px-1 transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* 본문 영역 */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder={`배운 내용을 자유롭게 정리해보세요.\n\n/코드 · /구분선 · /체크 · /중요 · /요약`}
          className="flex-1 min-h-0 resize-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-[13px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/20 leading-relaxed font-[Pretendard,sans-serif]"
          spellCheck={false}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4">
          {content.trim() ? (
            <div
              ref={previewRef}
              className="prose prose-invert max-w-none
                prose-headings:text-gray-100 prose-headings:font-bold
                prose-h1:text-[17px] prose-h1:border-b prose-h1:border-white/10 prose-h1:pb-1
                prose-h2:text-[15px] prose-h2:border-b prose-h2:border-white/[0.07] prose-h2:pb-0.5
                prose-h3:text-[13px]
                prose-p:text-gray-300 prose-p:text-[13px] prose-p:my-1.5
                prose-li:text-gray-300 prose-li:text-[13px] prose-li:my-0.5
                prose-ul:my-1 prose-ol:my-1
                prose-strong:text-gray-100
                prose-code:text-[#9cdcfe] prose-code:bg-white/10 prose-code:px-1 prose-code:rounded prose-code:text-[12px]
                prose-pre:p-0 prose-pre:bg-transparent
                prose-blockquote:border-l-amber-400/60 prose-blockquote:bg-amber-500/[0.07] prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:text-amber-200 prose-blockquote:not-italic
                prose-hr:border-white/10
                prose-a:text-violet-400
                prose-table:text-[12px] prose-th:bg-white/[0.05] prose-th:text-gray-300 prose-td:text-gray-300"
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
                    return <code className={className} {...props}>{children}</code>;
                  },
                  input({ checked, ...props }) {
                    return <input type="checkbox" checked={checked} readOnly className="mr-1" {...props} />;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-[12px] text-gray-500">편집 탭에서 작성해보세요.</span>
            </div>
          )}
        </div>
      )}

      {/* AI 요약 고정 칸 */}
      <div className="shrink-0 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5" style={{ minHeight: 72 }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-amber-400/80">✨ AI 3줄 요약</span>
          <div className="flex items-center gap-1.5">
            {summary && <button onClick={() => setSummary('')} className="text-[10px] text-gray-600 hover:text-gray-300 transition-colors">지우기</button>}
            <button
              onClick={handleSummarize}
              disabled={isSummarizing || !content.trim()}
              className="text-[10px] px-2 py-0.5 rounded-md border border-amber-400/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-100 transition-all disabled:opacity-40 disabled:cursor-default"
            >
              {isSummarizing ? '생성 중...' : '생성'}
            </button>
          </div>
        </div>
        <div className="text-[11.5px] leading-relaxed whitespace-pre-line">
          {isSummarizing
            ? <span className="text-gray-500 animate-pulse">요약을 생성하고 있어요...</span>
            : summary
              ? <span className="text-gray-300">{summary}</span>
              : <span className="text-gray-600">메모를 작성한 뒤 생성 버튼을 눌러보세요.</span>
          }
        </div>
      </div>

      {/* 하단 바 */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] text-gray-500 px-1">
          /코드 · /구분선 · /체크 · /중요 · /요약 &nbsp;·&nbsp; Ctrl+F 검색
        </span>
        <div className="flex items-center gap-1.5">
          {/* 내보내기 */}
          {mode === 'preview' && (
            <button onClick={handlePrint}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >📄 PDF</button>
          )}
          <button onClick={handleDownloadMd}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >⬇️ .md</button>
          <button
            onClick={() => { if (!content.trim()) return; if (window.confirm('메모를 모두 지울까요?')) setContent(''); }}
            className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors px-2 py-1"
          >전체 지우기</button>
        </div>
      </div>

      {/* 코드 에디터 팝업 */}
      {codePopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 rounded-2xl">
          <div className="flex flex-col gap-3 bg-[#1a2227] border border-white/10 rounded-2xl p-4 w-[90%] max-w-[480px]"
               style={{ boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-gray-200">코드 삽입</span>
              <div className="flex items-center gap-1.5">
                {LANGS.map(l => (
                  <button key={l} onClick={() => setCodeLang(l)}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-all ${
                      codeLang === l
                        ? 'bg-violet-500/30 border border-violet-400/50 text-violet-200'
                        : 'text-gray-500 hover:text-gray-200'
                    }`}
                  >{l}</button>
                ))}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-white/[0.07]" style={{ height: 220 }}>
              <Editor
                height="220px" language={codeLang} value={codeValue}
                onChange={v => setCodeValue(v || '')} theme="vs-dark"
                options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', padding: { top: 8, bottom: 8 }, stickyScroll: { enabled: false } }}
                onMount={editor => { editor.focus(); editor.addCommand(2048 | 3, insertCodeBlock); }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCodePopup(false)}
                className="text-[11px] px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-200 transition-colors"
              >취소 (Esc)</button>
              <button onClick={insertCodeBlock}
                className="text-[11px] px-4 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-200 hover:bg-violet-500/35 hover:text-white transition-all font-bold"
              >삽입 (Ctrl+Enter)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
