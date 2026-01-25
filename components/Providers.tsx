'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SoundProvider } from '@/contexts/SoundContext';
import { AutoNextProvider } from '@/contexts/AutoNextContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/supabase';

interface ProvidersProps {
  children: ReactNode;
  initialUser?: User | null;
  initialProfile?: Profile | null;
}

/**
 * 클라이언트 사이드 프로바이더 래퍼
 * ErrorBoundary, ThemeProvider, AuthProvider, SoundProvider 포함
 */
export function Providers({
  children,
  initialUser,
  initialProfile,
}: ProvidersProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider initialUser={initialUser} initialProfile={initialProfile}>
          <SoundProvider>
            <AutoNextProvider>{children}</AutoNextProvider>
          </SoundProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
