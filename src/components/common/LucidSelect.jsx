import { useState, useRef, useEffect } from 'react';
import { S } from './LucidSelect.style';

const LucidSelect = ({ 
  options = [], 
  value = '', 
  onChange, 
  placeholder = '선택해주세요',
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const handleToggle = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  return (
    <S.Container ref={containerRef}>
      <S.SelectButton isOpen={isOpen} onClick={handleToggle}>
        <S.ValueWrapper>
          <S.SelectedName hasValue={!!selectedOption}>
            {selectedOption ? selectedOption.label : placeholder}
          </S.SelectedName>
          {selectedOption?.sublabel && (
            <S.SelectedSub>{selectedOption.sublabel}</S.SelectedSub>
          )}
        </S.ValueWrapper>
        
        <S.ArrowIcon isOpen={isOpen}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </S.ArrowIcon>
      </S.SelectButton>

      {isOpen && (
        <S.DropdownMenu>
          {options.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-[13px]">
              선택 가능한 항목이 없습니다.
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <S.OptionItem 
                  key={opt.value} 
                  isSelected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                >
                  <S.OptionName isSelected={isSelected}>{opt.label}</S.OptionName>
                  {opt.sublabel && (
                    <S.OptionSub>{opt.sublabel}</S.OptionSub>
                  )}
                </S.OptionItem>
              );
            })
          )}
        </S.DropdownMenu>
      )}
    </S.Container>
  );
};

export default LucidSelect;
