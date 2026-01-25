import { NextRequest, NextResponse } from 'next/server';
import { loadMoreQuestions } from '@/lib/quiz/questionBankService';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/quiz/load-more
 *
 * 문제 은행에서 추가 문제 로드 (더 풀기)
 *
 * 로그인 사용자: play_answers 기반으로 이미 푼 문제 제외
 * 비로그인 사용자: 랜덤 추출 (중복 가능)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bankId, count = 5 } = body;

    // 입력 검증
    if (!bankId || typeof bankId !== 'string') {
      return NextResponse.json(
        { error: '문제 은행 ID가 필요합니다' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 20) {
      return NextResponse.json(
        { error: '문제 수는 1~20 사이여야 합니다' },
        { status: 400 }
      );
    }

    logger.info('API', '📥 추가 문제 로드 요청', {
      bankId,
      count,
    });

    // 로그인 여부 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let excludeIds: string[] = [];
    let random = true;

    // excludeIds가 있으면 로그인 여부 무관하게 중복 제외 (순차 조회)
    if (body.excludeIds && Array.isArray(body.excludeIds) && body.excludeIds.length > 0) {
      excludeIds = body.excludeIds;
      random = false;

      logger.info('API', '📋 excludeIds 기반 순차 조회', {
        userId: user?.id ?? 'anonymous',
        excludeCount: excludeIds.length,
      });
    } else {
      // excludeIds가 없을 때만 랜덤 추출
      random = true;
      logger.info('API', '🎲 랜덤 조회 (excludeIds 없음)', {
        userId: user?.id ?? 'anonymous',
      });
    }

    // 문제 로드
    const result = await loadMoreQuestions(bankId, count, excludeIds, random);

    if (result.questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: [],
        remainingCount: 0,
        message: '더 이상 문제가 없습니다',
      });
    }

    logger.info('API', '✅ 추가 문제 로드 완료', {
      loadedCount: result.questions.length,
      remainingCount: result.remainingCount,
    });

    return NextResponse.json({
      success: true,
      questions: result.questions,
      remainingCount: result.remainingCount,
      isLoggedIn: !!user,
    });
  } catch (error) {
    logger.error('API', '추가 문제 로드 실패', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '문제 로드에 실패했습니다',
      },
      { status: 500 }
    );
  }
}
