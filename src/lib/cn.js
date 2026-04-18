import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind className 병합 헬퍼.
 * - clsx: 조건부 className 처리 (falsy 값 자동 제거)
 * - twMerge: Tailwind 클래스 충돌 해결 (예: "px-2 px-4" → "px-4")
 *
 * 사용 예:
 *   cn('px-4 py-2', isActive && 'bg-primary', 'text-sm')
 */
export const cn = (...inputs) => twMerge(clsx(inputs));
