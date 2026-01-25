'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { STORAGE_KEY_PREFIX } from '@/lib/constants';

const AUTO_NEXT_STORAGE_KEY = `${STORAGE_KEY_PREFIX}auto_next`;

interface AutoNextContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleAutoNext: () => void;
}

const AutoNextContext = createContext<AutoNextContextType | undefined>(
  undefined
);

interface AutoNextProviderProps {
  children: ReactNode;
}

export function AutoNextProvider({ children }: AutoNextProviderProps) {
  // 기본값: false (수동 모드)
  const [enabled, setEnabledState] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // 클라이언트에서 로컬 스토리지 값 로드 (SSR 호환을 위한 hydration 패턴)
  useEffect(() => {
    const storedEnabled = localStorage.getItem(AUTO_NEXT_STORAGE_KEY);

    if (storedEnabled !== null) {
      setEnabledState(storedEnabled === 'true');
    }
    setIsHydrated(true);
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(AUTO_NEXT_STORAGE_KEY, String(value));
  }, []);

  const toggleAutoNext = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  // hydration 전에는 기본값(false) 사용
  const contextValue: AutoNextContextType = {
    enabled: isHydrated ? enabled : false,
    setEnabled,
    toggleAutoNext,
  };

  return (
    <AutoNextContext.Provider value={contextValue}>
      {children}
    </AutoNextContext.Provider>
  );
}

export function useAutoNextSettings(): AutoNextContextType {
  const context = useContext(AutoNextContext);
  if (!context) {
    throw new Error('useAutoNextSettings must be used within AutoNextProvider');
  }
  return context;
}
