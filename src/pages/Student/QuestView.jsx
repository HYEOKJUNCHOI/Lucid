import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getApiKey } from '../../lib/apiKey';
import { auth } from '../../lib/firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { addDailyXP, onQuestComplete, syncStreakToFirestore, getStreakMultiplier, getQuestRepeatCount, recordQuestRepeat, getQuestDropRate, rollBeanDrop, getBeanCount } from '../../services/learningService';
import BeanRewardCard from '../../components/common/BeanRewardCard';

// ─── 파일 확장자 → Monaco language ──────────────
const extToLang = (name) => {
  const ext = name?.split('.').pop()?.toLowerCase();
  return { java:'java', js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript', py:'python', html:'html', css:'css', jsp:'html' }[ext] || 'plaintext';
};

// ─── 로딩 멘트 ─────────────────────────────────
const LOADING_MSGS = {
  prepare: ['오늘 볼 코드 준비하는 중...', '퀘스트 세팅하는 중...', '코드 꺼내오는 중...'],
  explain: ['쉬운 비유 떠올리는 중...', '이해하기 쉽게 정리하는 중...', '현실 세계에서 예시 찾는 중...'],
  easier: ['더 쉬운 예시 생각중...', '초등학생도 알아듣게 바꾸는 중...', '새로운 비유 준비중...'],
  quiz: ['딱 맞는 문제 고르는 중...', '실력 확인 문제 만드는 중...', '명확한 문제만 골라내는 중...'],
  easierQuiz: ['더 쉬운 문제 준비하는 중...', '기초부터 다시 물어볼게...'],
};
const pickMsg = (key) => { const arr = LOADING_MSGS[key] || LOADING_MSGS.prepare; return arr[Math.floor(Math.random() * arr.length)]; };

// ─── 프롬프트 ──────────────────────────────────
const EXPLAIN_PROMPT = `당신은 코딩 국비교육 멘토입니다. 다음 코드를 **완전 초보자**에게 설명합니다.

## 어휘 규칙 (가장 중요)
- 묵시적 → "말 안 해도 알아서", 명시적 → "직접 말해주는"
- 캐스팅 → "마법사가 마법 쓰듯, 타입을 바꾸는 것"
- 업캐스팅 → "작은 그릇 → 큰 그릇으로 옮기기 (당연히 됨)"
- 다운캐스팅 → "큰 그릇 → 작은 그릇으로 옮기기 (넘칠 수 있으니 직접 말해줘야 함)"
- 파라미터 → "재료", 리턴 → "결과물", 변수 → "이름표 붙은 상자"
- 프로그래밍 전문용어가 나오면 반드시 괄호 안에 일상 표현을 넣으세요

## 비유 규칙
- 돈 비유: 1.5원은 없으니까 double이 필요 (달러 → 원 환전 느낌)
- 게임 비유: 캐스팅은 게임에서 마법 쓰는 것, int→long은 레벨업
- 일상 비유: byte→int는 텀블러→양동이, 컵 크기 생각

## 무시할 코드
- package, import 줄은 설명하지 마세요. 아예 언급하지 마세요.
- 클래스 선언부(public class ...)도 간단히만 넘어가세요.
- 실제 로직이 있는 줄에 집중하세요.

## 형식
1. **한 줄 요약**: 이 코드가 뭐 하는 코드인지 한 문장
2. **줄별 해석**: 중요한 줄마다 쉬운 말로 설명 (코드 인용 포함)
3. **핵심 정리**: 기억할 것 2~3개 bullet

마크다운 사용. 코드 인용 시 \`backtick\` 사용.`;

const EASIER_PROMPT = `학생이 이전 설명을 이해하지 못했습니다. 단어도 어렵고, 예시도 와닿지 않았습니다.
**단어와 비유 둘 다** 완전히 바꿔서 처음부터 다시 설명해주세요.

## 단어 규칙
- 한자어/영어 금지. 순우리말이나 초등학생도 아는 표현만
- "~입니다" 대신 "~이야/~거야" 말투 (친구한테 말하듯)
- 한 문장에 개념 하나만. 길면 끊어

## 비유 규칙 (이전과 완전히 다른 비유를 써야 함)
- 이전에 컵/그릇 비유 썼으면 → 이번엔 택배 상자, 서랍, 가방 등
- 이전에 돈 비유 썼으면 → 이번엔 게임 아이템, 레벨, 경험치 등
- 이전에 게임 비유 썼으면 → 이번엔 편의점, 학교, 요리 등
- 학생의 일상에서 매일 접하는 것으로 비유 (배달앱, 유튜브, 카톡 등)

## 설명 방식
- 코드 한 줄씩 짚으면서 "이건 ~하는 거야" 식으로
- 왜 이렇게 써야 하는지 이유를 꼭 말해줘 ("안 그러면 ~돼서 문제야")
- 마지막에 한 줄 요약: "결국 이 코드는 ~하는 코드야"

절대 이전 설명을 반복하지 마. 구조도 비유도 전부 새로 써.`;

// ─── 난이도 필터 ────────────────────────────────
const getDiffLevel = () => parseInt(localStorage.getItem('lucid_difficulty_level') || '1');
const setDiffLevel = (lv) => localStorage.setItem('lucid_difficulty_level', String(Math.max(0, Math.min(4, lv))));
const adjustDifficulty = (correct) => {
  const cur = getDiffLevel();
  setDiffLevel(correct ? cur + 1 : cur - 1);
};

const DIFF_LABELS = ['왕초보', '초보', '기본', '중급', '고급'];

// ─── 퀴즈 프롬프트 (3문제 세트) ─────────────────
const buildQuizPrompt = (fileName, codeText, diffLevel, isEasier = false) => {
  const diffLabel = DIFF_LABELS[diffLevel] || '기본';
  return `아래 [코드]만 보고 확인 문제 3개를 만드세요. 난이도: ${diffLabel}${isEasier ? ' (이전보다 더 쉽게)' : ''}

[코드]
\`\`\`
${codeText}
\`\`\`

## 문제 구성
1번: 4지선다 또는 O/X (랜덤 선택)
2번: 4지선다
3번: 빈칸 채우기

## 절대 규칙 (위반 시 문제 자체가 무효)
- **모든 문제는 위 [코드]에 실제로 존재하는 내용만 다룬다. 코드에 없는 변수·메소드·클래스를 절대 언급하지 마라.**
- 빈칸 채우기: [코드]에서 한 줄을 그대로 가져와 핵심 토큰 하나만 ___로 바꾼다. 코드를 새로 만들지 마라.
- 정답이 여러 개일 수 있는 애매한 문제 금지
- package, import 관련 문제 금지
- O/X는 코드 동작에 대한 사실 확인 문제로만

## JSON 형식으로만 응답:
{"questions":[
  {"type":"multiple_choice 또는 ox","question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"},
  {"type":"multiple_choice","question":"문제","options":["①...","②...","③...","④..."],"answer":"정답 전체 텍스트","explanation":"해설"},
  {"type":"fill_blank","question":"문제 설명","code_with_blank":"[코드]에서 가져온 줄 (___가 빈칸)","answer":"정답 코드","explanation":"해설"}
]}

O/X 문제의 경우 options는 ["⭕ 맞다","❌ 틀리다"]로.
파일: ${fileName}`;
};

// ─── 채팅 프롬프트 ──────────────────────────────
const CHAT_SYSTEM = `당신은 친절한 코딩 멘토입니다. 학생이 코드에 대해 자유롭게 질문합니다.
- 쉬운 말로 대답하세요
- package, import는 언급하지 마세요
- 짧게 핵심만 답하세요
- 코드 인용 시 backtick 사용

## 문제 오류 대응 (중요)
퀴즈 문제가 주어졌을 때, 학생이 "이 문제 이상해요", "틀린 문제 같아요", "이게 왜 정답이에요?" 같은 항의를 하면:
1. 먼저 실제 코드를 기준으로 문제가 맞는지 직접 검증하세요
2. 만약 문제가 정말 잘못됐다면(코드에 없는 변수, 틀린 정답 등) 솔직하게 인정하고 사과하세요: "맞아요, 이 문제는 잘못 만들어졌네요. 죄송합니다!"
3. 잘못된 문제라면 올바른 문제가 무엇이었어야 하는지도 설명해주세요
4. 정답이 맞는 문제라면 왜 그게 정답인지 친절하게 설명하세요
절대로 틀린 문제를 맞다고 우기지 마세요.`;

// ═══════════════════════════════════════════════
const QuestView = ({ teacher, repo, chapters, chapterFilesMap, chaptersLoading, visitedFiles, userData, onBack }) => {
  // ─── 상태 ─────────────────────────────────────
  const [routineItems, setRoutineItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('lucid_quest_progress')); return saved?.idx || 0; } catch { return 0; }
  });
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);

  // 원두 드랍 상태
  const [beanDrop, setBeanDrop] = useState(null); // null | { isFirst, beanCount }

  // ─── 패널 리사이즈 ─────────────────────────────
  const splitContainerRef = useRef(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const isDraggingRef = useRef(false);
  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const onMouseMove = (ev) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      setSplitRatio(Math.max(0.25, Math.min(0.75, (ev.clientX - rect.left) / rect.width)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // 오른쪽 패널 상태: idle | explaining | quiz
  const [panelMode, setPanelMode] = useState('idle');

  // AI 설명
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // 퀴즈
  const [quizQuestions, setQuizQuestions] = useState([]); // 3문제 배열
  const [quizIdx, setQuizIdx] = useState(0); // 현재 문제 인덱스
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizFeedback, setQuizFeedback] = useState(null);
  const [fillAnswer, setFillAnswer] = useState(''); // 빈칸 입력
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizHearts, setQuizHearts] = useState(3); // 하트 3개
  const [heartLostIdx, setHeartLostIdx] = useState(null); // 소멸 애니메이션 중인 하트 인덱스
  const [screenFlash, setScreenFlash] = useState(false); // 오답 시 화면 붉은 플래시
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult] = useState(null); // null | 'invalid' | 'valid' | 'error'
  const [quizCorrect, setQuizCorrect] = useState(0); // 맞춘 수
  const [quizDone, setQuizDone] = useState(false); // 결과 화면

  // 종료 확인 모달
  const [exitConfirm, setExitConfirm] = useState(false);

  // 채팅 모달
  const [chatOpen, setChatOpen] = useState(true); // 처음엔 열림 (idle 상태)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSuggestions, setChatSuggestions] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // phase: loading | active | done
  const [phase, setPhase] = useState('loading');

  // ─── F2: 다음 문제 단축키 ────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      if (panelMode === 'quiz' && quizFeedback && !quizDone) goNextQuestion();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelMode, quizFeedback, quizDone, quizHearts, quizIdx, quizQuestions.length]);

  // ─── 우측 패널 Ctrl+Wheel 줌 ─────────────────
  const [panelFontSize, setPanelFontSize] = useState(14);
  const rightPanelRef = useRef(null);
  useEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setPanelFontSize(prev => Math.max(11, Math.min(22, prev + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  });

  // ─── 약점 파일 ────────────────────────────────
  const getWeakFiles = () => { try { return JSON.parse(localStorage.getItem('lucid_weak_files') || '[]'); } catch { return []; } };
  const addWeakFile = (path) => { const w = getWeakFiles(); if (!w.includes(path)) localStorage.setItem('lucid_weak_files', JSON.stringify([...w, path])); };
  const removeWeakFile = (path) => localStorage.setItem('lucid_weak_files', JSON.stringify(getWeakFiles().filter(p => p !== path)));

  // ─── 챕터 파일 자동 로드 ──────────────────────
  const [filesLoading, setFilesLoading] = useState(false);
  const [localFilesMap, setLocalFilesMap] = useState({});

  useEffect(() => {
    if (chaptersLoading || !chapters || chapters.length === 0) return;
    const hasAnyFiles = chapters.some(ch => (chapterFilesMap[ch.name] || []).length > 0);
    if (hasAnyFiles || filesLoading) return;
    const loadFiles = async () => {
      if (!teacher?.githubUsername || !repo?.name) return;
      setFilesLoading(true);
      try {
        const headers = {};
        if (import.meta.env.VITE_GITHUB_TOKEN) headers['Authorization'] = `token ${import.meta.env.VITE_GITHUB_TOKEN}`;
        const treeRes = await fetch(`https://api.github.com/repos/${teacher.githubUsername}/${repo.name}/git/trees/HEAD?recursive=1`, { headers });
        const tree = (await treeRes.json()).tree || [];
        const map = {};
        chapters.forEach(ch => {
          map[ch.name] = tree
            .filter(it => it.type === 'blob' && it.path.startsWith(ch.fullPath + '/') && !it.path.substring(ch.fullPath.length + 1).includes('/') && /\.(java|js|jsx|ts|tsx|py|html|css|jsp)$/.test(it.path))
            .map(it => ({ name: it.path.split('/').pop(), downloadUrl: `https://raw.githubusercontent.com/${teacher.githubUsername}/${repo.name}/HEAD/${it.path}`, path: it.path }));
        });
        setLocalFilesMap(map);
      } catch (e) { console.warn('퀘스트 파일 로드 실패:', e); }
      finally { setFilesLoading(false); }
    };
    loadFiles();
  }, [chapters, chapterFilesMap, chaptersLoading, teacher, repo]);

  const mergedFilesMap = useMemo(() => ({ ...localFilesMap, ...chapterFilesMap }), [localFilesMap, chapterFilesMap]);

  // ─── 퀘스트 아이템 구성 (1회) ─────────────────
  const [routineReady, setRoutineReady] = useState(false);
  useEffect(() => {
    if (routineReady) return;
    if (chaptersLoading || filesLoading) { setPhase('loading'); return; }
    if (!chapters || chapters.length === 0) { setPhase('done'); return; }
    const allFiles = [];
    chapters.forEach(ch => (mergedFilesMap[ch.name] || []).forEach(f => allFiles.push({ ...f, chapterLabel: ch.label || ch.name })));
    if (allFiles.length === 0) { if (!Object.keys(mergedFilesMap).length) { setPhase('loading'); return; } setPhase('done'); return; }

    const items = [];
    const weakPaths = getWeakFiles();
    allFiles.filter(f => !visitedFiles.includes(f.path)).slice(0, 3).forEach(f => items.push({ type: 'new', file: f, chapterLabel: f.chapterLabel }));
    allFiles.filter(f => weakPaths.includes(f.path)).slice(0, 2).forEach(f => items.push({ type: 'weak', file: f, chapterLabel: f.chapterLabel }));
    const review = allFiles.filter(f => visitedFiles.includes(f.path) && !weakPaths.includes(f.path));
    if (review.length > 0) items.push({ type: 'review', file: review[Math.floor(Math.random() * review.length)], chapterLabel: review[0].chapterLabel });
    if (!items.length) [...allFiles].sort(() => Math.random() - 0.5).slice(0, 3).forEach(f => items.push({ type: 'review', file: f, chapterLabel: f.chapterLabel }));

    setRoutineItems(items);
    // 저장된 진행 상태 복원
    try {
      const saved = JSON.parse(localStorage.getItem('lucid_quest_progress'));
      const today = new Date().toDateString();
      if (saved && saved.date === today && saved.idx < items.length) {
        // 같은 퀘스트 아이템인지 확인 (파일 경로 비교)
        const savedPaths = saved.paths || [];
        const currentPaths = items.map(i => i.file.path);
        if (JSON.stringify(savedPaths) === JSON.stringify(currentPaths)) {
          setCurrentIdx(saved.idx);
        }
      }
    } catch { /* ignore */ }
    setPhase('active');
    setRoutineReady(true);
  }, [chapters, mergedFilesMap, chaptersLoading, filesLoading, visitedFiles, routineReady]);

  // ─── 코드 로드 ────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || !routineItems.length || currentIdx >= routineItems.length) return;
    const item = routineItems[currentIdx];
    setCodeLoading(true);
    resetRightPanel();

    fetch(item.file.downloadUrl)
      .then(r => r.text())
      .then(text => { setCode(text); setCodeLoading(false); })
      .catch(() => { setCode('// 코드를 불러올 수 없습니다'); setCodeLoading(false); });
  }, [phase, currentIdx, routineItems]);

  const resetRightPanel = () => {
    setPanelMode('idle');
    setAiExplanation('');
    setAiLoading(false);
    setQuizQuestions([]);
    setQuizIdx(0);
    setSelectedAnswer(null);
    setQuizFeedback(null);
    setFillAnswer('');
    setQuizHearts(3);
    setHeartLostIdx(null);
    setScreenFlash(false);
    setQuizCorrect(0);
    setQuizDone(false);
    setChatOpen(true);
    setChatMessages([]);
    setChatInput('');
  };

  // ─── AI 설명 요청 ─────────────────────────────
  const requestExplanation = async (isEasier = false) => {
    setAiLoading(true);
    setLoadingMsg(pickMsg(isEasier ? 'easier' : 'explain'));
    setPanelMode('explaining');
    setChatOpen(false);

    try {
      const apiKey = getApiKey();
      if (!apiKey) { setAiExplanation('API 키가 설정되지 않았습니다.'); setAiLoading(false); return; }
      const item = routineItems[currentIdx];
      const msgs = [
        { role: 'system', content: `${EXPLAIN_PROMPT}\n\n파일명: ${item.file.name}\n챕터: ${item.chapterLabel}` },
        { role: 'user', content: code },
      ];
      if (isEasier && aiExplanation) {
        msgs.push({ role: 'assistant', content: aiExplanation });
        msgs.push({ role: 'user', content: EASIER_PROMPT });
      }
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4.1-nano', messages: msgs, temperature: 0.7, max_tokens: 800 }),
      });
      const data = await res.json();
      setAiExplanation(data.choices?.[0]?.message?.content || '설명을 생성할 수 없습니다.');
    } catch { setAiExplanation('설명 생성에 실패했습니다.'); }
    finally { setAiLoading(false); }
  };

  // ─── 퀴즈 요청 (3문제 세트) ───────────────────
  const requestQuiz = async (isEasier = false) => {
    setQuizLoading(true);
    setLoadingMsg(pickMsg(isEasier ? 'easierQuiz' : 'quiz'));
    setPanelMode('quiz');
    setChatOpen(false);
    setQuizQuestions([]);
    setQuizIdx(0);
    setSelectedAnswer(null);
    setQuizFeedback(null);
    setFillAnswer('');
    setQuizHearts(3);
    setHeartLostIdx(null);
    setScreenFlash(false);
    setQuizCorrect(0);
    setQuizDone(false);

    try {
      const apiKey = getApiKey();
      if (!apiKey) { setQuizLoading(false); return; }
      const item = routineItems[currentIdx];
      const diff = isEasier ? Math.max(0, getDiffLevel() - 1) : getDiffLevel();
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: buildQuizPrompt(item.file.name, code, diff, isEasier) },
            { role: 'user', content: code },
          ],
          temperature: 0.8,
          max_tokens: 1200,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      setQuizQuestions(parsed.questions || []);
      setChatMessages([{ role: 'assistant', content: '현재 문제를 알고 있어요 😊 해설이나 힌트가 필요하면 물어보세요!' }]);
      setChatSuggestions(['💡 힌트 주세요', '📖 해설 설명해주세요', '🤔 문제가 왜 이렇게 되나요?', '🚩 문제가 이상한 것 같아요']);
    } catch (e) {
      console.warn('퀴즈 생성 실패:', e);
      setQuizQuestions([{ type: 'multiple_choice', question: '문제 생성에 실패했습니다. 다음으로 넘어갈게요.', options: ['확인'], answer: '확인', explanation: '' }]);
    } finally { setQuizLoading(false); }
  };

  // ─── 퀴즈 답 처리 ────────────────────────────
  const handleAnswer = async (answer) => {
    if (quizFeedback) return;
    const q = quizQuestions[quizIdx];
    const isCorrect = q.type === 'fill_blank'
      ? answer.trim().toLowerCase() === q.answer.trim().toLowerCase()
      : answer === q.answer;

    setSelectedAnswer(answer);
    setQuizFeedback({ correct: isCorrect, explanation: q.explanation });
    adjustDifficulty(isCorrect);

    if (isCorrect) {
      // 반복 드랍률 계산
      const filePath = routineItems[currentIdx]?.file?.path || '';
      const repeatCount = getQuestRepeatCount(filePath);
      const { multiplier, fixed } = getQuestDropRate(repeatCount);
      // 세트별 XP: 빈칸채우기=100 / OX·객관식=50 (반복 드랍률 적용)
      const baseXP = q.type === 'fill_blank' ? 100 : 50;
      const droppedXP = fixed !== null ? fixed : Math.round(baseXP * multiplier);
      const xp = addDailyXP(droppedXP, 'quest', true);
      setEarnedXP(prev => prev + xp);
      setQuizCorrect(prev => prev + 1);
      try {
        const uid = auth.currentUser?.uid;
        if (uid && xp > 0) await updateDoc(doc(db, 'users', uid), { totalXP: increment(xp), lastStudiedAt: serverTimestamp() });
      } catch {}
    } else {
      // 하트 소멸 애니메이션 + 화면 플래시
      setHeartLostIdx(quizHearts - 1);
      setScreenFlash(true);
      setTimeout(() => { setHeartLostIdx(null); setScreenFlash(false); }, 600);
      setQuizHearts(prev => prev - 1);
    }
  };

  // 다음 문제 or 완료
  const goNextQuestion = () => {
    // 하트 0 또는 마지막 문제 → 결과 화면
    if (quizHearts <= (quizFeedback?.correct ? 0 : 1) || quizIdx + 1 >= quizQuestions.length) {
      // 반복 횟수 기록 (드랍률 계산용)
      const filePath = routineItems[currentIdx]?.file?.path || '';
      if (filePath) recordQuestRepeat(filePath);
      setQuizDone(true);
      setQuizFeedback(null);
    } else {
      setQuizIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setQuizFeedback(null);
      setFillAnswer('');
      setReportResult(null);
    }
  };

  // ─── 이해했어요 → 퀴즈 시작 ──────────────────
  const handleUnderstood = () => {
    requestQuiz(false);
  };

  // ─── 다음 아이템 ──────────────────────────────
  const goNextItem = () => {
    if (currentIdx + 1 >= routineItems.length) {
      localStorage.removeItem('lucid_quest_progress');
      setPhase('done');
    } else {
      const nextIdx = currentIdx + 1;
      localStorage.setItem('lucid_quest_progress', JSON.stringify({
        date: new Date().toDateString(),
        idx: nextIdx,
        paths: routineItems.map(i => i.file.path),
      }));
      setCurrentIdx(nextIdx);
      setCode('');
    }
  };

  // ─── 채팅 전송 ────────────────────────────────
  const sendChatMsg = async (msg) => {
    if (!msg.trim() || chatLoading) return;
    setChatSuggestions([]);
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    const userMsg = msg;
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) { setChatLoading(false); return; }
    const item = routineItems[currentIdx];
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: panelMode === 'quiz' ? 'gpt-4o-mini' : 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: `${CHAT_SYSTEM}\n\n파일: ${item.file.name}\n코드:\n${code}${
  panelMode === 'quiz' && curQ
    ? `\n\n---\n현재 출제된 퀴즈 문제:\n문제: ${curQ.question}${curQ.code_with_blank ? '\n코드: ' + curQ.code_with_blank : ''}${curQ.options ? '\n선택지: ' + curQ.options.join(' / ') : ''}\n정답: ${curQ.answer}\n해설: ${curQ.explanation}\n\n학생이 이 문제에 대해 질문하면 위 정보를 바탕으로 친절하게 설명해주세요.`
    : ''
}` },
            ...chatMessages.slice(-10),
            { role: 'user', content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.choices?.[0]?.message?.content || '답변을 생성할 수 없습니다.' }]);
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: '답변 생성에 실패했습니다.' }]); }
    finally { setChatLoading(false); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');
    sendChatMsg(msg);
  };

  // ─── 문제 신고 & 검증 ─────────────────────────
  const handleReportQuestion = async () => {
    if (reportLoading || !curQ) return;
    setReportLoading(true);
    setReportResult(null);
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    const item = routineItems[currentIdx];
    try {
      const verifyPrompt = `당신은 퀴즈 문제 검증 AI입니다. 학생이 이 문제가 이상하다고 신고했습니다.
아래 코드를 꼼꼼히 확인하고, 문제에서 요구하는 내용이 실제 코드에 존재하는지 검증하세요.
합리화하거나 변명하지 말고 있는 그대로 판단하세요.

## 코드 (${item.file.name}):
${code}

## 신고된 문제:
문제: ${curQ.question}
${curQ.code_with_blank ? '빈칸 코드: ' + curQ.code_with_blank : ''}
${curQ.options ? '선택지: ' + curQ.options.join(' / ') : ''}
정답: ${curQ.answer}

반드시 JSON만 응답: {"valid": true/false, "reason": "한 줄 이유"}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: verifyPrompt }], temperature: 0, max_tokens: 100 }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '{}';
      const match = raw.match(/\{[\s\S]*\}/);
      const result = match ? JSON.parse(match[0]) : { valid: true };

      if (!result.valid) {
        setReportResult('invalid');
        setTimeout(() => { requestQuiz(); setReportResult(null); }, 1500);
      } else {
        setReportResult('valid');
        setTimeout(() => setReportResult(null), 3000);
      }
    } catch {
      setReportResult('error');
      setTimeout(() => setReportResult(null), 2000);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // 퀘스트 완료 시 스트릭 +1 + 원두 드랍 판정 (한 번만, 완료 화면 진입 시)
  const routineCompletedRef = useRef(false);
  useEffect(() => {
    if (phase === 'done' && !routineCompletedRef.current) {
      routineCompletedRef.current = true;
      onQuestComplete();
      const uid = auth.currentUser?.uid;
      if (uid) syncStreakToFirestore(uid);
      // 원두 드랍 판정 (1.5초 딜레이 — 완료 화면 먼저 보여준 후)
      setTimeout(() => {
        const result = rollBeanDrop();
        if (result.dropped) setBeanDrop({ isFirst: result.isFirst, beanCount: result.beanCount });
      }, 1500);
    }
  }, [phase]);

  // ─── 로딩 화면 ────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-[#f59e0b]/60 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400">{pickMsg('prepare')}</p>
      </div>
    );
  }

  // ─── 완료 화면 ────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fade-in-up px-4">
        {/* 원두 드랍 카드 */}
        {beanDrop && (
          <BeanRewardCard
            isFirst={beanDrop.isFirst}
            beanCount={beanDrop.beanCount}
            onClose={() => setBeanDrop(null)}
          />
        )}
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-white mb-2">퀘스트 완료!</h2>
          <p className="text-sm text-gray-400 mb-6">
            {routineItems.length > 0 ? `${routineItems.length}개 코드를 클리어했어요.` : '오늘 볼 코드가 없어요.'}
          </p>
          {earnedXP > 0 && (
            <div className="bg-[#f59e0b]/[0.08] border border-[#f59e0b]/20 rounded-2xl p-4 mb-6">
              <p className="text-sm text-gray-400">획득 XP</p>
              <p className="text-3xl font-black text-[#f59e0b]">+{earnedXP}</p>
            </div>
          )}
          <button onClick={() => onBack({ xp: earnedXP })} className="px-6 py-3 rounded-xl font-bold text-sm bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 transition-all">
            홈으로
          </button>
        </div>
      </div>
    );
  }

  // ─── 메인 렌더 ────────────────────────────────
  const item = routineItems[currentIdx];
  if (!item) return null;
  const typeLabel = item.type === 'new' ? '새 코드' : item.type === 'weak' ? '약점 복습' : '복습';
  const typeColor = item.type === 'new' ? '#4ec9b0' : item.type === 'weak' ? '#f59e0b' : '#569cd6';
  const lang = extToLang(item.file?.name);

  const proseClass = "prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-li:my-0.5 prose-code:bg-white/10 prose-code:px-1.5 prose-code:rounded prose-code:text-[#fbbf24] prose-code:before:content-none prose-code:after:content-none prose-strong:text-[#f59e0b] prose-h1:text-base prose-h2:text-sm prose-h3:text-sm";

  // 현재 퀴즈 문제
  const curQ = quizQuestions[quizIdx];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 상단 바 */}
      <div className="shrink-0 px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setExitConfirm(true)} className="text-gray-400 hover:text-white transition p-1" title="퀘스트 나가기">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <span className="text-sm font-bold text-white">오늘의 퀘스트</span>
          <span className="text-[10px] text-gray-500">{currentIdx + 1} / {routineItems.length}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: typeColor, background: `${typeColor}15`, border: `1px solid ${typeColor}30` }}>{typeLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {earnedXP > 0 && <span className="text-xs font-bold text-[#f59e0b]">+{earnedXP} XP</span>}
          <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#f97316] rounded-full transition-all duration-500" style={{ width: `${(currentIdx / routineItems.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* 파일 정보 */}
      <div className="shrink-0 px-4 py-2 border-b border-white/[0.04] flex items-center gap-2">
        <span className="text-[10px] text-gray-500">{item.chapterLabel}</span>
        <span className="text-[10px] text-gray-600">/</span>
        <span className="text-xs font-bold" style={{ color: '#dcdcaa' }}>{item.file.name}</span>
      </div>

      {/* 좌=코드 / 우=패널 */}
      <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
        {/* 좌: Monaco */}
        <div style={{ width: `${splitRatio * 100}%` }} className="shrink-0 flex flex-col border-r border-white/[0.06]">
          {codeLoading ? (
            <div className="flex items-center justify-center h-full gap-2">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold text-gray-400">{pickMsg('prepare')}</span>
            </div>
          ) : (
            <Editor height="100%" language={lang} value={code} theme="vs-dark" options={{
              readOnly: true, fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false,
              wordWrap: 'on', lineNumbers: 'on', renderLineHighlight: 'none', tabSize: 4,
              padding: { top: 12, bottom: 12 }, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
            }} />
          )}
        </div>

        {/* 스플리터 */}
        <div onMouseDown={handleSplitMouseDown}
          className="w-1.5 cursor-col-resize flex items-center justify-center group hover:bg-[#f59e0b]/20 transition-colors rounded-full mx-0.5 shrink-0">
          <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-[#f59e0b] rounded-full transition-colors" />
        </div>

        {/* 우: 패널 */}
        <div ref={rightPanelRef} style={{ fontSize: `${panelFontSize}px` }} className="flex-1 min-w-0 flex flex-col relative">

          {/* ─── idle: 채팅 모달 (같은 크기로 덮음) ─── */}
          {panelMode === 'idle' && chatOpen && (
            <div className="absolute inset-0 z-10 flex flex-col bg-[#0d0d0d]">
              {/* 채팅 헤더 */}
              <div className="shrink-0 px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-bold text-white">코드가 궁금하다면 물어보세요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">아래에서 자유롭게 질문하거나, 바로 설명을 받아보세요</p>
              </div>

              {/* 설명/문제 요청 버튼 */}
              <div className="px-4 py-3 flex gap-2">
                <button
                  onClick={() => requestExplanation(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 hover:bg-[#f59e0b]/20 transition-all"
                >
                  코드 설명해주세요
                </button>
                <button
                  onClick={() => requestQuiz(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30 hover:-translate-y-0.5 hover:bg-[#a855f7]/20 transition-all"
                >
                  문제로 확인해볼래요
                </button>
              </div>

              {/* 채팅 메시지 */}
              <div className="flex-1 overflow-auto px-4 py-2 space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-center text-gray-600 text-xs mt-8">궁금한 거 질문하세요~</p>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      m.role === 'user' ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/20' : 'bg-white/[0.03] text-gray-300 border border-white/[0.06]'
                    }`}>
                      {m.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-xs max-w-none prose-code:text-[#fbbf24] prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                          {m.content}
                        </ReactMarkdown>
                      ) : m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                {chatSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1 mt-2">
                    {chatSuggestions.map((s, i) => (
                      <button key={i} onClick={() => sendChatMsg(s)}
                        className="text-[11px] px-3 py-1.5 rounded-full border border-white/[0.10] text-gray-400 hover:text-gray-200 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* 채팅 입력 */}
              <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="이 코드에서 궁금한 거 물어보세요..."
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 outline-none focus:border-[#f59e0b]/30"
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    className="px-3 py-2 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] text-xs font-bold border border-[#f59e0b]/30 disabled:opacity-30 hover:bg-[#f59e0b]/25 transition-all">
                    전송
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── explaining: AI 설명 ─── */}
          {panelMode === 'explaining' && (
            <>
              <div className="flex-1 overflow-auto px-5 py-4">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-6 h-6 border-2 border-[#f59e0b]/40 border-t-[#f59e0b] rounded-full animate-spin" />
                    <span className="text-sm font-bold text-gray-400">{loadingMsg}</span>
                  </div>
                ) : (
                  <div className={proseClass}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                      components={{
                        code: ({ children }) => <code className="text-[#fbbf24] font-bold bg-white/5 px-1 rounded">{children}</code>,
                        strong: ({ children }) => <span className="text-[#f59e0b] font-semibold">{children}</span>,
                        h1: ({ children }) => <h1 className="text-base font-black text-white mt-4 mb-2 pb-1 border-b border-white/[0.06]">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-[#f59e0b] mt-3 mb-1.5">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold text-gray-300 mt-2 mb-1">{children}</h3>,
                      }}
                    >{aiExplanation}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* 하단 버튼 */}
              {!aiLoading && (
                <div className="shrink-0 px-4 py-3 border-t border-white/[0.06] flex gap-2">
                  <button onClick={handleUnderstood} className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#4ec9b0]/15 text-[#4ec9b0] border border-[#4ec9b0]/30 hover:-translate-y-0.5 transition-all">
                    이해했어요
                  </button>
                  <button onClick={() => requestExplanation(true)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#569cd6]/15 text-[#569cd6] border border-[#569cd6]/30 hover:-translate-y-0.5 transition-all">
                    더 쉽게 설명해주세요
                  </button>
                </div>
              )}

            </>
          )}

          {/* ─── quiz: 문제풀이 ─── */}
          {panelMode === 'quiz' && (
            <>
            {screenFlash && <div className="absolute inset-0 bg-red-500/30 pointer-events-none z-30 screen-flash-red rounded-none" />}
            <div
              className="flex-1 overflow-auto px-5 py-4 outline-none"
              tabIndex={curQ?.type === 'fill_blank' ? undefined : 0}
              ref={el => { if (el && !quizLoading && curQ && !quizFeedback && curQ.type !== 'fill_blank') el.focus(); }}
              onKeyDown={e => {
                if (quizFeedback || quizLoading || !curQ) return;
                if (curQ.type === 'fill_blank') {
                  if (e.key === 'Tab') { /* 기본 Tab 동작 허용 */ return; }
                } else {
                  const num = parseInt(e.key);
                  if (num >= 1 && num <= (curQ.options?.length || 0)) {
                    e.preventDefault();
                    handleAnswer(curQ.options[num - 1]);
                  }
                }
              }}
            >
              {quizLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-6 h-6 border-2 border-[#a855f7]/40 border-t-[#a855f7] rounded-full animate-spin" />
                  <span className="text-sm font-bold text-gray-400">{loadingMsg}</span>
                </div>
              ) : quizDone ? (
                /* ─── 퀴즈 결과 화면 ─── */
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                  <div className="text-4xl mb-2">{quizCorrect === quizQuestions.length ? '🎉' : quizCorrect >= 2 ? '👍' : '💪'}</div>
                  <p className="text-lg font-black text-white">
                    {quizCorrect === quizQuestions.length ? '완벽해요!' : quizCorrect >= 2 ? '잘했어요!' : '다음엔 더 잘할 수 있어요!'}
                  </p>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-center">
                      <p className="text-2xl font-black text-[#4ec9b0]">{quizCorrect}</p>
                      <p className="text-[10px] text-gray-500">맞춤</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-2xl font-black text-red-400">{quizQuestions.length - quizCorrect}</p>
                      <p className="text-[10px] text-gray-500">틀림</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                      <p className="text-2xl font-black text-[#f59e0b]">{quizHearts}</p>
                      <p className="text-[10px] text-gray-500">남은 하트</p>
                    </div>
                  </div>
                  <button onClick={() => { removeWeakFile(routineItems[currentIdx]?.file?.path); checkWeekendBonus(); goNextItem(); }}
                    className="w-full max-w-xs py-3 rounded-xl font-bold text-sm bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30 hover:-translate-y-0.5 transition-all">
                    다음 코드로 →
                  </button>
                </div>
              ) : curQ ? (
                <div className="rounded-2xl p-5 transition-all duration-500" style={{
                  background: `linear-gradient(135deg, rgba(168,85,247,${0.04 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.12}) 0%, transparent 100%)`,
                  border: `1px solid rgba(168,85,247,${0.12 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.25})`,
                  boxShadow: `0 4px 24px rgba(168,85,247,${0.06 + (currentIdx / Math.max(routineItems.length - 1, 1)) * 0.14})`,
                }}>
                  {/* 힌트 배너 */}
                  <div className="flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-lg bg-[#569cd6]/[0.08] border border-[#569cd6]/15">
                    <span className="text-[11px]">👈</span>
                    <span className="text-[10px] text-[#569cd6]/80 font-medium">왼쪽 코드를 보면서 풀어보세요</span>
                  </div>
                  {/* 문제 번호 + 하트 */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-bold text-gray-500">{quizIdx + 1} / {quizQuestions.length}</span>
                    {curQ.type === 'ox' && <span className="text-[10px] font-bold text-[#4ec9b0] bg-[#4ec9b0]/10 px-2 py-0.5 rounded-full">O/X</span>}
                    {curQ.type === 'fill_blank' && <span className="text-[10px] font-bold text-[#c586c0] bg-[#c586c0]/10 px-2 py-0.5 rounded-full">빈칸 채우기</span>}
                    <span className="ml-auto flex items-center gap-0.5">
                      {[...Array(3)].map((_, i) => {
                        const isPopping = i === heartLostIdx;
                        const isActive = i < quizHearts || isPopping;
                        return (
                          <span key={i} className={`text-sm transition-all duration-300 ${isActive ? 'scale-100' : 'scale-75'} ${isPopping ? 'quiz-heart-pop' : ''}`}>
                            {isActive ? '❤️' : '🖤'}
                          </span>
                        );
                      })}
                    </span>
                    {curQ.type !== 'fill_blank' && <span className="text-[8px] text-gray-600">1~{curQ.options?.length} 키</span>}
                  </div>

                  {/* 문제 — 코드 포함 시 하이라이팅 */}
                  {(() => {
                    const q = curQ.question;
                    const codeMatch = q.match(/```(\w*)\n?([\s\S]*?)```/);
                    if (codeMatch) {
                      const before = q.substring(0, codeMatch.index).trim();
                      const codeLang = codeMatch[1] || lang;
                      const codeBody = codeMatch[2].trim();
                      const after = q.substring(codeMatch.index + codeMatch[0].length).trim();
                      return (
                        <>
                          {before && <p className="text-base text-white font-semibold mb-3 leading-relaxed">{before}</p>}
                          <div className="rounded-xl overflow-hidden mb-3 border border-white/[0.14]">
                            <SyntaxHighlighter language={codeLang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.75rem', fontSize: '11px', background: '#0d1117', borderRadius: '0.75rem' }} wrapLongLines>{codeBody}</SyntaxHighlighter>
                          </div>
                          {after && <p className="text-base text-white font-semibold mb-4 leading-relaxed">{after}</p>}
                        </>
                      );
                    }
                    const hasCode = /[{};=()]/.test(q) && q.includes('\n');
                    if (hasCode) {
                      const lines = q.split('\n');
                      const textLines = [], codeLines = [];
                      let cs = false;
                      for (const l of lines) { if (!cs && /^[가-힣\s]/.test(l) && !/[{};=]/.test(l)) textLines.push(l); else { cs = true; codeLines.push(l); } }
                      return (
                        <>
                          {textLines.length > 0 && <p className="text-base text-white font-semibold mb-3 leading-relaxed">{textLines.join('\n')}</p>}
                          <div className="rounded-xl overflow-hidden mb-4 border border-white/[0.14]">
                            <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '0.75rem', fontSize: '11px', background: '#0d1117', borderRadius: '0.75rem' }} wrapLongLines>{codeLines.join('\n')}</SyntaxHighlighter>
                          </div>
                        </>
                      );
                    }
                    return <p className="text-base text-white font-semibold mb-4 leading-relaxed">{q}</p>;
                  })()}

                  {/* 빈칸: 코드 + 입력창 */}
                  {curQ.type === 'fill_blank' ? (
                    <>
                      {curQ.code_with_blank && (
                        <div className="rounded-xl overflow-hidden mb-4 border border-white/[0.14]">
                          <SyntaxHighlighter language={lang} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1rem', fontSize: '12px', background: '#0d1117', borderRadius: '0.75rem' }} wrapLongLines>
                            {curQ.code_with_blank}
                          </SyntaxHighlighter>
                        </div>
                      )}
                      <div className="flex gap-2 mb-4">
                        <input
                          autoFocus
                          value={fillAnswer}
                          onChange={e => setFillAnswer(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Tab') e.preventDefault(); if (e.key === 'Enter' && !quizFeedback && fillAnswer.trim()) handleAnswer(fillAnswer); }}
                          disabled={!!quizFeedback}
                          placeholder="빈칸에 들어갈 코드를 입력하세요"
                          className="flex-1 bg-white/[0.04] border border-[#c586c0]/30 rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono placeholder:text-gray-600 outline-none focus:border-[#c586c0]/60 focus:ring-1 focus:ring-[#c586c0]/30 disabled:opacity-50"
                        />
                        {!quizFeedback && (
                          <button onClick={() => handleAnswer(fillAnswer)} disabled={!fillAnswer.trim()}
                            className="px-4 py-2.5 rounded-lg bg-[#c586c0]/15 text-[#c586c0] text-sm font-bold border border-[#c586c0]/30 disabled:opacity-30 hover:bg-[#c586c0]/25 transition-all">
                            제출
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    /* 객관식 / O/X — 색감 + 번호 키 */
                    <div className="space-y-3 mb-4">
                      {curQ.options?.map((opt, i) => {
                        const colors = ['#4ec9b0', '#569cd6', '#dcdcaa', '#c586c0'];
                        const c = colors[i % colors.length];
                        return (
                          <button
                            key={i}
                            onClick={() => handleAnswer(opt)}
                            disabled={!!quizFeedback}
                            className={`w-full text-left px-4 py-3.5 rounded-xl border text-[15px] transition-all flex items-center gap-3 ${
                              quizFeedback
                                ? opt === curQ.answer
                                  ? 'border-[#4ec9b0]/60 bg-[#4ec9b0]/10 text-[#4ec9b0] font-bold shadow-[0_0_12px_rgba(78,201,176,0.15)]'
                                  : selectedAnswer === opt
                                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                  : 'border-white/[0.04] text-gray-600'
                                : 'border-white/[0.08] text-gray-100 hover:bg-white/[0.06] hover:border-white/[0.25] hover:shadow-[0_0_8px_rgba(255,255,255,0.04)]'
                            }`}
                          >
                            <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shrink-0" style={{
                              background: quizFeedback ? (opt === curQ.answer ? '#4ec9b015' : selectedAnswer === opt ? '#ef444415' : '#ffffff06') : `${c}25`,
                              color: quizFeedback ? (opt === curQ.answer ? '#4ec9b0' : selectedAnswer === opt ? '#ef4444' : '#555') : c,
                              border: `1px solid ${quizFeedback ? (opt === curQ.answer ? '#4ec9b040' : selectedAnswer === opt ? '#ef444440' : '#ffffff08') : `${c}50`}`,
                            }}>
                              {i + 1}
                            </span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 문제 신고 버튼 */}
                  {!quizFeedback && (
                    <div className="flex justify-end mb-3">
                      {reportResult === 'invalid' ? (
                        <span className="text-[10px] text-[#f59e0b]">⚠️ 맞아요, 새 문제로 교체할게요!</span>
                      ) : reportResult === 'valid' ? (
                        <span className="text-[10px] text-[#4ec9b0]">✅ 문제에 이상 없어요</span>
                      ) : reportResult === 'error' ? (
                        <span className="text-[10px] text-red-400">검증 실패</span>
                      ) : (
                        <button
                          onClick={handleReportQuestion}
                          disabled={reportLoading}
                          className="text-[10px] text-gray-600 hover:text-red-400/70 transition-colors flex items-center gap-1"
                        >
                          {reportLoading
                            ? <><span className="w-2 h-2 border border-gray-600 border-t-gray-400 rounded-full animate-spin inline-block" /> 검증 중...</>
                            : '🚩 이 문제 이상한 것 같아요'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 피드백 */}
                  {quizFeedback && (
                    <div className={`p-4 rounded-xl mb-4 ${quizFeedback.correct ? 'bg-[#4ec9b0]/[0.06] border border-[#4ec9b0]/20' : 'bg-red-500/[0.06] border border-red-500/20'}`}>
                      <p className="text-sm font-bold mb-1" style={{ color: quizFeedback.correct ? '#4ec9b0' : '#ef4444' }}>
                        {quizFeedback.correct
                          ? '정답!'
                          : '아쉬워요!'}
                      </p>
                      {curQ.type === 'fill_blank' && !quizFeedback.correct && (
                        <p className="text-xs text-gray-400 mb-1">정답: <code className="text-[#fbbf24] bg-white/5 px-1 rounded">{curQ.answer}</code></p>
                      )}
                      <p className="text-xs text-gray-400">{quizFeedback.explanation}</p>
                      <button onClick={goNextQuestion}
                        className="mt-3 w-full py-2.5 rounded-lg font-bold text-sm bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                        {quizHearts <= 0 || quizIdx + 1 >= quizQuestions.length ? '결과 보기' : '다음 문제'}
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#f59e0b]/15 border border-[#f59e0b]/25 text-[#f59e0b]/60">F2</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            </>
          )}

          {/* ─── 채팅 토글 (설명/퀴즈 모드에서 접힌 상태) ─── */}
          {panelMode !== 'idle' && !chatOpen && (
            <button onClick={() => setChatOpen(true)} tabIndex={-1}
              className="absolute bottom-16 right-4 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[10px] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-all z-20">
              💬 채팅창 펼치기
            </button>
          )}

          {/* ─── 채팅 모달 (설명/퀴즈 모드에서 펼쳤을 때) ─── */}
          {panelMode !== 'idle' && chatOpen && (
            <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0d0d]/95 backdrop-blur-sm">
              <div className="shrink-0 px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">💬 자유 질문</span>
                  {panelMode === 'quiz' && curQ && (
                    <p className="text-[9px] text-[#a855f7]/70 mt-0.5">현재 문제를 알고 있어요 — 해설/힌트 물어보세요</p>
                  )}
                </div>
                <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/[0.06] transition">
                  접기
                </button>
              </div>
              <div className="flex-1 overflow-auto px-4 py-2 space-y-3">
                {chatMessages.length === 0 && <p className="text-center text-gray-600 text-xs mt-8">코드에 대해 궁금한 거 물어보세요~</p>}
                {chatMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      m.role === 'user' ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/20' : 'bg-white/[0.03] text-gray-300 border border-white/[0.06]'
                    }`}>
                      {m.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert prose-xs max-w-none prose-code:text-[#fbbf24] prose-code:bg-white/5 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                          {m.content}
                        </ReactMarkdown>
                      ) : m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="궁금한 거 물어보세요..." className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 outline-none focus:border-[#f59e0b]/30" />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    className="px-3 py-2 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b] text-xs font-bold border border-[#f59e0b]/30 disabled:opacity-30 hover:bg-[#f59e0b]/25 transition-all">
                    전송
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 종료 확인 모달 ─── */}
      {exitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setExitConfirm(false)}>
          <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-6 w-[340px] shadow-[0_16px_64px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">퀘스트 종료</p>
                <p className="text-xs text-gray-500">진행 상태가 초기화됩니다</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">퀘스트를 정말 종료하시겠습니까?</p>
            <div className="flex gap-2">
              <button onClick={() => setExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
                취소
              </button>
              <button onClick={() => { setExitConfirm(false); onBack(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all">
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestView;
