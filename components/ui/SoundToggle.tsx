'use client';

import { useSoundSettings } from '@/contexts/SoundContext';

interface SoundToggleProps {
  className?: string;
}

export function SoundToggle({ className = '' }: SoundToggleProps) {
  const { enabled, toggleSound } = useSoundSettings();

  return (
    <button
      onClick={toggleSound}
      className={`p-2 rounded-lg hover:bg-foreground/10 transition-colors ${className}`}
      aria-label={enabled ? '사운드 끄기' : '사운드 켜기'}
      title={enabled ? '사운드 끄기' : '사운드 켜기'}
    >
      <span className="text-xl">{enabled ? '🔊' : '🔇'}</span>
    </button>
  );
}
