/**
 * 문제 변형기
 * AI 생성 문제를 코드로 변형하여 추가 문제 생성
 */

import { tokenize } from '@/lib/nlp';
import type { Question, TransformationType, TransformationOptions } from '@/types';

// =====================================================
// Types
// =====================================================

interface TransformedQuestion extends Question {
  transformType: TransformationType;
  originalId: string;
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 배열 셔플 (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 두 문제의 유사도 계산 (중복 체크용)
 */
function calculateQuestionSimilarity(q1: Question, q2: Question): number {
  const tokens1 = tokenize(q1.questionText);
  const tokens2 = tokenize(q2.questionText);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 중복 문제인지 확인
 */
function isDuplicateQuestion(
  newQuestion: Question,
  existingQuestions: Question[],
  threshold: number = 0.7
): boolean {
  for (const existing of existingQuestions) {
    if (calculateQuestionSimilarity(newQuestion, existing) >= threshold) {
      return true;
    }
    // 정답이 같으면 중복으로 처리
    if (newQuestion.correctAnswer === existing.correctAnswer) {
      return true;
    }
  }
  return false;
}

// =====================================================
// 변형 함수들
// =====================================================

/**
 * 정답↔오답 교환 (MCQ 전용)
 * "맞는 것" → "틀린 것" 변환
 */
function transformSwapAnswer(question: Question): TransformedQuestion | null {
  if (question.type !== 'mcq' || !question.options || question.options.length < 2) {
    return null;
  }

  // 오답 중 하나를 새 정답으로 선택
  const incorrectOptions = question.options.filter(
    (opt) => opt !== question.correctAnswer
  );

  if (incorrectOptions.length === 0) return null;

  const newCorrectAnswer =
    incorrectOptions[Math.floor(Math.random() * incorrectOptions.length)];

  // 질문 텍스트 수정
  let newQuestionText = question.questionText;

  // "맞는 것", "옳은 것" → "틀린 것", "옳지 않은 것" 변환
  const replacements: [RegExp, string][] = [
    [/맞는\s*것/g, '틀린 것'],
    [/옳은\s*것/g, '옳지 않은 것'],
    [/올바른\s*것/g, '올바르지 않은 것'],
    [/해당하는\s*것/g, '해당하지 않는 것'],
    [/correct/gi, 'incorrect'],
    [/true/gi, 'false'],
    [/right/gi, 'wrong'],
  ];

  let transformed = false;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(newQuestionText)) {
      newQuestionText = newQuestionText.replace(pattern, replacement);
      transformed = true;
      break;
    }
  }

  // 변환 패턴이 없으면 접미사 추가
  if (!transformed) {
    if (newQuestionText.endsWith('?')) {
      newQuestionText = newQuestionText.slice(0, -1) + ' 아닌 것은?';
    } else {
      newQuestionText += ' (해당하지 않는 것)';
    }
  }

  return {
    id: `${question.id}_swap`,
    type: 'mcq',
    questionText: newQuestionText,
    options: question.options,
    correctAnswer: newCorrectAnswer,
    explanation: `원래 정답: ${question.correctAnswer}. ${question.explanation || ''}`,
    transformType: 'swap_answer',
    originalId: question.id,
  };
}

/**
 * 빈칸 위치 변경 (Fill 전용)
 */
function transformShiftBlank(question: Question): TransformedQuestion | null {
  if (question.type !== 'fill' && question.type !== 'short') return null;

  const blankPattern = /\[____\]|\[___\]|\[__\]/g;
  const matches = [...question.questionText.matchAll(blankPattern)];

  if (matches.length === 0) return null;

  // 원래 정답으로 빈칸 채우기
  const filledText = question.questionText.replace(
    blankPattern,
    question.correctAnswer
  );

  // 문장에서 다른 키워드 추출
  const tokens = tokenize(filledText);
  // 2글자 이상, 숫자가 아닌 토큰만 선택
  const keywords = tokens.filter(
    (t) => t.length >= 2 && !/^\d+$/.test(t) && t !== question.correctAnswer
  );

  if (keywords.length === 0) return null;

  // 새 빈칸 키워드 선택
  const newBlankKeyword = keywords[Math.floor(Math.random() * keywords.length)];

  // 새 빈칸으로 변환
  const newText = filledText.replace(newBlankKeyword, '[____]');

  return {
    id: `${question.id}_shift`,
    type: 'fill',
    questionText: newText,
    correctAnswer: newBlankKeyword,
    explanation: `변형 문제. 원래 빈칸: ${question.correctAnswer}`,
    transformType: 'shift_blank',
    originalId: question.id,
  };
}

/**
 * 부정형 변환 (OX 전용)
 */
function transformNegate(question: Question): TransformedQuestion | null {
  if (question.type !== 'ox') return null;

  const negationPairs: [string, string][] = [
    ['이다', '이 아니다'],
    ['있다', '없다'],
    ['맞다', '틀리다'],
    ['가능하다', '불가능하다'],
    ['포함한다', '포함하지 않는다'],
    ['한다', '하지 않는다'],
    ['is', 'is not'],
    ['are', 'are not'],
    ['can', 'cannot'],
    ['has', 'does not have'],
  ];

  let newText = question.questionText;
  let transformed = false;

  for (const [positive, negative] of negationPairs) {
    if (newText.includes(positive) && !newText.includes(negative)) {
      newText = newText.replace(positive, negative);
      transformed = true;
      break;
    }
    if (newText.includes(negative)) {
      newText = newText.replace(negative, positive);
      transformed = true;
      break;
    }
  }

  if (!transformed) return null;

  // 정답 반전
  const newCorrectAnswer = question.correctAnswer === 'O' ? 'X' : 'O';

  return {
    id: `${question.id}_neg`,
    type: 'ox',
    questionText: newText,
    options: ['O', 'X'],
    correctAnswer: newCorrectAnswer,
    explanation: `부정형 변환. 원래 답: ${question.correctAnswer}`,
    transformType: 'negate',
    originalId: question.id,
  };
}

/**
 * 보기 순서 변경 (MCQ 전용)
 */
function transformShuffleOptions(question: Question): TransformedQuestion | null {
  if (question.type !== 'mcq' || !question.options || question.options.length < 2) {
    return null;
  }

  const shuffledOptions = shuffleArray(question.options);

  // 순서가 바뀌지 않았으면 null
  if (
    shuffledOptions.every((opt, i) => opt === question.options![i])
  ) {
    return null;
  }

  return {
    id: `${question.id}_shuffle`,
    type: 'mcq',
    questionText: question.questionText,
    options: shuffledOptions,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    transformType: 'shuffle_options',
    originalId: question.id,
  };
}

/**
 * 객관식 → OX 변환
 */
function transformMcqToOx(question: Question): TransformedQuestion[] {
  if (question.type !== 'mcq' || !question.options) return [];

  const oxQuestions: TransformedQuestion[] = [];

  // 각 보기에 대해 OX 문제 생성
  for (const option of question.options) {
    const isCorrect = option === question.correctAnswer;

    // 질문 형태로 변환
    let statement = question.questionText;

    // "~은/는 무엇인가?" 형태면 "~은/는 X이다" 형태로 변환
    if (statement.includes('무엇')) {
      statement = statement.replace(/무엇.*\?/, `"${option}"이다.`);
    } else if (statement.endsWith('?')) {
      statement = `${statement.slice(0, -1)}의 답은 "${option}"이다.`;
    } else {
      statement = `${statement}: "${option}"`;
    }

    oxQuestions.push({
      id: `${question.id}_ox_${option.slice(0, 3)}`,
      type: 'ox',
      questionText: statement,
      options: ['O', 'X'],
      correctAnswer: isCorrect ? 'O' : 'X',
      explanation: question.explanation,
      transformType: 'mcq_to_ox',
      originalId: question.id,
    });
  }

  return oxQuestions;
}

// =====================================================
// 메인 변형 함수
// =====================================================

/**
 * 문제 변형 메인 함수
 *
 * @param questions - 원본 문제 목록
 * @param targetCount - 목표 문제 수
 * @param options - 변형 옵션
 * @returns 변형된 문제 목록 (원본 포함)
 */
export function transformQuestions(
  questions: Question[],
  targetCount: number,
  options: TransformationOptions
): Question[] {
  const transformed: Question[] = [...questions];

  // 목표 수에 이미 도달했으면 바로 반환
  if (transformed.length >= targetCount) {
    return transformed.slice(0, targetCount);
  }

  const transformers: Array<
    (q: Question) => TransformedQuestion | TransformedQuestion[] | null
  > = [];

  if (options.enableSwapAnswers) transformers.push(transformSwapAnswer);
  if (options.enableBlankShift) transformers.push(transformShiftBlank);
  if (options.enableNegation) transformers.push(transformNegate);
  if (options.enableOptionShuffle) transformers.push(transformShuffleOptions);
  if (options.enableTypeConversion) transformers.push(transformMcqToOx);

  if (transformers.length === 0) {
    return transformed.slice(0, targetCount);
  }

  // 변형 시도
  let attempts = 0;
  const maxAttempts = questions.length * transformers.length * 3;

  while (transformed.length < targetCount && attempts < maxAttempts) {
    const sourceQuestion = questions[attempts % questions.length];
    const transformer = transformers[attempts % transformers.length];

    const result = transformer(sourceQuestion);

    if (result) {
      const newQuestions = Array.isArray(result) ? result : [result];

      for (const q of newQuestions) {
        // 중복 체크
        if (!isDuplicateQuestion(q, transformed)) {
          transformed.push(q);
          if (transformed.length >= targetCount) break;
        }
      }
    }

    attempts++;
  }

  return transformed.slice(0, targetCount);
}

/**
 * 기본 변형 옵션
 */
export const DEFAULT_TRANSFORMATION_OPTIONS: TransformationOptions = {
  enableSwapAnswers: true,
  enableBlankShift: true,
  enableNegation: true,
  enableOptionShuffle: true,
  enableTypeConversion: false, // 기본 비활성화 (품질 보장 어려움)
};

// Export individual transformers for testing
export {
  transformSwapAnswer,
  transformShiftBlank,
  transformNegate,
  transformShuffleOptions,
  transformMcqToOx,
};
