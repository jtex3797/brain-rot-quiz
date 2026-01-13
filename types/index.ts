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
