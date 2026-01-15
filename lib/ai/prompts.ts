import { z } from 'zod';
import type { QuizGenerationOptions } from '@/types';
import { DIFFICULTY_DESCRIPTIONS } from '@/lib/constants';

/**
 * Zod 스키마: AI 응답 검증용
 */
export const QuizSchema = z.object({
  title: z.string().describe('퀴즈 제목'),
  questions: z.array(
    z.object({
      id: z.string().describe('문제 고유 ID'),
      type: z.enum(['mcq', 'ox', 'short', 'fill']).describe('문제 유형'),
      questionText: z.string().describe('문제 텍스트 (빈칸은 [____]로 표시)'),
      options: z.array(z.string()).optional().describe('객관식 보기 (4개)'),
      correctAnswer: z.string().describe('정답'),
      explanation: z.string().optional().describe('해설'),
    })
  ),
});

export type QuizSchemaType = z.infer<typeof QuizSchema>;

/**
 * 시스템 프롬프트
 */
export const SYSTEM_PROMPT = `당신은 교육 전문가이자 퀴즈 생성 AI입니다.

**핵심 목표:**
주어진 텍스트에서 학습 효과가 높은 퀴즈를 생성합니다.

**퀴즈 생성 전략 (PRD 2.4 기반):**

1. **핵심 문장 추출**
   - 텍스트 전체를 분석하여 가장 중요한 문장들을 선별
   - 원문의 의미를 최대한 그대로 유지

2. **빈칸 채우기 변환**
   - 각 문장에서 핵심 키워드를 [____]로 변환
   - 한 문장에 여러 빈칸이 있을 수 있음
   - 빈칸은 명확하게 [____] 형식으로 표시

3. **문제 유형별 생성 규칙**

   **객관식 (mcq):**
   - 4개의 보기 제공 (정답 1개, 오답 3개)
   - 오답은 그럴듯하지만 명확히 틀린 것
   - 보기는 간결하게 (1-3단어)

   **OX 퀴즈 (ox):**
   - 참/거짓 판단 문제
   - 문장 자체가 명제 형태
   - options: ["O", "X"]
   - correctAnswer: "O" 또는 "X"

   **단답형 (short):**
   - options 없음
   - 정답은 1-2단어로 간결하게

4. **품질 기준**
   - 문제는 명확하고 모호하지 않아야 함
   - 난이도는 사용자 요청에 맞춤
   - 해설은 간결하고 이해하기 쉽게

**출력 형식:**
JSON 형식으로 반환하며, 반드시 주어진 스키마를 따라야 합니다.`;

/**
 * 사용자 프롬프트 생성
 */
export function createUserPrompt(
  content: string,
  options: QuizGenerationOptions
): string {
  const { questionCount, difficulty } = options;

  return `다음 텍스트를 분석하여 학습 퀴즈를 생성해주세요.

**텍스트:**
\`\`\`
${content}
\`\`\`

**요구사항:**
- 생성할 문제 수: ${questionCount}개
- 난이도: ${DIFFICULTY_DESCRIPTIONS[difficulty]}
- 퀴즈 제목: 텍스트 내용을 대표하는 제목 생성

**중요:**
- 반드시 텍스트의 핵심 내용을 다뤄야 합니다
- 문제 텍스트에서 빈칸은 정확히 [____] 형식으로 표시하세요
- 객관식 문제는 4개의 보기를 제공하세요
- id는 "q1", "q2", ... 형식으로 생성하세요`;
}

/**
 * 난이도에 따른 문제 유형 분포
 */
export function getQuestionTypeDistribution(
  difficulty: 'easy' | 'medium' | 'hard',
  totalCount: number
): { mcq: number; ox: number; short: number } {
  if (difficulty === 'easy') {
    // 쉬움: 객관식 80%, OX 20%
    return {
      mcq: Math.ceil(totalCount * 0.8),
      ox: Math.floor(totalCount * 0.2),
      short: 0,
    };
  } else if (difficulty === 'medium') {
    // 보통: 객관식 60%, OX 30%, 단답 10%
    return {
      mcq: Math.ceil(totalCount * 0.6),
      ox: Math.floor(totalCount * 0.3),
      short: Math.floor(totalCount * 0.1),
    };
  } else {
    // 어려움: 객관식 40%, OX 30%, 단답 30%
    return {
      mcq: Math.ceil(totalCount * 0.4),
      ox: Math.floor(totalCount * 0.3),
      short: Math.floor(totalCount * 0.3),
    };
  }
}
