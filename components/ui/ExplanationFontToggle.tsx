'use client';

import { useDisplayPrefs, type ExplanationFontSize } from '@/contexts/DisplayPrefsContext';

const SIZE_LABEL: Record<ExplanationFontSize, string> = {
  sm: 'S',
  base: 'M',
  lg: 'L',
};

const SIZE_TITLE: Record<ExplanationFontSize, string> = {
  sm: '해설 글씨: 작게',
  base: '해설 글씨: 보통',
  lg: '해설 글씨: 크게',
};

interface ExplanationFontToggleProps {
  className?: string;
}

export function ExplanationFontToggle({ className = '' }: ExplanationFontToggleProps) {
  const { explanationFontSize, cycleExplanationFontSize } = useDisplayPrefs();

  return (
    <button
      onClick={cycleExplanationFontSize}
      className={`p-2 rounded-lg hover:bg-foreground/10 transition-colors ${className}`}
      aria-label={SIZE_TITLE[explanationFontSize]}
      title={SIZE_TITLE[explanationFontSize]}
    >
      <span className="text-base font-bold leading-none">
        A<sub className="text-[10px]">{SIZE_LABEL[explanationFontSize]}</sub>
      </span>
    </button>
  );
}
