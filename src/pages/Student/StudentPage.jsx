import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import RepoSelect from './RepoSelect';
import ModeSelect from './ModeSelect';
import ConceptSelect from './ConceptSelect';
import ChatView from './ChatView';
import ResultView from './ResultView';

const StudentPage = ({ user, userData, onLogout }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const groupIDs = userData?.groupIDs || [];
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 단계별 선택 데이터
  const [teacher, setTeacher] = useState(null);   // { name, githubUsername }
  const [repo, setRepo] = useState(null);          // { name, label }
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
    <div className="flex h-svh bg-theme-bg text-white overflow-hidden">
      
      {/* 좌측 사이드바 (IDE 파스텔/글래스 스타일) */}
      <aside className="w-64 shrink-0 bg-theme-sidebar border-r border-theme-border flex flex-col justify-between p-4 hidden md:flex">
        <div>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition"
            onClick={reset}
          >
            {/* Login과 동일한 빛번짐 아이콘 로고 */}
            <div className="p-2 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-xl backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shadow-[0_0_15px_rgba(78,201,176,0.2)] shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#student-logo-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="student-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ec9b0" />
                    <stop offset="100%" stopColor="#569cd6" />
                  </linearGradient>
                </defs>
                <path d="m18 16 4-4-4-4"/>
                <path d="m6 8-4 4 4 4"/>
                <path d="m14.5 4-5 16"/>
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Lucid</h1>
          </div>
          
          <div className="mt-8 px-2 space-y-1 text-sm">
            <p className="text-theme-secondary font-medium px-2 pb-2">기록</p>
            <div className="text-gray-400 py-1.5 px-2 hover:bg-white/5 rounded-lg cursor-pointer transition">
              최근 선택한 레포지토리
            </div>
          </div>
        </div>

        {/* 사이드바 하단 프로필 및 설정 (GPT 스타일 팝업 메뉴) */}
        <div className="relative">
          {/* 클릭 시 팝업되는 메뉴 */}
          {isMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-theme-card border border-theme-border rounded-xl shadow-2xl overflow-hidden py-1 z-50 animate-fade-in-up">
              {/* TODO: 임시로 누구나 보이게 해둠. 추후 userData?.role === 'admin' 으로 복구 */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/admin');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-theme-primary hover:bg-white/5 transition"
              >
                <svg className="w-4 h-4 text-theme-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                관리자 페이지
              </button>
              
              <div className="h-px w-full bg-theme-border/50 my-1" />
              
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                로그아웃
              </button>
            </div>
          )}

          {/* 프로필 버튼 */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-between w-full p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
          >
            <div className="flex items-center gap-3 px-2">
               <div className="w-8 h-8 rounded-full bg-[#E5E5E5] flex items-center justify-center shrink-0 text-xs font-bold text-[#171717]">
                 {user?.displayName ? user.displayName[0] : 'U'}
               </div>
               <span className="text-sm font-medium truncate max-w-[100px] text-theme-primary">{user?.displayName}</span>
            </div>
            <svg className={`w-4 h-4 text-theme-secondary transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* 모바일 상단 바 (작은 화면에서만 노출) */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-theme-sidebar border-b border-theme-border absolute top-0 w-full z-10">
         <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-theme-primary/20 to-theme-icon/20 rounded-lg backdrop-blur-md border border-white/10 ring-1 ring-theme-primary/30 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="url(#student-logo-gradient-mob)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="student-logo-gradient-mob" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ec9b0" />
                    <stop offset="100%" stopColor="#569cd6" />
                  </linearGradient>
                </defs>
                <path d="m18 16 4-4-4-4"/>
                <path d="m6 8-4 4 4 4"/>
                <path d="m14.5 4-5 16"/>
              </svg>
            </div>
           Lucid
         </h1>
         <div className="flex items-center gap-3">
            {/* 모바일 화면에서는 버튼으로 바로 노출. 일단 누구나 볼 수 있게 임시 설정 */}
            <button onClick={() => navigate('/admin')} className="text-theme-secondary hover:text-white transition p-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
           <button onClick={onLogout} className="text-theme-secondary text-sm">
             로그아웃
           </button>
         </div>
      </header>

      {/* 단계별 메인 렌더링 영역 */}
      <main className="flex-1 overflow-y-auto p-4 pt-16 md:pt-4 md:p-8 flex justify-center bg-theme-bg">
        <div className="w-full max-w-4xl h-full flex flex-col justify-center pb-12">
          {groupIDs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in-up mt-20 md:mt-0">
               <div className="bg-theme-card/90 border border-theme-border rounded-[2rem] p-10 max-w-md w-full shadow-2xl backdrop-blur-xl">
                 <div className="w-16 h-16 mx-auto mb-6 bg-theme-primary/10 rounded-full flex items-center justify-center">
                   <svg className="w-8 h-8 text-theme-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                   </svg>
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-3">소속된 클래스가 없습니다.</h2>
                 <p className="text-gray-400 text-sm mb-2 leading-relaxed">
                   관리자에게 문의해주세요.
                 </p>
               </div>
            </div>
          ) : (
            <>
              {step === 1 && (
                <RepoSelect
                  groupIDs={groupIDs}
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
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentPage;
