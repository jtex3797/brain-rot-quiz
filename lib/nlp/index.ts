/**
 * NLP 모듈 진입점
 * 텍스트 전처리 관련 기능 export
 */

// 메인 처리 함수
export {
  processText,
  splitSentences,
  extractTopSentences,
  removeDuplicateSentences,
  shouldPreprocess,
  type ProcessedText,
  type ScoredSentence,
} from './textProcessor';

// 토큰화
export {
  tokenize,
  tokenizeKorean,
  tokenizeEnglish,
  detectLanguage,
  removeStopwords,
} from './koreanTokenizer';

// TF-IDF
export {
  calculateTF,
  calculateIDF,
  calculateSentenceTFIDF,
  calculateAllSentenceScores,
} from './tfidf';
