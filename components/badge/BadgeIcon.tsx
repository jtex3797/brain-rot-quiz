'use client';

import { clsx } from 'clsx';
import type { BadgeTier } from '@/types/badge';
import { BADGE_TIER_COLORS } from '@/types/badge';

interface BadgeIconProps {
  icon: string;
  tier: BadgeTier;
  size?: 'sm' | 'md' | 'lg';
  locked?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-4xl',
};

export function BadgeIcon({
  icon,
  tier,
  size = 'md',
  locked = false,
}: BadgeIconProps) {
  const tierColor = BADGE_TIER_COLORS[tier];

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center border-2 transition-all',
        SIZE_CLASSES[size],
        locked
          ? 'bg-foreground/10 border-foreground/20 grayscale'
          : `${tierColor.bg} ${tierColor.border}`
      )}
    >
      {locked ? '?' : icon}
    </div>
  );
}
