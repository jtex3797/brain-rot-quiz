'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  COMBO_THRESHOLDS,
  getComboTextColor,
  getComboText,
  getComboBgColor,
} from '@/lib/constants';

interface ComboDisplayProps {
  combo: number;
  show: boolean;
}

export function ComboDisplay({ combo, show }: ComboDisplayProps) {
  if (combo < COMBO_THRESHOLDS.MIN_DISPLAY) return null;

  const comboColor = getComboTextColor(combo);
  const comboText = getComboText(combo);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 0.3,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            className="text-center"
          >
            <div className={`text-6xl font-black ${comboColor}`}>
              {combo}x
            </div>
            <div className={`text-xl font-bold ${comboColor} mt-1`}>
              {comboText}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ComboCounterProps {
  combo: number;
}

export function ComboCounter({ combo }: ComboCounterProps) {
  if (combo < COMBO_THRESHOLDS.MIN_DISPLAY) return null;

  return (
    <motion.div
      key={combo}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`${getComboBgColor(combo)} text-white px-4 py-2 rounded-full font-bold flex items-center gap-2`}
    >
      <span className="text-lg">{combo}x</span>
      <span className="text-sm">COMBO</span>
    </motion.div>
  );
}
