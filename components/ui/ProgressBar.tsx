'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number;
  max?: number;
  showLabel?: boolean;
  color?: 'primary' | 'success' | 'error' | 'combo';
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, showLabel = false, color = 'primary', ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const colorClasses = {
      primary: 'bg-primary',
      success: 'bg-success',
      error: 'bg-error',
      combo: 'bg-combo',
    };

    return (
      <div ref={ref} className={clsx('w-full', className)} {...props}>
        {showLabel && (
          <div className="mb-2 flex justify-between text-sm text-foreground/70">
            <span>{value}</span>
            <span>{max}</span>
          </div>
        )}
        <div className="h-3 w-full overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            className={clsx('h-full rounded-full', colorClasses[color])}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
