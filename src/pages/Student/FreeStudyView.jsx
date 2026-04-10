import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import nightOwlTheme from '../../themes/nightOwl.json';

const SAMPLE_CODE = `package study.ch17;

import java.util.Random;
import java.util.UUID;

public class Main {
    public static String[][] createUsernamesAndPasswords() {
        String[][] usernamesAndPasswords = new String[2][60];
        String[] usernames = usernamesAndPasswords[0];
        String[] passwords = usernamesAndPasswords[1];

        for (int i = 0; i < 60; i++) {
            Random random = new Random();
            usernames[i] = "";
            for (int j = 0; j < 10; j++) {
                int r = random.nextInt(26) + 97;
                usernames[i] += (char) r;
            }
            usernames[i] += "@gmail.com";
            passwords[i] = UUID.randomUUID().toString().replaceAll("-", "");
        }

        return usernamesAndPasswords;
    }

    public static void main(String[] args) {
        String[] usernames = Main.createUsernamesAndPasswords()[0];
        String[] passwords = Main.createUsernamesAndPasswords()[1];

        User[] users = new User[50];
        UserRepository userRepository = UserRepository.getInstance();
        userRepository.setUsers(users);

        UserService userService = new UserService(userRepository);
        UserController userController = new UserController(userService);
        for (int i = 0; i < 60; i++) {
            userController.postMapping(usernames[i], passwords[i]);
        }
    }
}`;

const TABS = [
  { id: 'main', label: '🗒️ Main.java' },
  { id: 'ai',   label: 'AI 생성코드' },
];

const RIGHT_TABS = [
  { id: 'tutor', label: '💬 Lucid Tutor' },
  { id: 'quiz',  label: '🎯 문제풀기' },
];

