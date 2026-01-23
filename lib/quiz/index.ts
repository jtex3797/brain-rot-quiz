/**
 * Quiz 모듈 진입점
 * 문제 풀 생성 관련 기능 export
 */

// 텍스트 품질 분석기
export {
  analyzeTextQuality,
  calculateQuestionCapacity,
  quickCapacityCheck,
  isWithinCapacity,
  type TextQualityMetrics,
  type QuestionCapacity,
} from './textAnalyzer';

// 문제 변형기
export {
  transformQuestions,
  transformSwapAnswer,
  transformShiftBlank,
  transformNegate,
  transformShuffleOptions,
  transformMcqToOx,
  DEFAULT_TRANSFORMATION_OPTIONS,
} from './questionTransformer';

// AI 배치 생성기
export {
  generateQuestionBatch,
  generateSingleBatch,
  DEFAULT_BATCH_CONFIG,
  type BatchGenerationResult,
} from './batchGenerator';

// 통합 파이프라인
export {
  generateQuestionPool,
  createQuizFromPool,
  generateQuizPool,
  DEFAULT_POOL_CONFIG,
  type QuestionPoolConfig,
} from './questionPool';
