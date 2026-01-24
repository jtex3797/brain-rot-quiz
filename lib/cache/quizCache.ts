/**
 * 퀴즈 캐시 모듈
 * AI 생성 퀴즈를 Supabase에 캐싱하여 비용 절감
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { Quiz, QuizGenerationOptions } from '@/types';

// =====================================================
// Types
// =====================================================

export interface CacheOptions {
  bypassCache?: boolean; // "새 문제 생성" 시 true
}

interface CachedQuizData {
  quiz: Quiz;
  model: string;
  processedTextLength?: number;
}

// =====================================================
// 해시 함수
// =====================================================

/**
 * 텍스트를 SHA-256 해시로 변환
 * Web Crypto API 사용 (Node.js/브라우저 모두 지원)
 */
export async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Node.js 환경
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 폴백: 간단한 해시 (프로덕션에서는 crypto.subtle 사용 권장)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * 퀴즈 생성 옵션을 해시로 변환
 */
export async function hashOptions(options: QuizGenerationOptions): Promise<string> {
  const normalized = JSON.stringify({
    difficulty: options.difficulty,
    questionCount: options.questionCount,
  });
  return hashContent(normalized);
}

// =====================================================
// 캐시 조회/저장
// =====================================================

/**
 * 캐시에서 퀴즈 조회
 */
export async function getCachedQuiz(
  contentHash: string,
  optionsHash: string
): Promise<CachedQuizData | null> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('quiz_cache')
      .select('quiz_data, hit_count')
      .eq('content_hash', contentHash)
      .eq('options_hash', optionsHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      // PGRST116: 행이 없는 경우는 정상적인 캐시 미스
      if (error.code !== 'PGRST116') {
        logger.warn('Cache', '캐시 조회 실패', {
          error: error.message,
          code: error.code,
          contentHash: contentHash.slice(0, 8) + '...',
        });
      }
      return null;
    }
    if (!data) {
      return null;
    }

    // hit_count 증가 및 last_accessed_at 업데이트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('quiz_cache')
      .update({
        hit_count: data.hit_count + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('content_hash', contentHash)
      .eq('options_hash', optionsHash);

    if (updateError) {
      logger.warn('Cache', '캐시 hit_count 업데이트 실패', {
        error: updateError.message,
      });
    }

    logger.logCache(true, contentHash);
    return data.quiz_data as CachedQuizData;
  } catch (e) {
    logger.error('Cache', '캐시 조회 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    // 캐시 조회 실패 시 null 반환 (AI 생성으로 폴백)
    return null;
  }
}

/**
 * 퀴즈를 캐시에 저장
 */
export async function setCachedQuiz(
  contentHash: string,
  optionsHash: string,
  quizData: CachedQuizData
): Promise<void> {
  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('quiz_cache').upsert(
      {
        content_hash: contentHash,
        options_hash: optionsHash,
        quiz_data: quizData,
        hit_count: 0,
        last_accessed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일
      },
      {
        onConflict: 'content_hash,options_hash',
      }
    );

    if (error) {
      logger.warn('Cache', '캐시 저장 실패', {
        error: error.message,
        code: error.code,
        contentHash: contentHash.slice(0, 8) + '...',
      });
    } else {
      logger.debug('Cache', '캐시 저장 완료', {
        contentHash: contentHash.slice(0, 8) + '...',
      });
    }
  } catch (e) {
    logger.error('Cache', '캐시 저장 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    // 캐시 저장 실패는 무시 (다음에 다시 생성)
  }
}

/**
 * 만료된 캐시 정리 (관리용)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('cleanup_expired_cache');

    if (error) {
      logger.error('Cache', '만료된 캐시 정리 RPC 실패', {
        error: error.message,
        code: error.code,
      });
      return 0;
    }

    logger.info('Cache', '만료된 캐시 정리 완료', { cleanedCount: data ?? 0 });
    return data ?? 0;
  } catch (e) {
    logger.error('Cache', '만료된 캐시 정리 중 예외 발생', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}
