'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { SESSION_SIZE } from '@/lib/constants';

interface LoadMoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number, shuffle: boolean) => void;
  remainingCount: number;
  defaultCount?: number;
  isLoading?: boolean;
}

export function LoadMoreModal({
  isOpen,
  onClose,
  onConfirm,
  remainingCount,
  defaultCount = SESSION_SIZE.DEFAULT,
  isLoading = false,
}: LoadMoreModalProps) {
  const [selectedCount, setSelectedCount] = useState(
    Math.min(defaultCount, remainingCount)
  );
  const [shuffle, setShuffle] = useState(true);

  // remainingCount나 defaultCount가 변경되면 selectedCount 재설정
  useEffect(() => {
    setSelectedCount(Math.min(defaultCount, remainingCount));
  }, [defaultCount, remainingCount]);

  const maxSelectable = Math.min(SESSION_SIZE.MAX, remainingCount);
  const minSelectable = Math.min(SESSION_SIZE.MIN, remainingCount);

  const handleConfirm = () => {
    onConfirm(selectedCount, shuffle);
  };

  // 빠른 선택 옵션 (남은 문제 수에 따라 동적 생성)
  const quickOptions = [5, 10, 15, remainingCount]
    .filter((n, i, arr) => n <= remainingCount && arr.indexOf(n) === i)
    .slice(0, 4);

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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl border border-foreground/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-foreground mb-4">
              더 풀기
            </h2>

            <p className="text-foreground/70 mb-4">
              남은 문제: <span className="font-bold text-success">{remainingCount}개</span>
            </p>

            {/* 문제 수 선택 슬라이더 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                풀 문제 수: <span className="text-primary font-bold">{selectedCount}개</span>
              </label>
              <input
                type="range"
                min={minSelectable}
                max={maxSelectable}
                value={selectedCount}
                onChange={(e) => setSelectedCount(parseInt(e.target.value))}
                className="w-full accent-primary"
                disabled={isLoading}
              />
              <div className="flex justify-between text-xs text-foreground/60 mt-1">
                <span>{minSelectable}개</span>
                <span>{maxSelectable}개</span>
              </div>
            </div>

            {/* 빠른 선택 버튼 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {quickOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setSelectedCount(count)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCount === count
                      ? 'bg-primary text-white'
                      : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                  }`}
                  disabled={isLoading}
                >
                  {count === remainingCount ? '전부' : `${count}개`}
                </button>
              ))}
            </div>

            {/* 순서 섞기 토글 */}
            <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="w-4 h-4 accent-primary rounded"
                disabled={isLoading}
              />
              <span className="text-sm text-foreground">문제 순서 섞기</span>
            </label>

            {/* 버튼 그룹 */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isLoading}
              >
                취소
              </Button>
              <Button
                variant="success"
                onClick={handleConfirm}
                className="flex-1"
                loading={isLoading}
              >
                시작하기
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
