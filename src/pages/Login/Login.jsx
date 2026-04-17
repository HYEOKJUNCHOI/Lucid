import { useEffect, useState, useMemo } from 'react';
import Toast, { showToast } from '../../components/common/Toast';

/* ── 아이콘 ── */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
  </svg>
);
const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z"/>
  </svg>
);
const KakaoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.608 5.08 4.05 6.56L5.1 21l4.29-2.82A11.5 11.5 0 0 0 12 18.6c5.523 0 10-3.477 10-7.8S17.523 3 12 3Z"/>
  </svg>
);

/* ── 코드 블록 풀 (들여쓰기 층이 강조된 리얼 코드) ── */
const CODE_POOLS = [
  [
    { text: 'public class StudentAuthProvider {', color: '#569cd6' },
    { text: '    private final SecurityTokenService tokenService;', color: '#9cdcfe' },
    { text: '    ', color: '#fff' },
    { text: '    public AuthResult authenticate(Credentials req) {', color: '#dcdcaa' },
    { text: '        if (!isValid(req)) {', color: '#ce9178' },
    { text: '            throw new ValidationException();', color: '#ce9178' },
    { text: '        }', color: '#569cd6' },
    { text: '        return tokenService.generate();', color: '#b5cea8' },
    { text: '    }', color: '#569cd6' },
    { text: '}', color: '#569cd6' },
  ],
  [
    { text: 'export async function fetchUserDashboard(uid: string) {', color: '#c586c0' },
    { text: '  try {', color: '#569cd6' },
    { text: '    const cached = await redis.get(`user:${uid}`);', color: '#9cdcfe' },
    { text: '    if (cached) {', color: '#4ec9b0' },
    { text: '      return JSON.parse(cached);', color: '#4ec9b0' },
    { text: '    }', color: '#569cd6' },
    { text: '    const data = await db.query(SQL_QUERY, [uid]);', color: '#ce9178' },
    { text: '    return process(data);', color: '#dcdcaa' },
    { text: '  } catch (err) {', color: '#569cd6' },
    { text: '    logger.error("Fetch failed", err);', color: '#ce9178' },
    { text: '  }', color: '#569cd6' },
    { text: '}', color: '#c586c0' },
  ],
  [
    { text: 'class AbstractDependencyInjector<T> implements Injector {', color: '#569cd6' },
    { text: '    private final Map<Class<?>, Object> registry;', color: '#9cdcfe' },
    { text: '    ', color: '#fff' },
    { text: '    public void register(Class<V> clazz, V instance) {', color: '#dcdcaa' },
    { text: '        if (instance == null) {', color: '#ce9178' },
    { text: '            log.warn("Null injection attempt");', color: '#ce9178' },
    { text: '            return;', color: '#569cd6' },
    { text: '        }', color: '#569cd6' },
    { text: '        registry.putIfAbsent(clazz, instance);', color: '#dcdcaa' },
    { text: '    }', color: '#569cd6' },
    { text: '}', color: '#569cd6' },
  ],
  [
    { text: 'function setupWebSocket(endpoint: string) {', color: '#6a9955' },
    { text: '  return new Observable(sub => {', color: '#569cd6' },
    { text: '    let attempt = 0;', color: '#9cdcfe' },
    { text: '    const connect = () => {', color: '#569cd6' },
    { text: '      const ws = new WebSocket(endpoint);', color: '#ce9178' },
    { text: '      ws.onmessage = (e) => sub.next(e.data);', color: '#b5cea8' },
    { text: '      ws.onerror = (e) => {', color: '#dcdcaa' },
    { text: '        setTimeout(connect, 1000 * attempt++);', color: '#b5cea8' },
    { text: '      };', color: '#dcdcaa' },
    { text: '    };', color: '#569cd6' },
    { text: '    connect();', color: '#ce9178' },
    { text: '  });', color: '#569cd6' },
    { text: '}', color: '#6a9955' },
  ],
  [
    { text: '@RestController', color: '#4ec9b0' },
    { text: '@RequestMapping("/api/v1/workloads")', color: '#4ec9b0' },
    { text: 'public class DistController {', color: '#569cd6' },
    { text: '    @PostMapping("/rebalance")', color: '#4ec9b0' },
    { text: '    public ResponseEntity<Response> rebalance(@RequestBody Config con) {', color: '#dcdcaa' },
    { text: '        long start = System.currentTimeMillis();', color: '#9cdcfe' },
    { text: '        clusterSvc.initialize(con);', color: '#b5cea8' },
    { text: '        return ResponseEntity.ok(success(start));', color: '#ce9178' },
    { text: '    }', color: '#569cd6' },
    { text: '}', color: '#569cd6' },
  ],
];

