/**
 * 문제 풀 DB 서비스
 * 긴 텍스트(500자 이상)의 문제를 개별 저장하고 재사용
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from './server';
import { hashContent } from '@/lib/cache/quizCache';
import { logger } from '@/lib/utils/logger';
import type { Question } from '@/types';
import type {
  DbQuizPool,
  DbQuizPoolInsert,
  DbPoolQuestion,
  DbPoolQuestionInsert,
} from '@/types/supabase';

// =====================================================
// Types
// =====================================================

export interface PoolWithQuestions {
  pool: DbQuizPool;
  questions: Question[];
  remainingCount: number;
}

export interface CreatePoolResult {
  success: boolean;
  pool?: DbQuizPool;
  error?: string;
}

// =====================================================
// 타입 변환 함수
// =====================================================

/**
 * DB 문제 → 프론트엔드 타입
 */
export function fromDbPoolQuestion(dbQ: DbPoolQuestion): Question {
  const json = dbQ.question_json as Record<string, any>;
  return {
    id: dbQ.id,
    type: json.type,
    questionText: json.questionText,
    options: json.options,
    correctAnswer: json.correctAnswer,
    explanation: json.explanation,
  };
}

/**
 * 프론트엔드 문제 → DB Insert 타입
 */
export function toDbPoolQuestion(
  question: Question,
  poolId: string,
  sourceType: 'ai' | 'transformed'
): DbPoolQuestionInsert {
  return {
    pool_id: poolId,
    question_json: {
      type: question.type,
      questionText: question.questionText,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    },
    source_type: sourceType,
  };
}

// =====================================================
// 풀 조회/생성
// =====================================================

/**
 * 해시로 풀 조회
 */
export async function getPoolByHash(
  contentHash: string
): Promise<DbQuizPool | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from('quiz_pools')
      .select('*')
      .eq('content_hash', contentHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      // PGRST116: 행이 없는 경우는 정상적인 캐시 미스
      if (error.code !== 'PGRST116') {
        logger.warn('Supabase', '풀 조회 실패', {
          error: error.message,
          code: error.code,
          contentHash: contentHash.slice(0, 8) + '...',
        });
      }
      return null;
    }

    return data as DbQuizPool;
  } catch (e) {
    logger.error('Supabase', '풀 조회 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
      contentHash: contentHash.slice(0, 8) + '...',
    });
    return null;
  }
}

/**
 * 풀 생성 또는 기존 풀 반환
 * Race condition 방지를 위해 ON CONFLICT 사용
 */
