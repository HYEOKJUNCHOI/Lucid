const ResultView = ({ result, onReset }) => {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center gap-8 pt-16">
      <h2 className="text-2xl font-bold">학습 완료!</h2>

      {/* 레벨 표시 (클래시오브클랜 스타일 — 추후 디자인) */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-cyan-400 flex items-center justify-center">
          <span className="text-3xl font-bold text-cyan-400">
            Lv.{result?.level || 1}
          </span>
        </div>
        <p className="text-gray-400 text-sm">오늘의 레벨</p>
      </div>

      {/* 결과 요약 — 추후 상세 데이터 */}
      <div className="w-full bg-gray-800 rounded-lg p-6 flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">학습 점수</span>
          <span className="text-white">{result?.score || 0}점</span>
        </div>
      </div>

      <button
        onClick={onReset}
        className="bg-cyan-400 text-black font-medium px-8 py-3 rounded-xl hover:bg-cyan-300 transition"
      >
        다시 학습하기
      </button>
    </div>
  );
};

export default ResultView;