/* ── 확장된 위치 생성: 전면 커버링 (화면 가득 채우기, 겹침 방지 격자 배치) ── */
function makePositions() {
  // 화면을 3x3 (총 9개 칸) 그리드로 쪼개어, 각 코드 뭉치가 자기 영역 안에서만 놀도록 배치합니다.
  // 가로(X): 3% (좌), 38% (중앙), 73% (우)
  // 세로(Y): 3% (상단), 38% (중간), 73% (하단)
  return [
    { left: '3%', top: '3%' },
    { left: '38%', top: '6%' },
    { left: '73%', top: '3%' },
    { left: '5%', top: '38%' },
    { left: '35%', top: '42%' },
    { left: '70%', top: '38%' },
    { left: '3%', top: '73%' },
    { left: '38%', top: '76%' },
    { left: '75%', top: '73%' },
  ];
}

/* ── 랜덤 딜레이 생성기 ── */
function useRandomDelays(count) {
  return useMemo(() => Array.from({ length: count }, () => Math.random() * 2000), [count]);
}

/* ── 타이핑 블록 컴포넌트 ── */
const TypingBlock = ({ lines, posStyle, startDelay = 0 }) => {
  const [displayed, setDisplayed] = useState([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;

    if (currentLine >= lines.length) {
      // 끝까지 다 쳤으면 일정 시간이 지난 후 리셋하여 다시 타이핑하도록 루프 적용
      const t = setTimeout(() => {
        setDisplayed([]);
        setCurrentLine(0);
        setCurrentChar(0);
        setStarted(false); // 리셋
        setTimeout(() => setStarted(true), 2000 + Math.random() * 3000);
      }, 5000);
      return () => clearTimeout(t);
    }

    const line = lines[currentLine];
    if (line.text === '') {
      const t = setTimeout(() => {
        setDisplayed((d) => [...d, line]);
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }, 100);
      return () => clearTimeout(t);
    }

    if (currentChar < line.text.length) {
      const t = setTimeout(() => setCurrentChar((c) => c + 1), 30 + Math.random() * 40);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setDisplayed((d) => [...d, line]);
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [started, currentLine, currentChar, lines]);

  const isTyping = started && currentLine < lines.length;
  const currentText = isTyping ? lines[currentLine].text.slice(0, currentChar) : '';
  const currentColor = isTyping ? lines[currentLine].color : '';

  return (
    <div
      className="absolute font-mono select-none pointer-events-none blur-[1px] sm:blur-[2px] opacity-30 mix-blend-screen"
      style={{ ...posStyle, fontSize: '15px', lineHeight: '1.8rem', whiteSpace: 'pre' }}
    >
      {displayed.map((line, i) => (
        <div key={i} style={{ color: line.color || '#fff' }}>
          {line.text || '\u00A0'}
        </div>
      ))}
      {isTyping && (
        <div style={{ color: currentColor }}>
          {currentText}<span className="animate-pulse">▋</span>
        </div>
      )}
    </div>
  );
};

/* ── 메인 컴포넌트 ── */
// loginLoading: null | 'google' | 'github' | 'email' | 'admin'
const Login = ({ loginLoading, loginError, onLogin, onGithubLogin, onAdminLogin, onEmailLogin }) => {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailVal, setEmailVal] = useState('');
  const [emailPw, setEmailPw] = useState('');
  // 위치와 순서를 고정
  const positions = useMemo(() => makePositions(), []);
  const codeOrder = useMemo(() => Array.from({ length: positions.length }, () => Math.floor(Math.random() * CODE_POOLS.length)), [positions]);
  const delays = useRandomDelays(positions.length);

  // 중복 로그인 감지 시 3초 후 자동 새로고침
  const [reloadCountdown, setReloadCountdown] = useState(null);
  const isDuplicateLogin = loginError?.includes('다른 기기에서');
  useEffect(() => {
    if (!isDuplicateLogin) { setReloadCountdown(null); return; }
    setReloadCountdown(3);
    const iv = setInterval(() => {
      setReloadCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); window.location.reload(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [isDuplicateLogin]);

  return (
    <div className="relative flex items-center justify-center min-h-dvh bg-theme-bg overflow-hidden text-gray-200 pt-safe pb-safe">
      <Toast />
      
      {/* 백그라운드 디자인 - GPT 계열 다크그린/그레이 베이스 (채도를 확 낮춤) */}
      <div className="absolute inset-0 z-0">

        {/* 타이핑되는 코드들 - 화면 전체 분포 */}
        {positions.map((pos, i) => (
          <TypingBlock
            key={i}
            lines={CODE_POOLS[codeOrder[i]]}
            posStyle={pos}
            startDelay={delays[i]}
          />
        ))}

      </div>

      {/* 메인 로그인 카드 */}
      <div className="relative z-10 flex flex-col items-center w-[90%] max-w-sm px-4 py-8 md:px-8 md:py-12 rounded-[2rem] bg-theme-card/90 backdrop-blur-xl border border-theme-border shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        
        <div className="flex flex-col items-center gap-3 mb-6 md:mb-10">
          <div className="p-3 md:p-4 bg-[#1a1a1a] rounded-3xl mb-2 border border-[#2a2a2a] shadow-[0_0_30px_rgba(78,201,176,0.15)] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 16 4-4-4-4"/>
              <path d="m6 8-4 4 4 4"/>
              <path d="m14.5 4-5 16"/>
            </svg>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2 pb-1">
            Lucid
          </h1>
          <p className="text-base font-medium text-center">
            <span className="text-white font-bold">Focus On,</span> <span className="text-[#4ec9b0] font-bold" style={{ textShadow: '0 0 12px rgba(78,201,176,0.7)' }}>Noise Off</span>
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={onLogin}
            disabled={loginLoading !== null}
            className="group relative overflow-hidden w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3.5 px-4 rounded-xl shadow-lg hover:-translate-y-0.5 hover:shadow-xl hover:shadow-white/10 transition-all duration-300 disabled:cursor-wait disabled:transform-none min-h-[44px]"
          >
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out pointer-events-none" />
            <GoogleIcon />
            {loginLoading === 'google' ? '인증 중...' : 'Google로 시작하기'}
          </button>

          {/* 이메일 로그인/가입 */}
          <button
            onClick={() => { setShowEmailForm(v => !v); setShowAdminForm(false); }}
            disabled={loginLoading !== null}
            className="w-full flex items-center justify-center gap-3 bg-white/[0.07] text-white font-semibold py-3.5 px-4 rounded-xl border border-white/[0.12] hover:bg-white/[0.12] hover:-translate-y-0.5 transition-all duration-300 disabled:cursor-wait disabled:transform-none min-h-[44px]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            {loginLoading === 'email' ? '처리 중...' : '이메일로 시작하기'}
          </button>
          {showEmailForm && (
            <div className="flex flex-col gap-2 -mt-1">
              <input
                type="email"
                placeholder="이메일"
                value={emailVal}
                onChange={e => setEmailVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onEmailLogin?.(emailVal, emailPw)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-base md:text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0]/50"
              />
              <input
                type="password"
                placeholder="비밀번호 (6자 이상)"
                value={emailPw}
                onChange={e => setEmailPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onEmailLogin?.(emailVal, emailPw)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-base md:text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0]/50"
              />
              <button
                onClick={() => onEmailLogin?.(emailVal, emailPw)}
                disabled={loginLoading !== null || !emailVal || !emailPw}
                className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 hover:bg-[#4ec9b0]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                {loginLoading === 'email' ? '처리 중...' : '로그인 / 가입'}
              </button>
              <p className="text-[10px] text-gray-600 text-center">학원에서 등록한 이메일로 가입해 주세요</p>
            </div>
          )}

          <button
            onClick={() => showToast('카카오 로그인은 v2 업데이트 예정입니다.', 'warn')}
            className="relative w-full flex items-center justify-center gap-3 bg-[#FEE500]/90 text-[#191919] font-semibold py-3.5 px-4 rounded-xl hover:bg-[#FEE500] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 min-h-[44px]"
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>

          <button
            onClick={() => showToast('GitHub 로그인은 v2 업데이트 예정입니다.', 'warn')}
            className="relative w-full flex items-center justify-center gap-3 bg-black/50 text-white font-semibold py-3.5 px-4 rounded-xl border border-gray-700 backdrop-blur-md hover:bg-black/80 hover:-translate-y-0.5 hover:border-gray-500 hover:shadow-lg transition-all duration-300 min-h-[44px]"
          >
            <GithubIcon />
            GitHub로 시작하기
          </button>
        </div>

        {loginError && (
          <div className="mt-5 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-xs text-center font-medium">{loginError}</p>
            {reloadCountdown !== null && (
              <p className="text-red-400/60 text-[11px] text-center mt-1">{reloadCountdown}초 후 자동 새로고침...</p>
            )}
          </div>
        )}

        {/* 관리자 로그인 토글 */}
        <button
          onClick={() => setShowAdminForm(v => !v)}
          className="mt-4 md:mt-6 text-[11px] text-gray-600 hover:text-gray-400 transition-colors min-h-[44px] flex items-center"
        >
          {showAdminForm ? '▲ 관리자 로그인 접기' : '관리자'}
        </button>

        {showAdminForm && (
          <div className="w-full mt-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="아이디"
              value={adminId}
              onChange={e => setAdminId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdminLogin?.(adminId, adminPw)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-base md:text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0]/50"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={adminPw}
              onChange={e => setAdminPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdminLogin?.(adminId, adminPw)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-base md:text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-[#4ec9b0]/50"
            />
            <button
              onClick={() => onAdminLogin?.(adminId, adminPw)}
              disabled={loginLoading !== null || !adminId || !adminPw}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#4ec9b0]/20 border border-[#4ec9b0]/30 hover:bg-[#4ec9b0]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loginLoading === 'admin' ? '로그인 중...' : '로그인'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default Login;
