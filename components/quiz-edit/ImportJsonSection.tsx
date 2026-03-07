'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { parseAndValidateQuizJson } from '@/lib/utils/quizJson';
import type { QuizJson } from '@/lib/utils/quizJson';

interface ImportJsonSectionProps {
    onImport: (data: QuizJson) => Promise<void>;
    confirmLabel?: string;
}

const DIFFICULTY_LABEL: Record<string, string> = {
    easy: '쉬움',
    medium: '보통',
    hard: '어려움',
};

export function ImportJsonSection({
    onImport,
    confirmLabel = '교체 확정',
}: ImportJsonSectionProps) {
    const [text, setText] = useState('');
    const [previewData, setPreviewData] = useState<QuizJson | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleTextChange(value: string) {
        setText(value);
        if (!value.trim()) {
            setPreviewData(null);
            setValidationError(null);
            return;
        }
        const result = parseAndValidateQuizJson(value);
        if (result.success) {
            setPreviewData(result.data);
            setValidationError(null);
        } else {
            setPreviewData(null);
            setValidationError(result.error);
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            handleTextChange(content);
        };
        reader.readAsText(file, 'utf-8');
    }

    async function handleConfirm() {
        if (!previewData || isConfirming) return;
        if (!confirm(`"${previewData.title}" (${previewData.questions.length}문제)로 교체하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        setIsConfirming(true);
        try {
            await onImport(previewData);
        } finally {
            setIsConfirming(false);
        }
    }

    return (
        <Card className="mb-6">
            <CardHeader>
                <h2 className="text-lg font-semibold">JSON으로 일괄 교체</h2>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 파일 업로드 */}
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        파일 선택
                    </Button>
                    <span className="text-sm text-foreground/60">.json 파일 업로드</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {/* 텍스트 붙여넣기 */}
                <textarea
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder='{"version":"1.0","title":"..."} 형식의 JSON을 붙여넣으세요'
                    rows={6}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                />

                {/* 검증 오류 */}
                {validationError && (
                    <div className="px-3 py-2 bg-error/10 border border-error/30 rounded-lg text-sm text-error whitespace-pre-line">
                        {validationError}
                    </div>
                )}

                {/* 미리보기 */}
                {previewData && (
                    <div className="px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-sm space-y-1">
                        <div className="font-medium text-foreground">{previewData.title}</div>
                        <div className="text-foreground/60 flex gap-3">
                            <span>📝 {previewData.questions.length}문제</span>
                            {previewData.difficulty && (
                                <span>난이도: {DIFFICULTY_LABEL[previewData.difficulty] ?? previewData.difficulty}</span>
                            )}
                            <span>내보낸 시각: {new Date(previewData.exportedAt).toLocaleString('ko-KR')}</span>
                        </div>
                    </div>
                )}

                {/* 확정 버튼 */}
                <div className="flex justify-end">
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={!previewData || isConfirming}
                    >
                        {isConfirming ? '처리 중...' : confirmLabel}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
