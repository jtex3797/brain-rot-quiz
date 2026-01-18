'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SoundProvider } from '@/contexts/SoundContext';
import { AuthProvider } from '@/contexts/AuthContext';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * 클라이언트 사이드 프로바이더 래퍼
 * ErrorBoundary, AuthProvider, SoundProvider 포함
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SoundProvider>{children}</SoundProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
