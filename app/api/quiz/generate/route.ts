import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz, validateQuiz, normalizeQuiz } from '@/lib/ai/generate';
import {
  generateQuestionPool,
  createQuizFromPool,
  calculateQuestionCapacity,
} from '@/lib/quiz';
import { getOrGenerateQuestionBank } from '@/lib/quiz/questionBankService';
import {
  CONTENT_LENGTH,
  QUESTION_COUNT,
  SESSION_SIZE,
  ERROR_MESSAGES,
  type Difficulty,
} from '@/lib/constants';
import {
  logger,
  startPipeline,
  startStep,
  endStep,
  endPipeline,
} from '@/lib/utils/logger';

/** 문제 은행 시스템 사용 임계값 (500자 이상) */
const BANK_THRESHOLD = 500;

/**
 * POST /api/quiz/generate
 *
 * 텍스트로부터 퀴즈 생성
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  startPipeline(requestId);

  try {
    // 요청 본문 파싱
    startStep('요청 파싱');
    const body = await req.json();
    const { content, difficulty = 'medium', bypassCache = false } = body;
    // sessionSize 지원 + sessionSize 하위 호환
    const sessionSize = body.sessionSize ?? body.sessionSize ?? SESSION_SIZE.DEFAULT;
    endStep({ sessionSize, difficulty, bypassCache });

    // 입력 검증
    startStep('입력 검증');
    if (!content || typeof content !== 'string') {
      endStep();
      endPipeline(false, { error: 'CONTENT_REQUIRED' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_REQUIRED },
        { status: 400 }
      );
    }

    if (content.trim().length < CONTENT_LENGTH.MIN) {
      endStep();
      endPipeline(false, { error: 'CONTENT_TOO_SHORT', length: content.trim().length });
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_TOO_SHORT },
        { status: 400 }
      );
    }

    if (sessionSize < QUESTION_COUNT.MIN || sessionSize > QUESTION_COUNT.MAX) {
      endStep();
      endPipeline(false, { error: 'INVALID_QUESTION_COUNT' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_QUESTION_COUNT },
        { status: 400 }
      );
    }

    const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty)) {
      endStep();
      endPipeline(false, { error: 'INVALID_DIFFICULTY' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_DIFFICULTY },
        { status: 400 }
      );
    }
    endStep();

    // 퀴즈 생성 옵션 (questionCount는 하위 호환용)
    const options = {
      questionCount: sessionSize,
      difficulty: difficulty as Difficulty,
      bypassCache: Boolean(bypassCache),
    };

    logger.info('API', '📥 요청 정보', {
      '텍스트 길이': `${content.length}자`,
      '요청 문제 수': sessionSize,
      '난이도': difficulty,
      '캐시 우회': bypassCache,
    });

    // 텍스트 용량 확인
    startStep('텍스트 용량 분석');
    const capacity = calculateQuestionCapacity(content);
    endStep({
      min: capacity.min,
      max: capacity.max,
      optimal: capacity.optimal,
    });

    // 최소 문제 수(3개) 생성 불가 시 에러
    if (capacity.max < QUESTION_COUNT.MIN) {
      endPipeline(false, { error: 'CONTENT_INSUFFICIENT', maxCapacity: capacity.max });
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_INSUFFICIENT },
        { status: 400 }
      );
    }

    // 500자 이상: DB 문제 은행 시스템 사용 (개별 문제 저장 + 더 풀기 지원)
    // 500자 미만: 기존 하이브리드 시스템 (generation_cache 사용)
    const useDbBankSystem = content.length >= BANK_THRESHOLD;

    // 추가 조건: 10개 초과 또는 용량의 80% 이상 요청 시에도 은행 시스템
    const useBankSystem = useDbBankSystem || sessionSize > 10 || sessionSize >= capacity.max * 0.8;

    logger.info('API', `🔀 생성 모드 결정`, {
      '텍스트 길이': content.length,
      '임계값': BANK_THRESHOLD,
      'DB 은행 사용': useDbBankSystem,
      '은행 시스템 사용': useBankSystem,
    });

    if (useDbBankSystem) {
      // DB 문제 은행 시스템 사용 (500자 이상) - 개별 문제 저장 + 더 풀기 지원
      startStep('DB 문제 은행 시스템');
      // 세션 크기만큼 반환하되, 텍스트 용량 최대치로 생성
      const bankResult = await getOrGenerateQuestionBank(content, options, sessionSize, capacity.max);
      endStep({
        bankId: bankResult.bankId,
        isFromCache: bankResult.isFromCache,
        sessionSize: bankResult.questions.length,
        remainingCount: bankResult.remainingCount,
      });

      startStep('퀴즈 객체 생성');
      const rawQuiz = {
        id: crypto.randomUUID(),
        title: '생성된 퀴즈',
        questions: bankResult.questions,
        createdAt: new Date(),
        sessionSize, // 세션당 문제 수
        requestedQuestionCount: sessionSize, // 하위 호환
      };
      // OX 문제 등 정규화
      const quiz = normalizeQuiz(rawQuiz);
      endStep();

      // 퀴즈 유효성 검증
      startStep('유효성 검증');
      const validation = validateQuiz(quiz);
      if (!validation.valid) {
        endStep({ valid: false });
        logger.error('API', '퀴즈 유효성 검증 실패', { errors: validation.errors });
        endPipeline(false, { error: 'VALIDATION_FAILED' });
        return NextResponse.json(
          { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
          { status: 500 }
        );
      }
      endStep({ valid: true, sessionSize: quiz.questions.length });

      endPipeline(true, {
        quizId: quiz.id,
        sessionSize: quiz.questions.length,
        model: 'db-bank-system',
        isFromCache: bankResult.isFromCache,
      });

      return NextResponse.json({
        success: true,
        quiz,
        model: 'db-bank-system',
        bankId: bankResult.bankId,
        remainingCount: bankResult.remainingCount,
        isFromCache: bankResult.isFromCache,
        tokensUsed: bankResult.metadata?.tokensUsed ?? 0,
        bankMetadata: bankResult.metadata,
        capacity,
      });
    }

    if (useBankSystem) {
      // 메모리 풀 시스템 (500자 미만이지만 대량 요청)
      startStep('메모리 문제 풀 시스템');
      const poolResult = await generateQuestionPool(content, options, {
        targetCount: sessionSize,
        aiRatio: 0.7,
        transformRatio: 0.3,
      });
      endStep({
        aiGenerated: poolResult.metadata.aiGenerated,
        transformed: poolResult.metadata.transformed,
        tokensUsed: poolResult.metadata.tokensUsed,
      });

      startStep('퀴즈 객체 생성');
      const rawQuiz = createQuizFromPool(poolResult, '생성된 퀴즈');
      rawQuiz.sessionSize = sessionSize; // 세션당 문제 수
      rawQuiz.requestedQuestionCount = sessionSize; // 하위 호환
      // OX 문제 등 정규화
      const quiz = normalizeQuiz(rawQuiz);
      endStep();

      // 퀴즈 유효성 검증
      startStep('유효성 검증');
      const validation = validateQuiz(quiz);
      if (!validation.valid) {
        endStep({ valid: false });
        logger.error('API', '퀴즈 유효성 검증 실패', { errors: validation.errors });
        endPipeline(false, { error: 'VALIDATION_FAILED' });
        return NextResponse.json(
          { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
          { status: 500 }
        );
      }
      endStep({ valid: true, sessionSize: quiz.questions.length });

      endPipeline(true, {
        quizId: quiz.id,
        sessionSize: quiz.questions.length,
        model: 'pool-system',
        tokensUsed: poolResult.metadata.tokensUsed,
      });

      return NextResponse.json({
        success: true,
        quiz,
        model: 'pool-system',
        tokensUsed: poolResult.metadata.tokensUsed,
        poolMetadata: poolResult.metadata,
        capacity,
      });
    }

    // 기존 하이브리드 퀴즈 생성 (NLP 전처리 + 캐싱 + AI 폴백)
    startStep('하이브리드 퀴즈 생성');
    const result = await generateQuiz(content, options);
    // OX 문제 등 정규화
    result.quiz = normalizeQuiz(result.quiz);
    endStep({
      cached: result.cached,
      preprocessed: result.preprocessed,
      tokensUsed: result.tokensUsed,
    });

    // 퀴즈 유효성 검증
    startStep('유효성 검증');
    const validation = validateQuiz(result.quiz);
    if (!validation.valid) {
      endStep({ valid: false });
      logger.error('API', '퀴즈 유효성 검증 실패', { errors: validation.errors });
      endPipeline(false, { error: 'VALIDATION_FAILED' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
        { status: 500 }
      );
    }
    endStep({ valid: true, sessionSize: result.quiz.questions.length });

    endPipeline(true, {
      quizId: result.quiz.id,
      model: result.model,
      sessionSize: result.quiz.questions.length,
      cached: result.cached,
      preprocessed: result.preprocessed,
      tokensUsed: result.tokensUsed,
    });

    // 성공 응답
    return NextResponse.json({
      success: true,
      quiz: result.quiz,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cached: result.cached,
      preprocessed: result.preprocessed,
      originalLength: result.originalLength,
      processedLength: result.processedLength,
      capacity,
    });
  } catch (error) {
    logger.error('API', '퀴즈 생성 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    endPipeline(false, { error: error instanceof Error ? error.message : 'UNKNOWN' });

    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.QUIZ_GENERATION_ERROR;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quiz/generate
 *
 * API 상태 확인용
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Quiz generation API is running',
    supportedDifficulties: ['easy', 'medium', 'hard'] as Difficulty[],
    sessionSizeRange: { min: QUESTION_COUNT.MIN, max: QUESTION_COUNT.MAX },
  });
}
