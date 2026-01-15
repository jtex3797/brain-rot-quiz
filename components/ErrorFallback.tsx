'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface ErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
}

/**
 * 에러 발생 시 표시되는 폴백 UI
 */
export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* 에러 아이콘 */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-error/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-error"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* 에러 메시지 */}
        <h1 className="text-2xl font-bold text-foreground mb-2">
          문제가 발생했습니다
        </h1>
        <p className="text-foreground/60 mb-6">
          예기치 않은 오류가 발생했습니다. 다시 시도해 주세요.
        </p>

        {/* 에러 상세 (개발 환경에서만 표시) */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="mb-6 p-4 bg-foreground/5 rounded-lg text-left">
            <p className="text-sm font-mono text-error break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={resetError} variant="primary">
            다시 시도
          </Button>
          <Link href="/">
            <Button variant="outline" className="w-full sm:w-auto">
              홈으로 돌아가기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
