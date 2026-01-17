'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { SOUND_CONFIG, SOUND_STORAGE_KEYS } from '@/lib/constants';

interface SoundSettingsContextType {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggleSound: () => void;
}

const SoundSettingsContext = createContext<SoundSettingsContextType | undefined>(
  undefined
);

interface SoundProviderProps {
  children: ReactNode;
}

export function SoundProvider({ children }: SoundProviderProps) {
  const [enabled, setEnabledState] = useState(true);
  const [volume, setVolumeState] = useState<number>(SOUND_CONFIG.DEFAULT_VOLUME);
  const [isHydrated, setIsHydrated] = useState(false);

  // 클라이언트에서 로컬 스토리지 값 로드
  useEffect(() => {
    const storedEnabled = localStorage.getItem(SOUND_STORAGE_KEYS.ENABLED);
    const storedVolume = localStorage.getItem(SOUND_STORAGE_KEYS.VOLUME);

    if (storedEnabled !== null) {
      setEnabledState(storedEnabled === 'true');
    }
    if (storedVolume !== null) {
      const parsed = parseFloat(storedVolume);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setVolumeState(parsed);
      }
    }
    setIsHydrated(true);
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    localStorage.setItem(SOUND_STORAGE_KEYS.ENABLED, String(value));
  }, []);

  const setVolume = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(1, value));
    setVolumeState(clampedValue);
    localStorage.setItem(SOUND_STORAGE_KEYS.VOLUME, String(clampedValue));
  }, []);

  const toggleSound = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  // hydration 전에는 기본값 사용
  const contextValue: SoundSettingsContextType = {
    enabled: isHydrated ? enabled : true,
    volume: isHydrated ? volume : SOUND_CONFIG.DEFAULT_VOLUME,
    setEnabled,
    setVolume,
    toggleSound,
  };

  return (
    <SoundSettingsContext.Provider value={contextValue}>
      {children}
    </SoundSettingsContext.Provider>
  );
}

export function useSoundSettings(): SoundSettingsContextType {
  const context = useContext(SoundSettingsContext);
  if (!context) {
    throw new Error('useSoundSettings must be used within SoundProvider');
  }
  return context;
}
