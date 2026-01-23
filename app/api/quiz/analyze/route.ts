import { NextRequest, NextResponse } from 'next/server';
import { calculateQuestionCapacity, analyzeTextQuality } from '@/lib/quiz';
import { processText } from '@/lib/nlp';
import { CONTENT_LENGTH } from '@/lib/constants';

/**
 * POST /api/quiz/analyze
 *
 * 텍스트 분석 및 최대 문제 수 계산
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content } = body;

    // 입력 검증
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { capacity: null, error: '텍스트를 입력해주세요' },
        { status: 400 }
      );
    }

    if (content.trim().length < CONTENT_LENGTH.MIN) {
      return NextResponse.json({
        capacity: {
          min: 1,
          max: 1,
          optimal: 1,
          reason: `최소 ${CONTENT_LENGTH.MIN}자 이상 입력해주세요`,
        },
        metrics: {
          characterCount: content.length,
          sentenceCount: 0,
          language: 'ko',
        },
      });
    }

    // 텍스트 처리 및 분석
    const processedText = processText(content);
    const capacity = calculateQuestionCapacity(content, processedText);
    const metrics = analyzeTextQuality(content, processedText);

    return NextResponse.json({
      capacity,
      metrics: {
        characterCount: metrics.characterCount,
        sentenceCount: metrics.sentenceCount,
        uniqueKeywordCount: metrics.uniqueKeywordCount,
        informationDensity: metrics.informationDensity,
        language: metrics.language,
      },
    });
  } catch (error) {
    console.error('[API] Error analyzing text:', error);

    return NextResponse.json(
      { capacity: null, error: '텍스트 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