export async function getOrCreatePool(
  content: string,
  maxCapacity: number
): Promise<CreatePoolResult> {
  try {
    const contentHash = await hashContent(content);
    const supabase = await createClient();

    // 1. 먼저 기존 풀 확인
    const existing = await getPoolByHash(contentHash);
    if (existing) {
      return { success: true, pool: existing };
    }

    // 2. 없으면 새로 생성 (upsert로 race condition 방지)
    const insertData: DbQuizPoolInsert = {
      content_hash: contentHash,
      original_content: content,
      max_capacity: maxCapacity,
      generated_count: 0,
    };

    const { data, error } = await (supabase as any)
      .from('quiz_pools')
      .upsert(insertData, {
        onConflict: 'content_hash',
        ignoreDuplicates: true,
      })
      .select()
      .single();

    if (error) {
      logger.warn('Supabase', '풀 upsert 실패, 재조회 시도', {
        error: error.message,
        code: error.code,
      });
      // upsert 실패 시 다시 조회 시도 (다른 요청이 먼저 생성했을 수 있음)
      const retryPool = await getPoolByHash(contentHash);
      if (retryPool) {
        return { success: true, pool: retryPool };
      }
      logger.error('Supabase', '풀 생성 최종 실패', {
        error: error.message,
        code: error.code,
        details: error.details,
      });
      return { success: false, error: error.message };
    }

    logger.debug('Supabase', '새 풀 생성됨', {
      poolId: data?.id,
      maxCapacity,
    });
    return { success: true, pool: data as DbQuizPool };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.error('Supabase', '풀 생성 중 예외 발생', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// =====================================================
// 문제 저장/조회
// =====================================================

/**
 * 풀에 문제들 저장
 * @returns savedQuestions: DB ID가 포함된 저장된 문제들
 */
export async function saveQuestionsToPool(
  poolId: string,
  questions: Question[],
  sourceType: 'ai' | 'transformed' = 'ai'
): Promise<{ success: boolean; savedCount: number; savedQuestions?: Question[]; error?: string }> {
  try {
    const supabase = await createClient();

    const insertData = questions.map((q) =>
      toDbPoolQuestion(q, poolId, sourceType)
    );

    // insert 후 저장된 데이터를 반환받아 DB ID를 획득
    const { data, error } = await (supabase as any)
      .from('pool_questions')
      .insert(insertData)
      .select();

    if (error) {
      logger.error('Supabase', '풀 문제 저장 실패', {
        error: error.message,
        code: error.code,
        details: error.details,
        poolId,
        questionCount: questions.length,
      });
      return { success: false, savedCount: 0, error: error.message };
    }

    // generated_count 누적 증가 (RPC 또는 raw SQL로 처리)
    const { data: poolData, error: poolError } = await (supabase as any)
      .from('quiz_pools')
      .select('generated_count')
      .eq('id', poolId)
      .single();

    if (poolError) {
      logger.warn('Supabase', '풀 카운트 조회 실패', {
        error: poolError.message,
        poolId,
      });
    }

    const currentCount = poolData?.generated_count ?? 0;
    const { error: updateError } = await (supabase as any)
      .from('quiz_pools')
      .update({ generated_count: currentCount + questions.length })
      .eq('id', poolId);

    if (updateError) {
      logger.warn('Supabase', '풀 카운트 업데이트 실패', {
        error: updateError.message,
        poolId,
      });
    }

    // DB ID가 포함된 문제들 반환
    const savedQuestions = data
      ? (data as DbPoolQuestion[]).map(fromDbPoolQuestion)
      : undefined;

    logger.debug('Supabase', '풀 문제 저장 완료', {
      poolId,
      savedCount: questions.length,
    });
    return { success: true, savedCount: questions.length, savedQuestions };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    logger.error('Supabase', '풀 문제 저장 중 예외 발생', {
      error: errorMsg,
      poolId,
    });
    return { success: false, savedCount: 0, error: errorMsg };
  }
}

/**
 * 풀에서 문제 조회
 * @param poolId 풀 ID
 * @param count 가져올 문제 수
 * @param excludeIds 제외할 문제 ID 목록 (로그인 사용자용)
 * @param random 랜덤 추출 여부 (비로그인 사용자용)
 */
export async function fetchQuestionsFromPool(
  poolId: string,
  count: number,
  excludeIds: string[] = [],
  random: boolean = false
): Promise<{ questions: Question[]; remainingCount: number }> {
  try {
    const supabase = await createClient();

    // 기본 쿼리
    let query = (supabase as any)
      .from('pool_questions')
      .select('*')
      .eq('pool_id', poolId);

    // 제외할 ID가 있으면 필터
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    // 랜덤 정렬 또는 생성순
    if (random) {
      // Supabase는 RANDOM() 직접 지원 안 함 - 전체 조회 후 셔플
      const { data, error } = await query;
      if (error) {
        logger.error('Supabase', '풀 문제 랜덤 조회 실패', {
          error: error.message,
          code: error.code,
          poolId,
        });
        return { questions: [], remainingCount: 0 };
      }
      if (!data) {
        return { questions: [], remainingCount: 0 };
      }

      const shuffled = (data as DbPoolQuestion[]).sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);
      const remaining = shuffled.length - selected.length;

      return {
        questions: selected.map(fromDbPoolQuestion),
        remainingCount: remaining,
      };
    }

    // 순차 조회
    const { data, error } = await query.order('created_at').limit(count);

    if (error) {
      logger.error('Supabase', '풀 문제 순차 조회 실패', {
        error: error.message,
        code: error.code,
        poolId,
        count,
      });
      return { questions: [], remainingCount: 0 };
    }
    if (!data) {
      return { questions: [], remainingCount: 0 };
    }

    // 남은 문제 수 계산
    const { count: totalCount, error: countError } = await (supabase as any)
      .from('pool_questions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId)
      .not('id', 'in', `(${[...excludeIds, ...(data as DbPoolQuestion[]).map((d) => d.id)].join(',')})`);

    if (countError) {
      logger.warn('Supabase', '남은 문제 수 계산 실패', {
        error: countError.message,
        poolId,
      });
    }

    return {
      questions: (data as DbPoolQuestion[]).map(fromDbPoolQuestion),
      remainingCount: totalCount ?? 0,
    };
  } catch (e) {
    logger.error('Supabase', '풀 문제 조회 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
      poolId,
    });
    return { questions: [], remainingCount: 0 };
  }
}

/**
 * 풀의 전체 문제 수 조회
 */
export async function getPoolQuestionCount(poolId: string): Promise<number> {
  try {
    const supabase = await createClient();

    const { count, error } = await (supabase as any)
      .from('pool_questions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId);

    if (error) {
      logger.warn('Supabase', '풀 문제 수 조회 실패', {
        error: error.message,
        code: error.code,
        poolId,
      });
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    logger.error('Supabase', '풀 문제 수 조회 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
      poolId,
    });
    return 0;
  }
}

/**
 * 만료된 풀 정리
 */
export async function cleanupExpiredPools(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cleanup_expired_pools');

    if (error) {
      logger.error('Supabase', '만료된 풀 정리 RPC 실패', {
        error: error.message,
        code: error.code,
      });
      return 0;
    }

    logger.info('Supabase', '만료된 풀 정리 완료', { cleanedCount: data ?? 0 });
    return data ?? 0;
  } catch (e) {
    logger.error('Supabase', '만료된 풀 정리 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}
