const ModeSelect = ({ teacher, repo, onSelect, onBack }) => {
  return (
    <div className="max-w-md mx-auto flex flex-col gap-6">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-300 self-start"
      >
        &larr; 뒤로
      </button>

      <h2 className="text-lg font-semibold">
        <span className="text-cyan-400">{repo?.label}</span> 학습 모드를
        선택하세요
      </h2>

      <div className="flex flex-col gap-3">
        {/* 챕터 모드 */}
        <button
          onClick={() => onSelect('chapter')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-400 rounded-lg px-6 py-5 text-left transition"
        >
          <p className="font-medium text-white">챕터 모드</p>
          <p className="text-sm text-gray-400 mt-1">
            개념 단위로 선택 (배열, for문, 클래스 등)
          </p>
        </button>

        {/* 날짜 모드 */}
        <button
          onClick={() => onSelect('date')}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-400 rounded-lg px-6 py-5 text-left transition"
        >
          <p className="font-medium text-white">날짜 모드</p>
          <p className="text-sm text-gray-400 mt-1">
            날짜를 선택해서 그날 커밋된 코드 불러오기
          </p>
        </button>
      </div>
    </div>
  );
};

export default ModeSelect;
