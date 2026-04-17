import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '@/components/common/mobile/Screen';
import MobileTopBar from '@/components/common/mobile/MobileTopBar';
import HapticButton from '@/components/common/mobile/HapticButton';
import { useStack } from '@/components/common/mobile/StackNavigator';
import useLearningStore from '@/store/useLearningStore';
import { getGithubFileCache, saveGithubFileCache } from '@/services/learningService';

/**
 * FileDetailScreen — 학습 탭 스택 Level 2.
 *
 * 파일 프리뷰 + 학습 시작 CTA.
 * 학습 시작 시 useLearningStore 의 concept 을 세팅하고 `/chapter` 로 이동해
 * 데스크탑 StudentPage 가 챗 세션(step=2)으로 진입하도록 한다. (SessionView L3-F 완성 전 임시 경로)
 *
 * @param {object} props
 * @param {object} props.file     — { name, downloadUrl, path, sha }
 * @param {object} props.chapter  — { name, label, fullPath }
 */
export default function FileDetailScreen({ file, chapter }) {
  const { pop } = useStack();
  const navigate = useNavigate();
  const setConcept = useLearningStore((s) => s.setConcept);
  const setStep = useLearningStore((s) => s.setStep);
  const markFileVisited = useLearningStore((s) => s.markFileVisited);

  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let text = file.sha ? await getGithubFileCache(file.sha) : null;
        if (!text) {
          const resp = await fetch(file.downloadUrl);
          text = await resp.text();
          if (file.sha) saveGithubFileCache(file.sha, text);
        }
        if (!cancelled) setCode(text);
      } catch (e) {
        console.error('파일 코드 로드 실패:', e);
        if (!cancelled) setError('코드를 불러오지 못했어요');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file.sha, file.downloadUrl]);

  const handleStart = () => {
    markFileVisited(file.path);
    setConcept({
      type: 'file',
      downloadUrl: file.downloadUrl,
      name: file.name,
      path: file.path,
      chapterLabel: chapter?.label || chapter?.name,
    });
    setStep(2);
    // ChatView 진입 — /chapter 루트로 이동 (StudentPage 가 step=2 를 감지해 ChatView 렌더)
    navigate('/chapter');
  };

  // 프리뷰: 코드 앞 200줄 제한 (모바일 스크롤 부담 경감)
  const previewCode = code
    ? code.split('\n').slice(0, 200).join('\n') + (code.split('\n').length > 200 ? '\n\n// ... (생략됨)' : '')
    : '';

  return (
    <Screen
      bottomTab
      appBar={
        <MobileTopBar
          title={file.name}
          leading="back"
          onLeadingClick={pop}
          blurBg
        />
      }
    >
      {/* 파일 헤더 */}
      <div className="px-4 pt-4 pb-2">
        <div className="text-xs text-theme-primary font-semibold mb-1">FILE</div>
        <div className="text-lg font-bold text-white mb-1 break-all">{file.name}</div>
        <div className="text-xs text-gray-500 break-all">{file.path}</div>
      </div>

      {/* 코드 프리뷰 */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-[#0f1716] border border-theme-border overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-theme-border">
            Code Preview
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              코드 불러오는 중...
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-red-400">
              {error}
            </div>
          ) : (
            <pre className="text-[11px] leading-relaxed text-gray-300 p-3 overflow-x-auto whitespace-pre font-mono">
              {previewCode}
            </pre>
          )}
        </div>
      </div>

      {/* 학습 시작 CTA */}
      <div className="px-4 pb-6">
        <HapticButton
          variant="primary"
          size="lg"
          hapticType="success"
          onClick={handleStart}
          className="w-full"
        >
          학습 시작
        </HapticButton>
        <p className="text-[11px] text-gray-500 text-center mt-2">
          루시드 튜터와 함께 이 파일을 배워봐요
        </p>
      </div>
    </Screen>
  );
}
