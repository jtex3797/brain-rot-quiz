import { z } from 'zod';
import type { QuizType } from '@/types';

// ============================================
// Zod 스키마
// ============================================

export const QuizJsonQuestionSchema = z.object({
  type: z.enum(['mcq', 'ox', 'short', 'fill']),
  questionText: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswers: z.array(z.string()).min(1),
  explanation: z.string().optional(),
}).superRefine((q, ctx) => {
  if (q.type === 'mcq' && (!q.options || q.options.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mcq 타입은 options가 필요합니다' });
  }
  if (q.type === 'mcq' && q.options && q.options.length > 0 && !q.options.includes(q.correctAnswers[0])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mcq 정답이 options에 없습니다' });
  }
  if (q.type === 'ox' && !['O', 'X'].includes(q.correctAnswers[0])) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ox 타입의 정답은 "O" 또는 "X"여야 합니다' });
  }
});

const QuizJsonSchema = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime({ offset: true }),
  title: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  questions: z.array(QuizJsonQuestionSchema).min(1).max(100),
});

export type QuizJson = z.infer<typeof QuizJsonSchema>;

// ============================================
// 유틸 함수
// ============================================

/**
 * 현재 퀴즈 state → Export JSON 생성
 * _delete 마킹된 문제는 자동 제외
 */
export function buildQuizExportJson(params: {
  title: string;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  questions: Array<{
    type: QuizType;
    questionText: string;
    options?: string[];
    correctAnswers: string[];
    explanation?: string;
    _delete?: boolean;
  }>;
}): QuizJson {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    title: params.title,
    // null → undefined 변환 필수: "difficulty": null이 있으면 import 시 Zod 거부
    difficulty: params.difficulty ?? undefined,
    questions: params.questions
      .filter((q) => !q._delete)
      .map((q) => ({
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
      })),
  };
}

/**
 * JSON 문자열 파싱 + Zod 검증
 * JSON.parse 오류 및 Zod 검증 오류를 모두 { success, error } 형태로 반환
 */
export function parseAndValidateQuizJson(
  jsonString: string
): { success: true; data: QuizJson } | { success: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, error: 'JSON 형식이 올바르지 않습니다' };
  }

  const result = QuizJsonSchema.safeParse(parsed);
  if (!result.success) {
    const errorMessage = result.error.issues.map((e) => e.message).join('\n');
    return { success: false, error: errorMessage };
  }

  return { success: true, data: result.data };
}

/**
 * QuizJson → Question[] 변환 (replace/save API 요청용)
 * 각 question에 임시 crypto.randomUUID() 부여 (Question 타입의 id 필수 충족용)
 */
export function quizJsonToImportBody(data: QuizJson) {
  return data.questions.map((q) => ({
    id: crypto.randomUUID(),
    type: q.type,
    questionText: q.questionText,
    options: q.options,
    correctAnswers: q.correctAnswers,
    explanation: q.explanation,
  }));
}

/**
 * QuizJson을 .json 파일로 다운로드 (브라우저 전용)
 */
export function downloadQuizJson(data: QuizJson, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${data.title}.json`;
  a.click();

  URL.revokeObjectURL(url);
}
