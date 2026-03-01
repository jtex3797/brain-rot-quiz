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

export type ExplanationFontSize = 'sm' | 'base' | 'lg';

const FONT_SIZE_KEY = `${STORAGE_KEY_PREFIX}explanation_font_size`;
const DEFAULT_FONT_SIZE: ExplanationFontSize = 'base';
const FONT_SIZE_ORDER: ExplanationFontSize[] = ['sm', 'base', 'lg'];

interface DisplayPrefsContextType {
  explanationFontSize: ExplanationFontSize;
  setExplanationFontSize: (size: ExplanationFontSize) => void;
  cycleExplanationFontSize: () => void;
}

const DisplayPrefsContext = createContext<DisplayPrefsContextType | undefined>(
  undefined
);

interface DisplayPrefsProviderProps {
  children: ReactNode;
}

export function DisplayPrefsProvider({ children }: DisplayPrefsProviderProps) {
  const [explanationFontSize, setFontSizeState] = useState<ExplanationFontSize>(DEFAULT_FONT_SIZE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY) as ExplanationFontSize | null;
    if (stored && FONT_SIZE_ORDER.includes(stored)) {
      setFontSizeState(stored);
    }
    setIsHydrated(true);
  }, []);

  const setExplanationFontSize = useCallback((size: ExplanationFontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
  }, []);

  const cycleExplanationFontSize = useCallback(() => {
    setFontSizeState((current) => {
      const currentIndex = FONT_SIZE_ORDER.indexOf(current);
      const next = FONT_SIZE_ORDER[(currentIndex + 1) % FONT_SIZE_ORDER.length];
      localStorage.setItem(FONT_SIZE_KEY, next);
      return next;
    });
  }, []);

  const contextValue: DisplayPrefsContextType = {
    explanationFontSize: isHydrated ? explanationFontSize : DEFAULT_FONT_SIZE,
    setExplanationFontSize,
    cycleExplanationFontSize,
  };

  return (
    <DisplayPrefsContext.Provider value={contextValue}>
      {children}
    </DisplayPrefsContext.Provider>
  );
}

export function useDisplayPrefs(): DisplayPrefsContextType {
  const context = useContext(DisplayPrefsContext);
  if (!context) {
    throw new Error('useDisplayPrefs must be used within DisplayPrefsProvider');
  }
  return context;
}
