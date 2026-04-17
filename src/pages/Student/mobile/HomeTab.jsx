import React, { useContext } from 'react';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import { StudentContext } from '@/pages/Student/MobileStudentRoot';

export default function HomeTab() {
  const ctx = useContext(StudentContext);
  return (
    <Screen
      bottomTab
      appBar={<MobileTopBar title="홈" largeTitle blurBg />}
      animate="fade"
    >
      <div className="p-4">
        <p className="text-gray-400 text-sm">홈 탭 — L3 에서 리디자인 예정</p>
        <pre className="mt-4 text-[10px] text-gray-500 whitespace-pre-wrap break-all">
          {JSON.stringify(ctx?.userData, null, 2)}
        </pre>
      </div>
    </Screen>
  );
}
