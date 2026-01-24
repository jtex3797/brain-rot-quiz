/**
 * 문제 풀 DB 서비스
 * 긴 텍스트(500자 이상)의 문제를 개별 저장하고 재사용
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from './server';
import { hashContent } from '@/lib/cache/quizCache';
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

    if (error || !data) {
      return null;
    }

    return data as DbQuizPool;
  } catch {
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
      // upsert 실패 시 다시 조회 시도 (다른 요청이 먼저 생성했을 수 있음)
      const retryPool = await getPoolByHash(contentHash);
      if (retryPool) {
        return { success: true, pool: retryPool };
      }
      return { success: false, error: error.message };
    }

    return { success: true, pool: data as DbQuizPool };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// =====================================================
// 문제 저장/조회
// =====================================================

/**
 * 풀에 문제들 저장
 */
export async function saveQuestionsToPool(
  poolId: string,
  questions: Question[],
  sourceType: 'ai' | 'transformed' = 'ai'
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  try {
    const supabase = await createClient();

    const insertData = questions.map((q) =>
      toDbPoolQuestion(q, poolId, sourceType)
    );

    const { error } = await (supabase as any)
      .from('pool_questions')
      .insert(insertData);

    if (error) {
      return { success: false, savedCount: 0, error: error.message };
    }

    // generated_count 누적 증가 (RPC 또는 raw SQL로 처리)
    const { data: poolData } = await (supabase as any)
      .from('quiz_pools')
      .select('generated_count')
      .eq('id', poolId)
      .single();

    const currentCount = poolData?.generated_count ?? 0;
    await (supabase as any)
      .from('quiz_pools')
      .update({ generated_count: currentCount + questions.length })
      .eq('id', poolId);

    return { success: true, savedCount: questions.length };
  } catch (e) {
    return { success: false, savedCount: 0, error: String(e) };
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
      if (error || !data) {
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

    if (error || !data) {
      return { questions: [], remainingCount: 0 };
    }

    // 남은 문제 수 계산
    const { count: totalCount } = await (supabase as any)
      .from('pool_questions')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId)
      .not('id', 'in', `(${[...excludeIds, ...(data as DbPoolQuestion[]).map((d) => d.id)].join(',')})`);

    return {
      questions: (data as DbPoolQuestion[]).map(fromDbPoolQuestion),
      remainingCount: totalCount ?? 0,
    };
  } catch {
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

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 만료된 풀 정리
 */
export async function cleanupExpiredPools(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('cleanup_expired_pools');
    return data ?? 0;
  } catch {
    return 0;
  }
}
