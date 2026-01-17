'use client';

import { useCallback } from 'react';
import useSound from 'use-sound';
import { SOUND_FILES } from '@/lib/constants';
import { useSoundSettings } from '@/contexts/SoundContext';

interface UseQuizSoundReturn {
  playCorrect: () => void;
  playWrong: () => void;
}

/**
 * 퀴즈 사운드 효과 훅
 * 정답/오답 시 효과음 재생
 */
export function useQuizSound(): UseQuizSoundReturn {
  const { enabled, volume } = useSoundSettings();

  const [playCorrectSound] = useSound(SOUND_FILES.CORRECT, {
    volume,
    soundEnabled: enabled,
  });

  const [playWrongSound] = useSound(SOUND_FILES.WRONG, {
    volume,
    soundEnabled: enabled,
  });

  const playCorrect = useCallback(() => {
    if (enabled) {
      playCorrectSound();
    }
  }, [enabled, playCorrectSound]);

  const playWrong = useCallback(() => {
    if (enabled) {
      playWrongSound();
    }
  }, [enabled, playWrongSound]);

  return { playCorrect, playWrong };
}
