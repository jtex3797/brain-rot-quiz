'use client';

import { useAutoNextSettings } from '@/contexts/AutoNextContext';

interface AutoNextToggleProps {
  className?: string;
}

export function AutoNextToggle({ className = '' }: AutoNextToggleProps) {
  const { enabled, toggleAutoNext } = useAutoNextSettings();

  return (
    <button
      onClick={toggleAutoNext}
      className={`p-2 rounded-lg hover:bg-foreground/10 transition-colors ${className}`}
      aria-label={enabled ? '자동 넘김 끄기' : '자동 넘김 켜기'}
      title={enabled ? '자동 넘김 켜짐' : '수동 넘김'}
    >
      <span className="text-xl">{enabled ? '⏩' : '⏸️'}</span>
    </button>
  );
}
