// 퀴즈 DB CRUD 서비스
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from './client';
import { logger } from '@/lib/utils/logger';
import type { Quiz, Question } from '@/types';
import type {
  DbSavedQuiz,
  DbSavedQuizInsert,
  DbSavedQuestion,
  DbSavedQuestionInsert,
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
): DbSavedQuizInsert {
  return {
    id: quiz.id,
    user_id: userId,
    title: quiz.title,
    source_text: sourceText ?? null,
    difficulty: (difficulty as 'easy' | 'medium' | 'hard') ?? null,
    question_count: quiz.questions.length,
    is_public: false,
    share_code: generateShareCode(),
    bank_id: quiz.bankId ?? null,
  };
}

// 프론트엔드 Question[] -> DB 타입
export function toDbQuestions(
  questions: Question[],
  quizId: string
): DbSavedQuestionInsert[] {
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
export function fromDbQuiz(dbQuiz: DbSavedQuiz, dbQuestions: DbSavedQuestion[]): Quiz {
  return {
    id: dbQuiz.id,
    title: dbQuiz.title,
    questions: dbQuestions
      .sort((a, b) => a.order_index - b.order_index)
      .map(fromDbQuestion),
    bankId: dbQuiz.bank_id ?? undefined,
    createdAt: new Date(dbQuiz.created_at),
  };
}

// DB Question -> 프론트엔드 타입
export function fromDbQuestion(dbQ: DbSavedQuestion): Question {
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
    .from('saved_quizzes')
    .insert(quizData);

  if (quizError) {
    logger.error('Supabase', '퀴즈 저장 실패', {
      error: quizError.message,
      code: quizError.code,
      details: quizError.details,
      quizId: quiz.id,
      userId,
    });
    return { success: false, error: quizError.message };
  }

  // 2. 문제들 저장
  const questionsData = toDbQuestions(quiz.questions, quiz.id);
  const { error: questionsError } = await supabase
    .from('saved_questions')
    .insert(questionsData);

  if (questionsError) {
    logger.error('Supabase', '문제 저장 실패, 롤백 실행', {
      error: questionsError.message,
      code: questionsError.code,
      details: questionsError.details,
      quizId: quiz.id,
      questionCount: questionsData.length,
    });
    // 롤백: 퀴즈 삭제
    await supabase.from('saved_quizzes').delete().eq('id', quiz.id);
    return { success: false, error: questionsError.message };
  }

  return { success: true };
}

// 타임아웃 헬퍼
async function withTimeout<T>(
  promiseFactory: () => PromiseLike<T>,
  ms: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms);
  });

  try {
    const result = await Promise.race([promiseFactory(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// 퀴즈 조회 (ID)
export async function getQuizFromDb(quizId: string): Promise<Quiz | null> {
  logger.debug('Supabase', '퀴즈 조회 시작', { quizId });

  try {
    const supabase = createClient() as any;

    const quizResult = await withTimeout(
      () => supabase
        .from('saved_quizzes')
        .select('*')
        .eq('id', quizId)
        .maybeSingle(),  // single() → maybeSingle()로 변경: row가 없어도 에러 발생 안함
      10000  // 10초 타임아웃
    ) as { data: DbSavedQuiz | null; error: any };

    const { data: dbQuiz, error: quizError } = quizResult;

    if (quizError) {
      logger.error('Supabase', '퀴즈 조회 실패', {
        error: quizError.message,
        code: quizError.code,
        quizId,
      });
      return null;
    }
    if (!dbQuiz) {
      logger.debug('Supabase', '퀴즈를 찾을 수 없음', { quizId });
      return null;
    }

    const questionsResult = await withTimeout(
      () => supabase
        .from('saved_questions')
        .select('*')
        .eq('quiz_id', dbQuiz.id)
        .order('order_index'),
      10000
    ) as { data: DbSavedQuestion[] | null; error: any };

    const { data: dbQuestions, error: questionsError } = questionsResult;

    if (questionsError) {
      logger.error('Supabase', '퀴즈 문제 조회 실패', {
        error: questionsError.message,
        code: questionsError.code,
        quizId,
      });
      return null;
    }
    if (!dbQuestions) return null;

    const quiz = fromDbQuiz(dbQuiz, dbQuestions);

    // bank_id가 있으면 남은 문제 수 조회
    if (dbQuiz.bank_id) {
      const countResult = await withTimeout(
        () => supabase
          .from('question_bank_items')
          .select('*', { count: 'exact', head: true })
          .eq('bank_id', dbQuiz.bank_id),
        5000  // 5초 타임아웃
      ) as { count: number | null };

      const { count } = countResult;
      // 현재 퀴즈에 포함된 문제 수 제외 (단순화된 방식)
      quiz.remainingCount = Math.max(0, (count ?? 0) - quiz.questions.length);
      logger.debug('Supabase', '은행 문제 수 조회 완료', {
        bankId: dbQuiz.bank_id,
        totalCount: count,
        remainingCount: quiz.remainingCount,
      });
    }

    logger.debug('Supabase', '퀴즈 조회 완료', {
      quizId,
      questionCount: quiz.questions.length,
    });
    return quiz;
  } catch (error) {
    logger.error('Supabase', '퀴즈 조회 중 예외 발생', {
      error: error instanceof Error ? error.message : String(error),
      quizId,
    });
    return null;
  }
}

// 내 퀴즈 목록 조회
export async function getMyQuizzes(userId: string): Promise<DbSavedQuiz[]> {
  const supabase = createClient() as any;

  const { data, error } = await supabase
    .from('saved_quizzes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Supabase', '내 퀴즈 목록 조회 실패', {
      error: error.message,
      code: error.code,
      userId,
    });
    return [];
  }
  return (data as DbSavedQuiz[]) ?? [];
}

// 공유 코드로 퀴즈 조회
export async function getQuizByShareCode(
  shareCode: string
): Promise<Quiz | null> {
  const supabase = createClient() as any;

  const { data: dbQuiz, error: quizError } = await supabase
    .from('saved_quizzes')
    .select('*')
    .eq('share_code', shareCode)
    .eq('is_public', true)
    .single();

  if (quizError) {
    // PGRST116: 행이 없는 경우는 정상 (잘못된 공유 코드)
    if (quizError.code !== 'PGRST116') {
      logger.error('Supabase', '공유 코드로 퀴즈 조회 실패', {
        error: quizError.message,
        code: quizError.code,
        shareCode,
      });
    }
    return null;
  }
  if (!dbQuiz) return null;

  const { data: dbQuestions, error: questionsError } = await supabase
    .from('saved_questions')
    .select('*')
    .eq('quiz_id', dbQuiz.id)
    .order('order_index');

  if (questionsError) {
    logger.error('Supabase', '공유 퀴즈 문제 조회 실패', {
      error: questionsError.message,
      code: questionsError.code,
      quizId: dbQuiz.id,
    });
    return null;
  }
  if (!dbQuestions) return null;

  const quiz = fromDbQuiz(dbQuiz as DbSavedQuiz, dbQuestions as DbSavedQuestion[]);

  // bank_id가 있으면 남은 문제 수 조회
  if (dbQuiz.bank_id) {
    const { count, error: countError } = await supabase
      .from('question_bank_items')
      .select('*', { count: 'exact', head: true })
      .eq('bank_id', dbQuiz.bank_id);

    if (countError) {
      logger.warn('Supabase', '공유 퀴즈 은행 문제 수 조회 실패', {
        error: countError.message,
        bankId: dbQuiz.bank_id,
      });
    }

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
    .from('saved_quizzes')
    .delete()
    .eq('id', quizId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Supabase', '퀴즈 삭제 실패', {
      error: error.message,
      code: error.code,
      details: error.details,
      quizId,
      userId,
    });
    return { success: false, error: error.message };
  }

  logger.info('Supabase', '퀴즈 삭제 완료', { quizId });
  return { success: true };
}
