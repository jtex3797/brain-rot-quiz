'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'reveal';

interface OptionButtonProps {
  option: string;
  index: number;
  state: OptionState;
  disabled: boolean;
  onClick: () => void;
}

const optionLabels = ['A', 'B', 'C', 'D'];

export function OptionButton({ option, index, state, disabled, onClick }: OptionButtonProps) {
  const getStateClasses = () => {
    switch (state) {
      case 'correct':
        return 'border-success bg-success/20 text-success';
      case 'wrong':
        return 'border-error bg-error/20 text-error';
      case 'reveal':
        return 'border-success bg-success/10 text-success';
      case 'selected':
        return 'border-primary bg-primary/10 text-primary';
      default:
        return 'border-foreground/20 hover:border-primary hover:bg-primary/5';
    }
  };

  const getAnimation = () => {
    if (state === 'correct') {
      return {
        scale: [1, 1.02, 1],
        transition: { duration: 0.3 },
      };
    }
    if (state === 'wrong') {
      return {
        x: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.4 },
      };
    }
    return {};
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full rounded-xl border-2 p-4 text-left transition-colors',
        'flex items-center gap-4',
        'disabled:cursor-not-allowed',
        getStateClasses()
      )}
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      animate={getAnimation()}
    >
      <span
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm',
          state === 'correct' || state === 'reveal'
            ? 'bg-success text-white'
            : state === 'wrong'
            ? 'bg-error text-white'
            : 'bg-foreground/10'
        )}
      >
        {optionLabels[index]}
      </span>
      <span className="flex-1 text-base">{option}</span>
      {state === 'correct' && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-2xl"
        >
          ✓
        </motion.span>
      )}
      {state === 'wrong' && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-2xl"
        >
          ✗
        </motion.span>
      )}
    </motion.button>
  );
}
