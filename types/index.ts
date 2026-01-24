// Phase 1: 기본 타입 정의

/**
 * 퀴즈 유형
 * - mcq: 객관식 (Multiple Choice Question)
 * - ox: O/X 문제
 * - short: 단답형
 * - fill: 빈칸 채우기
 */
export type QuizType = 'mcq' | 'ox' | 'short' | 'fill';

/**
 * 개별 질문 타입
 */
export interface Question {
  id: string;
  type: QuizType;
  questionText: string;
  options?: string[]; // 객관식인 경우에만 존재
  correctAnswer: string;
  explanation?: string;
}

/**
 * 퀴즈 전체 타입
 */
export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  createdAt: Date;
  // Question Pool 시스템용 (500자 이상 텍스트)
  poolId?: string;
  remainingCount?: number;
}

/**
 * 사용자 답변 타입
 */
export interface UserAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
}

/**
 * 퀴즈 세션 타입 (진행 중인 퀴즈 상태)
 */
export interface QuizSession {
  id: string;
  quizId: string;
  currentQuestionIndex: number;
  answers: UserAnswer[];
  combo: number;
  score: number;
  startedAt: Date;
}

/**
 * 퀴즈 결과 타입
 */
export interface QuizResult {
  sessionId: string;
  quizId: string;
  score: number;
  maxCombo: number;
  xpEarned: number;
  correctCount: number;
  totalQuestions: number;
  completedAt: Date;
}

// ============================================
// Phase 2: AI 관련 타입
// ============================================

/**
 * AI 모델 정의
 */
export interface AIModel {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI SDK의 LanguageModel 타입이 버전마다 다름
  provider: any;
  priority: number;
}

/**
 * 퀴즈 생성 옵션
 */
export interface QuizGenerationOptions {
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 퀴즈 생성 결과
 */
export interface QuizGenerationResult {
  quiz: Quiz;
  model: string;
  tokensUsed?: number;
}

/**
 * AI 에러 타입
 */
export interface AIError {
  code: 'RATE_LIMIT' | 'INVALID_API_KEY' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  modelAttempted: string;
}

// ============================================
// Phase 3: 문제 풀 생성 관련 타입
// ============================================

/**
 * 문제 변형 유형
 */
export type TransformationType =
  | 'swap_answer' // 정답↔오답 교환 (MCQ)
  | 'shift_blank' // 빈칸 위치 변경 (Fill)
  | 'negate' // 부정형 변환 (OX)
  | 'shuffle_options' // 보기 순서 변경
  | 'mcq_to_ox'; // 객관식 → OX 변환

/**
 * 문제 생성 메타데이터
 */
export interface QuestionGenerationMetadata {
  source: 'ai' | 'transformed';
  transformType?: TransformationType;
  originalQuestionId?: string;
  batchIndex?: number;
}

/**
 * 확장된 Question 타입 (메타데이터 포함)
 */
export interface QuestionExtended extends Question {
  metadata?: QuestionGenerationMetadata;
}

/**
 * 문제 변형 옵션
 */
export interface TransformationOptions {
  enableSwapAnswers: boolean;
  enableBlankShift: boolean;
  enableNegation: boolean;
  enableOptionShuffle: boolean;
  enableTypeConversion: boolean;
}

/**
 * 배치 생성 설정
 */
export interface BatchGenerationConfig {
  targetQuestionCount: number;
  maxBatches: number;
  questionsPerBatch: number;
  overproductionRatio: number;
}

/**
 * 문제 풀 생성 결과
 */
export interface QuestionPoolResult {
  questions: Question[];
  metadata: {
    aiGenerated: number;
    transformed: number;
    totalAttempted: number;
    tokensUsed: number;
    generationTimeMs: number;
  };
}
