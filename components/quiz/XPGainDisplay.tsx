// XP 획득 및 레벨업 표시 컴포넌트

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { SessionResult } from '@/lib/supabase/session';

interface XPGainDisplayProps {
  sessionResult: SessionResult;
}

export function XPGainDisplay({ sessionResult }: XPGainDisplayProps) {
  const { xpEarned, xpResult, streakResult } = sessionResult;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-r from-primary/20 to-combo/20 rounded-2xl p-6 mb-6"
    >
      {/* XP 획득 */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.5 }}
        className="flex items-center justify-center gap-2 mb-4"
      >
        <span className="text-3xl">✨</span>
        <span className="text-2xl font-bold text-primary">+{xpEarned} XP</span>
      </motion.div>

      {/* 레벨업 */}
      <AnimatePresence>
        {xpResult?.level_up && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', delay: 0.7 }}
            className="text-center mb-4"
          >
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-xl font-bold text-combo">
              레벨 {xpResult.new_level} 달성!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 현재 레벨/XP 표시 */}
      {xpResult && !xpResult.level_up && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-foreground/60 mb-2"
        >
          Lv.{xpResult.new_level} • 총 {xpResult.new_xp} XP
        </motion.div>
      )}

      {/* 스트릭 */}
      <AnimatePresence>
        {streakResult?.is_new_day && streakResult.new_streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-2 text-foreground/70"
          >
            <span className="text-xl">🔥</span>
            <span className="font-medium">
              {streakResult.new_streak}일 연속 학습!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
