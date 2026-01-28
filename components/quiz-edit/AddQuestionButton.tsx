'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import type { QuizType } from '@/types';

interface AddQuestionButtonProps {
    onAdd: (type: QuizType) => void;
}

const QUESTION_TYPES: { type: QuizType; label: string; description: string }[] = [
    { type: 'mcq', label: '객관식', description: '4지선다 문제' },
    { type: 'ox', label: 'O/X', description: '참/거짓 문제' },
    { type: 'short', label: '단답형', description: '짧은 답변 문제' },
    { type: 'fill', label: '빈칸', description: '빈칸 채우기 문제' },
];

export function AddQuestionButton({ onAdd }: AddQuestionButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (type: QuizType) => {
        onAdd(type);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="outline"
                className="w-full border-dashed border-2"
                onClick={() => setIsOpen(!isOpen)}
            >
                + 문제 추가
            </Button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                    {QUESTION_TYPES.map((item) => (
                        <button
                            key={item.type}
                            className="w-full px-4 py-3 text-left hover:bg-foreground/5 transition-colors border-b border-border last:border-b-0"
                            onClick={() => handleSelect(item.type)}
                        >
                            <div className="font-medium">{item.label}</div>
                            <div className="text-sm text-foreground/60">{item.description}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
