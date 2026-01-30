'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import type { NewlyEarnedBadge } from '@/types/badge';

interface BadgeEarnedModalProps {
  badges: NewlyEarnedBadge[];
  isOpen: boolean;
  onClose: () => void;
}

export function BadgeEarnedModal({
  badges,
  isOpen,
  onClose,
}: BadgeEarnedModalProps) {
  if (badges.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-background rounded-2xl p-6 max-w-sm w-full text-center shadow-xl border border-foreground/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 축하 아이콘 */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-6xl mb-4"
            >
              {badges.length > 1 ? '🎊' : '🏅'}
            </motion.div>

            {/* 제목 */}
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {badges.length > 1
                ? `${badges.length}개의 뱃지 획득!`
                : '뱃지 획득!'}
            </h2>

            {/* 뱃지 목록 */}
            <div className="space-y-3 mb-6">
              {badges.map((badge, idx) => (
                <motion.div
                  key={badge.code}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl"
                >
                  <span className="text-3xl">{badge.icon}</span>
                  <span className="font-medium text-foreground">
                    {badge.name}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* 확인 버튼 */}
            <Button variant="primary" onClick={onClose} className="w-full">
              확인
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
