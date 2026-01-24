// 퀴즈 DB CRUD 서비스
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from './client';
import type { Quiz, Question } from '@/types';
import type {
  DbQuiz,
  DbQuizInsert,
  DbQuestion,
  DbQuestionInsert,
} from '@/types/supabase';

// 6자리 공유 코드 생성
function generateShareCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ============================================
// 타입 변환 함수
// ============================================

// 프론트엔드 Quiz -> DB 타입
export function toDbQuiz(
  quiz: Quiz,
  userId: string,
  sourceText?: string,
  difficulty?: string
): DbQuizInsert {
  return {
    id: quiz.id,
    user_id: userId,
    title: quiz.title,
    source_text: sourceText ?? null,
    difficulty: (difficulty as 'easy' | 'medium' | 'hard') ?? null,
    question_count: quiz.questions.length,
    is_public: false,
    share_code: generateShareCode(),
    pool_id: quiz.poolId ?? null,
  };
}

// 프론트엔드 Question[] -> DB 타입
export function toDbQuestions(
  questions: Question[],
  quizId: string
): DbQuestionInsert[] {
  return questions.map((q, index) => ({
    quiz_id: quizId,
    type: q.type,
    question_text: q.questionText,
    options: q.options ?? null,
    correct_answer: q.correctAnswer,
    explanation: q.explanation ?? null,
    order_index: index,
  }));
}

// DB Quiz + Questions -> 프론트엔드 타입
export function fromDbQuiz(dbQuiz: DbQuiz, dbQuestions: DbQuestion[]): Quiz {
  return {
    id: dbQuiz.id,
    title: dbQuiz.title,
    questions: dbQuestions
      .sort((a, b) => a.order_index - b.order_index)
      .map(fromDbQuestion),
    poolId: dbQuiz.pool_id ?? undefined,
    createdAt: new Date(dbQuiz.created_at),
  };
}

// DB Question -> 프론트엔드 타입
export function fromDbQuestion(dbQ: DbQuestion): Question {
  return {
    id: dbQ.id,
    type: dbQ.type,
    questionText: dbQ.question_text,
    options: dbQ.options as string[] | undefined,
    correctAnswer: dbQ.correct_answer,
    explanation: dbQ.explanation ?? undefined,
  };
}

// ============================================
// DB 작업 함수
// ============================================

// 퀴즈 저장
export async function saveQuizToDb(
  quiz: Quiz,
  userId: string,
  sourceText?: string,
  difficulty?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient() as any;

  const quizData = toDbQuiz(quiz, userId, sourceText, difficulty);

  // 1. 퀴즈 메타데이터 저장
  const { error: quizError } = await supabase
    .from('quizzes')
    .insert(quizData);

  if (quizError) {
    console.error('퀴즈 저장 실패:', quizError);
    return { success: false, error: quizError.message };
  }

  // 2. 문제들 저장
  const questionsData = toDbQuestions(quiz.questions, quiz.id);
  const { error: questionsError } = await supabase
    .from('questions')
    .insert(questionsData);

  if (questionsError) {
    console.error('문제 저장 실패:', questionsError);
    // 롤백: 퀴즈 삭제
    await supabase.from('quizzes').delete().eq('id', quiz.id);
    return { success: false, error: questionsError.message };
  }

  return { success: true };
}

// 퀴즈 조회 (ID)
export async function getQuizFromDb(quizId: string): Promise<Quiz | null> {
  const supabase = createClient() as any;

  const { data: dbQuiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();

  if (quizError || !dbQuiz) return null;

  const { data: dbQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', dbQuiz.id)
    .order('order_index');

  if (questionsError || !dbQuestions) return null;

  const quiz = fromDbQuiz(dbQuiz as DbQuiz, dbQuestions as DbQuestion[]);

  // pool_id가 있으면 남은 문제 수 조회
  if (dbQuiz.pool_id) {
    const { count } = await supabase
      .from('pool_questions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', dbQuiz.pool_id);

    // 현재 퀴즈에 포함된 문제 수 제외 (단순화된 방식)
    quiz.remainingCount = Math.max(0, (count ?? 0) - quiz.questions.length);
  }

  return quiz;
}

// 내 퀴즈 목록 조회
export async function getMyQuizzes(userId: string): Promise<DbQuiz[]> {
  const supabase = createClient() as any;

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data as DbQuiz[]) ?? [];
}

// 공유 코드로 퀴즈 조회
export async function getQuizByShareCode(
  shareCode: string
): Promise<Quiz | null> {
  const supabase = createClient() as any;

  const { data: dbQuiz } = await supabase
    .from('quizzes')
    .select('*')
    .eq('share_code', shareCode)
    .eq('is_public', true)
    .single();

  if (!dbQuiz) return null;

  const { data: dbQuestions } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', dbQuiz.id)
    .order('order_index');

  if (!dbQuestions) return null;

  const quiz = fromDbQuiz(dbQuiz as DbQuiz, dbQuestions as DbQuestion[]);

  // pool_id가 있으면 남은 문제 수 조회
  if (dbQuiz.pool_id) {
    const { count } = await supabase
      .from('pool_questions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', dbQuiz.pool_id);

    quiz.remainingCount = Math.max(0, (count ?? 0) - quiz.questions.length);
  }

  return quiz;
}

// 퀴즈 삭제
export async function deleteQuizFromDb(
  quizId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient() as any;

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', quizId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
