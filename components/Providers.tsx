'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SoundProvider } from '@/contexts/SoundContext';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 클라이언트 사이드 프로바이더 래퍼
 * ErrorBoundary 및 기타 Context Provider 포함
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <SoundProvider>{children}</SoundProvider>
    </ErrorBoundary>
  );
}
