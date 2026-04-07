import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 학습 세션 상태를 중앙 관리하고 로컬 스토리지에 유지(persist)합니다.
 * 새로고침 시에도 기존 학습 단계와 채팅 내역을 복구합니다.
 */
const useLearningStore = create(
  persist(
    (set) => ({
      // 상태 정의
      teacher: null,
      repo: null,
      chapters: [],
      expandedChapters: {},
      chapterFilesMap: {},
      chapterFilesLoadingMap: {},
      step: 1,
      concept: null,
      messages: [],
      learningPhase: 'idle',
      quizCount: 0,
      result: null,
      chaptersLoading: false,
      functionalAnalysis: '',

      // 액션 정의
      setTeacher: (teacher) => set({ teacher }),
      setRepo: (repo) => set({ repo }),
      setChapters: (updater) => set((state) => ({ 
        chapters: typeof updater === 'function' ? updater(state.chapters) : updater 
      })),
      setExpandedChapters: (updater) => set((state) => ({ 
        expandedChapters: typeof updater === 'function' ? updater(state.expandedChapters) : updater 
      })),
      setChapterFilesMap: (updater) => set((state) => ({ 
        chapterFilesMap: typeof updater === 'function' ? updater(state.chapterFilesMap) : updater 
      })),
      setChapterFilesLoadingMap: (updater) => set((state) => ({ 
        chapterFilesLoadingMap: typeof updater === 'function' ? updater(state.chapterFilesLoadingMap) : updater 
      })),
      setStep: (step) => set({ step }),
      setConcept: (concept) => set({ concept }),
      setMessages: (updater) => set((state) => ({ 
        messages: typeof updater === 'function' ? updater(state.messages) : updater 
      })),
      setLearningPhase: (learningPhase) => set({ learningPhase }),
      setQuizCount: (quizCount) => set({ quizCount }),
      setResult: (result) => set({ result }),
      setChaptersLoading: (chaptersLoading) => set({ chaptersLoading }),
      setFunctionalAnalysis: (functionalAnalysis) => set({ functionalAnalysis }),

      // 채팅 세션만 초기화 (파일 변경 시 - 사이드바 상태는 유지)
      resetSession: () => set({
        messages: [],
        learningPhase: 'idle',
        quizCount: 0,
        result: null,
        functionalAnalysis: '',
      }),

      // 전체 초기화 (학습 종료/로그아웃 시)
      reset: () => set({
        teacher: null,
        repo: null,
        chapters: [],
        expandedChapters: {},
        chapterFilesMap: {},
        chapterFilesLoadingMap: {},
        step: 1,
        concept: null,
        messages: [],
        learningPhase: 'idle',
        quizCount: 0,
        result: null,
        chaptersLoading: false,
        functionalAnalysis: '',
      }),
    }),
    {
      name: 'lucid-learning-storage', // 로컬 스토리지 키
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useLearningStore;
