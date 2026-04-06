import { useState } from 'react';
import TeacherSelect from './TeacherSelect';
import ModeSelect from './ModeSelect';
import ConceptSelect from './ConceptSelect';
import ChatView from './ChatView';
import ResultView from './ResultView';

const StudentPage = ({ user, onLogout }) => {
  const [step, setStep] = useState(1);

  // 단계별 선택 데이터
  const [teacher, setTeacher] = useState(null);   // { name, githubUsername }
  const [repo, setRepo] = useState(null);          // { name, label }  예: { name: "korit_9_gov_java", label: "java" }
  const [mode, setMode] = useState(null);           // "chapter" | "date"
  const [concept, setConcept] = useState(null);     // 선택한 개념/날짜 데이터
  const [result, setResult] = useState(null);       // 학습 결과 데이터

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const reset = () => {
    setStep(1);
    setTeacher(null);
    setRepo(null);
    setMode(null);
    setConcept(null);
    setResult(null);
  };

  return (
    <div className="min-h-svh bg-[#0f0f0f] text-white">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1
          className="text-xl font-bold tracking-tight cursor-pointer"
          onClick={reset}
        >
          Lucid
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.displayName}</span>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 단계별 렌더링 */}
      <main className="p-6">
        {step === 1 && (
          <TeacherSelect
            onSelect={(t, r) => {
              setTeacher(t);
              setRepo(r);
              goNext();
            }}
          />
        )}

        {step === 2 && (
          <ModeSelect
            teacher={teacher}
            repo={repo}
            onSelect={(m) => {
              setMode(m);
              goNext();
            }}
            onBack={goBack}
          />
        )}

        {step === 3 && (
          <ConceptSelect
            teacher={teacher}
            repo={repo}
            mode={mode}
            onSelect={(c) => {
              setConcept(c);
              goNext();
            }}
            onBack={goBack}
          />
        )}

        {step === 4 && (
          <ChatView
            teacher={teacher}
            repo={repo}
            concept={concept}
            onComplete={(r) => {
              setResult(r);
              goNext();
            }}
            onBack={goBack}
          />
        )}

        {step === 5 && (
          <ResultView
            result={result}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
};

export default StudentPage;
