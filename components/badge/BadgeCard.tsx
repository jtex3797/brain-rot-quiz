'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgeIcon } from './BadgeIcon';
import type { Badge } from '@/types/badge';

interface BadgeCardProps {
  badge: Badge;
  earned: boolean;
  earnedAt?: Date;
}

export function BadgeCard({ badge, earned, earnedAt }: BadgeCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <BadgeIcon
        icon={badge.icon}
        tier={badge.tier}
        size="md"
        locked={!earned && badge.isHidden}
      />

      <p
        className={`mt-1 text-xs text-center truncate w-full ${
          earned ? 'text-foreground' : 'text-foreground/40'
        }`}
      >
        {!earned && badge.isHidden ? '???' : badge.name}
      </p>

      {/* 툴팁 */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10"
          >
            <div className="bg-background border border-foreground/20 rounded-lg p-3 shadow-lg min-w-[160px] text-center">
              <p className="font-medium text-foreground text-sm">
                {badge.name}
              </p>
              <p className="text-xs text-foreground/60 mt-1">
                {badge.description}
              </p>
              {earned && earnedAt && (
                <p className="text-xs text-primary mt-2">
                  {earnedAt.toLocaleDateString('ko-KR')} 획득
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
