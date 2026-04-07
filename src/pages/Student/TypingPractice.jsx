import { useState, useEffect, useRef, useCallback } from 'react';

// 타자연습용 코드 스니펫 (레벨별)
const CODE_SNIPPETS = [
  // 레벨 1: 기초 출력
  {
    level: 1,
    title: 'Hello World',
    lang: 'java',
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
    }
}`,
  },
  // 레벨 2: 변수 선언
  {
    level: 1,
    title: '변수 선언',
    lang: 'java',
    code: `int age = 25;
String name = "Kim";
double score = 95.5;
boolean pass = true;`,
  },
  // 레벨 3: 조건문
  {
    level: 2,
    title: 'if-else 조건문',
    lang: 'java',
    code: `if (score >= 90) {
    System.out.println("A");
} else if (score >= 80) {
    System.out.println("B");
} else {
    System.out.println("C");
}`,
  },
  // 레벨 4: 반복문
  {
    level: 2,
    title: 'for 반복문',
    lang: 'java',
    code: `for (int i = 0; i < 10; i++) {
    System.out.println(i);
}`,
  },
  // 레벨 5: 배열
  {
    level: 3,
    title: '배열 선언과 순회',
    lang: 'java',
    code: `String[] fruits = {"apple", "banana", "cherry"};
for (int i = 0; i < fruits.length; i++) {
    System.out.println(fruits[i]);
}`,
  },
  // 레벨 6: 클래스
  {
    level: 3,
    title: '클래스와 생성자',
    lang: 'java',
    code: `public class Player {
    String name;
    int level;

    public Player(String name, int level) {
        this.name = name;
        this.level = level;
    }
}`,
  },
  // 레벨 7: 메서드
  {
    level: 4,
    title: '메서드 정의',
    lang: 'java',
    code: `public static int add(int a, int b) {
    return a + b;
}

