/**
 * 캐시 모듈 진입점
 */

export {
  getCachedQuiz,
  setCachedQuiz,
  cleanupExpiredCache,
  hashContent,
  hashOptions,
  type CacheOptions,
} from './quizCache';