const FreeStudyView = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('main');
  const [activeRightTab, setActiveRightTab] = useState('tutor');
  const [tabContents, setTabContents] = useState({
    main: SAMPLE_CODE,
    ai: '',
  });
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [chatFontSize, setChatFontSize] = useState(14);
  const [isReadOnly, setIsReadOnly] = useState(true);
  const splitContainerRef = useRef(null);
  const isDraggingRef = useRef(false);

  const handleEditorMount = (editor, monaco) => {
    // ── 커스텀 Java 토크나이저 ──
    // 내장 토크나이저는 String/Main 같은 대문자 식별자를 그냥 identifier로만 분류한다.
    // 여기서는 대문자로 시작하는 식별자를 'type.identifier'로 잡아내서
    // 테마의 청록색(#4ec9b0) 룰에 매핑되게 만든다.
    monaco.languages.setMonarchTokensProvider('java', {
      defaultToken: '',
      tokenPostfix: '.java',

      keywords: [
        'continue', 'for', 'new', 'switch', 'assert', 'default', 'goto',
        'package', 'boolean', 'do', 'if', 'this', 'break', 'double',
        'implements', 'throw', 'byte', 'else', 'import', 'throws',
        'case', 'enum', 'instanceof', 'return', 'catch', 'extends',
        'int', 'short', 'try', 'char', 'interface', 'void', 'class',
        'finally', 'long', 'const', 'float', 'super', 'while',
        'true', 'false', 'null', 'var', 'record', 'yield', 'sealed',
        'non-sealed', 'permits'
      ],

      storageModifiers: [
        'public', 'private', 'protected', 'static', 'final', 'abstract',
        'volatile', 'transient', 'synchronized', 'native', 'strictfp'
      ],

      operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
        '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
        '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
        '%=', '<<=', '>>=', '>>>=', '->'
      ],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|[0-7]{1,3})/,
      digits: /\d+(_+\d+)*/,

      tokenizer: {
        root: [
          // 대문자 식별자 → 타입 (String, Main, Random, UUID, User 등)
          [/[A-Z][\w$]*/, 'type.identifier'],

          // 메서드 호출/선언: 소문자 식별자 + (  (키워드/접근제어자는 예외로 빼야 함)
          [/[a-z_$][\w$]*(?=\s*\()/, {
            cases: {
              '@storageModifiers': 'storage.modifier',
              '@keywords': 'keyword',
              '@default': 'entity.name.function'
            }
          }],

          // 소문자 식별자 / 키워드 / 접근제어자
          [/[a-z_$][\w$]*/, {
            cases: {
              '@storageModifiers': 'storage.modifier',
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],

          // 공백/주석
          { include: '@whitespace' },

          // 어노테이션
          [/@[a-zA-Z_$][\w$]*/, 'annotation'],

          // 괄호
          [/[{}()\[\]]/, '@brackets'],
          [/[<>](?!@symbols)/, '@brackets'],

          // 연산자
          [/@symbols/, {
            cases: {
              '@operators': 'delimiter',
              '@default': ''
            }
          }],

          // 숫자
          [/(@digits)[eE]([\-+]?(@digits))?[fFdD]?/, 'number.float'],
          [/(@digits)\.(@digits)([eE][\-+]?(@digits))?[fFdD]?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+[Ll]?/, 'number.hex'],
          [/0[0-7]+[Ll]?/, 'number.octal'],
          [/(@digits)[fFdD]/, 'number.float'],
          [/(@digits)[lL]?/, 'number'],

          // 구분자
          [/[;,.]/, 'delimiter'],

          // 문자열
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

          // 문자
          [/'[^\\']'/, 'string'],
          [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
          [/'/, 'string.invalid']
        ],

        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*\*(?!\/)/, 'comment.doc', '@javadoc'],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],

        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],

        javadoc: [
          [/[^\/*]+/, 'comment.doc'],
          [/\*\//, 'comment.doc', '@pop'],
          [/[\/*]/, 'comment.doc']
        ],

        string: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
      }
    });

    // CSS 변수에서 에디터 배경 읽어와 Monaco 테마와 동기화
    const editorBg = getComputedStyle(document.documentElement)
      .getPropertyValue('--free-editor-bg').trim() || '#181825';
    const bgHex = editorBg.replace('#', '');
    const syncedTheme = {
      ...nightOwlTheme,
      rules: nightOwlTheme.rules.map(r =>
        r.token === '' ? { ...r, background: bgHex } : r
      ),
      colors: { ...nightOwlTheme.colors, 'editor.background': editorBg },
    };
    monaco.editor.defineTheme('night-owl', syncedTheme);
    monaco.editor.setTheme('night-owl');
  };

  // Shift+1/2 → 왼쪽 탭, Shift+3/4 → 오른쪽 탭
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.shiftKey) return;
      // 채팅 input(type=text)에 포커스 있을 때만 무시. Monaco의 hidden textarea는 허용.
      const el = document.activeElement;
      if (el && el.tagName === 'INPUT' && el.type === 'text') return;

      if (e.code === 'Digit1') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab(TABS[0].id);
      } else if (e.code === 'Digit2') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab(TABS[1].id);
      } else if (e.code === 'Digit3') {
        e.preventDefault();
        e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[0].id);
      } else if (e.code === 'Digit4') {
        e.preventDefault();
        e.stopPropagation();
        setActiveRightTab(RIGHT_TABS[1].id);
      }
    };
    // capture phase로 등록 → Monaco가 키를 먼저 먹기 전에 가로채기
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const container = splitContainerRef.current;
    if (!container) return;
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
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


  return (
    <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">

      {/* ── 왼쪽: 코드 패널 ── */}
      <div
        className="flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg shrink-0"
        style={{ width: `${splitRatio * 100}%` }}
      >
        {/* 탭 바 */}
        <div className="free-tab-bar flex items-end shrink-0" style={{ minHeight: 42 }}>
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`free-tab ${activeTab === tab.id ? 'free-tab-active' : 'free-tab-inactive'}`}
            >
              <span>{tab.label}</span>
              <span className="free-tab-shortcut">⇧{idx + 1}</span>
            </button>
          ))}
          <div className="free-tab-right-panel ml-auto flex items-center gap-1.5 px-3 py-1.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <span>⌨️</span>타자연습
            </button>
            <button
              onClick={() => setIsReadOnly(v => !v)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-gray-400 hover:bg-white/10 transition-all"
            >
              <span className={isReadOnly ? 'text-[#f59e0b]' : 'text-gray-500'}>
                {isReadOnly ? '읽기 모드' : '수정 모드'}
              </span>
              {/* 토글 스위치 */}
              <div className={`relative w-7 h-4 rounded-full transition-colors duration-200 ${isReadOnly ? 'bg-[#f59e0b]' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${isReadOnly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Monaco */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="java"
            path={activeTab}
            value={tabContents[activeTab]}
            onChange={(v) => setTabContents(prev => ({ ...prev, [activeTab]: v ?? '' }))}
            onMount={handleEditorMount}
            options={{
              fontSize: 14,
              fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
              fontWeight: '350',
              fontLigatures: false,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              folding: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
              bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
              'semanticHighlighting.enabled': false,
              readOnly: isReadOnly,
              readOnlyMessage: { value: '읽기 모드입니다. 수정하려면 토글을 꺼주세요.' },
            }}
          />
        </div>
      </div>

      {/* ── 스플리터 ── */}
      <div
        onMouseDown={handleSplitMouseDown}
        className="w-1.5 cursor-col-resize flex items-center justify-center group hover:bg-cyan-500/20 transition-colors rounded-full mx-0.5 shrink-0"
      >
        <div className="w-0.5 h-8 bg-gray-600 group-hover:bg-cyan-400 rounded-full transition-colors" />
      </div>

      {/* ── 오른쪽: 채팅 패널 ── */}
      <div
        className="flex-1 min-w-0 flex flex-col bg-[var(--free-editor-bg)] rounded-lg overflow-hidden border border-[#2c313a] shadow-lg"
        ref={(el) => {
          if (!el || el._wheelBound) return;
          el._wheelBound = true;
          el.addEventListener('wheel', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setChatFontSize(prev => Math.max(10, Math.min(24, prev + (e.deltaY < 0 ? 1 : -1))));
          }, { passive: false });
        }}
      >
        {/* 탭 바 */}
        <div className="free-tab-bar flex items-end shrink-0" style={{ minHeight: 42 }}>
          {RIGHT_TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveRightTab(tab.id)}
              className={`free-tab ${activeRightTab === tab.id ? 'free-tab-active' : 'free-tab-inactive'}`}
            >
              <span>{tab.label}</span>
              <span className="free-tab-shortcut">⇧{idx + 3}</span>
            </button>
          ))}
          <div className="free-tab-right-panel ml-auto flex items-center gap-1.5 px-3 py-1.5">
            <button
              onClick={onBack}
              className="text-[10px] px-2.5 py-1 rounded-md font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-all"
            >
              학습 종료 ✕
            </button>
          </div>
        </div>

        {/* 채팅 영역 — Ctrl+휠 글씨 크기 */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ fontSize: `${chatFontSize}px` }}
        >
          <p className="text-gray-600 text-center mt-8">코드에 대해 뭐든 물어보세요</p>
        </div>

        {/* 입력창 */}
        <div className="p-3 border-t border-[#2c313a]">
          <div className="flex gap-2">
            <input
              placeholder="Lucid에게 물어보기"
              className="flex-1 bg-[#14161a] text-white text-sm rounded-lg px-3 py-3 focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-[#2c313a] focus:border-cyan-500 transition-colors"
            />
            <button className="bg-cyan-500 text-black text-sm font-bold px-5 py-3 rounded-lg hover:bg-cyan-400 transition-colors">
              전송
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FreeStudyView;