public static void main(String[] args) {
    int result = add(3, 5);
    System.out.println(result);
}`,
  },
  // 레벨 8: try-catch
  {
    level: 4,
    title: '예외 처리',
    lang: 'java',
    code: `try {
    int result = 10 / 0;
} catch (ArithmeticException e) {
    System.out.println("0으로 나눌 수 없습니다");
} finally {
    System.out.println("종료");
}`,
  },
];

const TypingPractice = ({ onBack }) => {
  const [snippetIdx, setSnippetIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [errors, setErrors] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const snippet = CODE_SNIPPETS[snippetIdx];
  const target = snippet.code;

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, [snippetIdx]);

  // 리셋
  const resetPractice = useCallback(() => {
    setTyped('');
    setStartTime(null);
    setEndTime(null);
    setErrors(0);
    setIsComplete(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // 키 입력 처리
  const handleKeyDown = (e) => {
    if (isComplete) return;

    // 시작 시간 기록
    if (!startTime && e.key.length === 1) {
      setStartTime(Date.now());
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      setTyped(prev => prev + '    '); // 4칸 스페이스
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      setTyped(prev => prev + '\n');
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      setTyped(prev => prev.slice(0, -1));
      return;
    }

    if (e.key.length === 1) {
      const newTyped = typed + e.key;
      setTyped(newTyped);

      // 오류 체크
      if (e.key !== target[typed.length]) {
        setErrors(prev => prev + 1);
      }

      // 완료 체크
      if (newTyped.length >= target.length) {
        setEndTime(Date.now());
        setIsComplete(true);
      }
    }
  };

  // 통계 계산
  const elapsedSec = endTime && startTime ? (endTime - startTime) / 1000 : 0;
  const totalChars = target.length;
  const accuracy = totalChars > 0 ? Math.max(0, Math.round(((totalChars - errors) / totalChars) * 100)) : 100;
  const cpm = elapsedSec > 0 ? Math.round((typed.length / elapsedSec) * 60) : 0;

  // 현재 진행률
  const progress = Math.min((typed.length / target.length) * 100, 100);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-8 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => inputRef.current?.focus()}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-white transition p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ⌨️ 타자연습
              <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                {snippetIdx + 1} / {CODE_SNIPPETS.length}
              </span>
            </h2>
            <p className="text-sm text-gray-500">{snippet.title}</p>
          </div>
        </div>

        {/* 실시간 스탯 */}
        <div className="flex items-center gap-4 text-sm">
          {startTime && !isComplete && (
            <span className="text-gray-400">타이핑 중...</span>
          )}
          <div className="flex items-center gap-1.5 text-gray-500">
            <span className="text-[10px]">정확도</span>
            <span className={`font-bold ${accuracy >= 95 ? 'text-[#4ec9b0]' : accuracy >= 80 ? 'text-[#fbbf24]' : 'text-[#ef4444]'}`}>
              {typed.length > 0 ? `${accuracy}%` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-1 bg-white/[0.06] rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4ec9b0] to-[#569cd6] rounded-full transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 코드 영역 */}
      <div className="flex-1 relative bg-[#1e1e1e] rounded-xl border border-[#333] p-6 font-mono text-sm leading-7 overflow-auto">
        {/* 숨겨진 input (포커스 유지용) */}
        <input
          ref={inputRef}
          className="absolute opacity-0 w-0 h-0"
          onBlur={() => !isComplete && setTimeout(() => inputRef.current?.focus(), 10)}
          readOnly
        />

        {/* 코드 렌더링 */}
        <pre className="whitespace-pre-wrap">
          {target.split('').map((char, i) => {
            let className = 'text-gray-600'; // 아직 안 친 글자
            let bgClass = '';

            if (i < typed.length) {
              if (typed[i] === char) {
                className = 'text-[#4ec9b0]'; // 정확
              } else {
                className = 'text-[#ef4444]'; // 오류
                bgClass = 'bg-[#ef4444]/10';
              }
            } else if (i === typed.length) {
              // 현재 커서 위치
              bgClass = 'bg-[#4ec9b0]/20 border-l-2 border-[#4ec9b0] animate-pulse';
            }

            return (
              <span key={i} className={`${className} ${bgClass}`}>
                {char === '\n' ? '↵\n' : char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </pre>
      </div>

      {/* 완료 결과 */}
      {isComplete && (
        <div className="mt-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 animate-fade-in-up">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-white mb-1">
              {accuracy >= 95 ? '🎉 완벽해요!' : accuracy >= 80 ? '👍 잘했어요!' : '💪 다시 도전해봐요!'}
            </h3>
            <p className="text-sm text-gray-500">{snippet.title} 완료</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-black text-[#4ec9b0]">{accuracy}%</div>
              <div className="text-[11px] text-gray-500">정확도</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-[#569cd6]">{cpm}</div>
              <div className="text-[11px] text-gray-500">CPM (분당 타수)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-[#fbbf24]">{elapsedSec.toFixed(1)}s</div>
              <div className="text-[11px] text-gray-500">소요 시간</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={resetPractice}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-400 hover:text-white hover:bg-white/10 transition"
            >
              다시 하기
            </button>
            {snippetIdx < CODE_SNIPPETS.length - 1 && (
              <button
                onClick={() => { setSnippetIdx(prev => prev + 1); resetPractice(); }}
                className="px-4 py-2 rounded-xl bg-[#4ec9b0]/10 border border-[#4ec9b0]/30 text-sm font-bold text-[#4ec9b0] hover:bg-[#4ec9b0]/20 transition"
              >
                다음 스니펫 →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 힌트 */}
      {!isComplete && !startTime && (
        <div className="mt-4 text-center text-gray-600 text-sm">
          화면을 클릭하고 타이핑을 시작하세요 · <span className="text-gray-500">Tab = 4칸 들여쓰기</span>
        </div>
      )}
    </div>
  );
};

export default TypingPractice;
