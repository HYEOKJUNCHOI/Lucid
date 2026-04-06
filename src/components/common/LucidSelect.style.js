import styled from '@emotion/styled';

export const S = {
  Container: styled.div`
    position: relative;
    width: 100%;
    user-select: none;
  `,

  SelectButton: styled.div`
    width: 100%;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid ${props => props.isOpen ? '#4ec9b0' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 12px;
    padding: 12px 16px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s ease;
    box-shadow: ${props => props.isOpen ? '0 0 15px rgba(78, 201, 176, 0.1)' : 'none'};

    &:hover {
      border-color: rgba(78, 201, 176, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
  `,

  ValueWrapper: styled.div`
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,

  SelectedName: styled.span`
    font-size: 14px;
    font-weight: 500;
    color: ${props => props.hasValue ? 'white' : 'rgba(255, 255, 255, 0.3)'};
  `,

  SelectedSub: styled.span`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
  `,

  DropdownMenu: styled.div`
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 100%;
    max-height: 280px;
    background: rgba(20, 20, 20, 0.9);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.2s ease-out;

    /* Scrollbar Styling */
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,

  OptionItem: styled.div`
    padding: 12px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: all 0.15s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(78, 201, 176, 0.1);
    }

    ${props => props.isSelected && `
      background: rgba(78, 201, 176, 0.15);
      border-left: 3px solid #4ec9b0;
    `}
  `,

  OptionName: styled.span`
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.isSelected ? '#4ec9b0' : 'white'};
  `,

  OptionSub: styled.span`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    word-break: break-all;
  `,

  ArrowIcon: styled.div`
    color: ${props => props.isOpen ? '#4ec9b0' : 'rgba(255, 255, 255, 0.3)'};
    transition: transform 0.3s ease;
    transform: rotate(${props => props.isOpen ? '180deg' : '0deg'});
  `
};
