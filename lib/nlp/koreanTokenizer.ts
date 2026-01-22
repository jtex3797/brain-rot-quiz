/**
 * 한국어 텍스트 토큰화 모듈
 * gimci 라이브러리를 활용한 한국어 형태소 분석
 */

import { analyze } from 'gimci';

// 한국어 불용어 목록 (조사, 접속사, 대명사 등)
const KOREAN_STOPWORDS = new Set([
  // 조사
  '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과',
  '도', '만', '은', '는', '이다', '입니다', '있다', '없다', '하다',
  // 접속사
  '그리고', '그러나', '그래서', '하지만', '또한', '또는', '및',
  // 대명사
  '나', '너', '우리', '저', '그', '이것', '저것', '그것',
  // 부사
  '매우', '아주', '정말', '너무', '가장', '더', '덜',
  // 기타
  '등', '것', '수', '때', '중', '후', '전', '안', '밖',
]);

// 영어 불용어 목록
const ENGLISH_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
]);

/**
 * 텍스트가 한국어인지 영어인지 판별
 */
export function detectLanguage(text: string): 'ko' | 'en' | 'mixed' {
  const koreanPattern = /[가-힣]/g;
  const englishPattern = /[a-zA-Z]/g;

  const koreanMatches = text.match(koreanPattern) || [];
  const englishMatches = text.match(englishPattern) || [];

  const koreanRatio = koreanMatches.length / (text.length || 1);
  const englishRatio = englishMatches.length / (text.length || 1);

  if (koreanRatio > 0.3 && englishRatio > 0.3) return 'mixed';
  if (koreanRatio > englishRatio) return 'ko';
  return 'en';
}

/**
 * 한국어 텍스트를 토큰화
 * gimci를 사용하여 형태소 분석 후 의미있는 토큰만 추출
 */
export function tokenizeKorean(text: string): string[] {
  const analyzed = analyze(text);
  const tokens: string[] = [];

  for (const item of analyzed) {
    // 체언(명사류), 용언(동사/형용사) 어간만 추출
    if (item.morphemes) {
      for (const morpheme of item.morphemes) {
        // 명사, 동사, 형용사 어간 등 의미있는 형태소만
        const pos = morpheme.pos;
        if (
          pos.startsWith('N') || // 명사
          pos.startsWith('V') || // 동사
          pos.startsWith('M') || // 관형사/부사
          pos === 'SL' // 외국어
        ) {
          const token = morpheme.surface.toLowerCase();
          if (token.length > 1 && !KOREAN_STOPWORDS.has(token)) {
            tokens.push(token);
          }
        }
      }
    }
  }

  return tokens;
}

/**
 * 영어 텍스트를 토큰화
 * 단순 공백/구두점 기반 분리 + 불용어 제거
 */
export function tokenizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !ENGLISH_STOPWORDS.has(token));
}

/**
 * 텍스트를 언어에 맞게 토큰화
 */
export function tokenize(text: string): string[] {
  const language = detectLanguage(text);

  if (language === 'ko') {
    return tokenizeKorean(text);
  } else if (language === 'en') {
    return tokenizeEnglish(text);
  } else {
    // mixed: 둘 다 적용
    return [...tokenizeKorean(text), ...tokenizeEnglish(text)];
  }
}

/**
 * 토큰 배열에서 불용어 제거
 */
export function removeStopwords(
  tokens: string[],
  language: 'ko' | 'en' | 'mixed' = 'mixed'
): string[] {
  const stopwords =
    language === 'ko'
      ? KOREAN_STOPWORDS
      : language === 'en'
        ? ENGLISH_STOPWORDS
        : new Set([...KOREAN_STOPWORDS, ...ENGLISH_STOPWORDS]);

  return tokens.filter((token) => !stopwords.has(token.toLowerCase()));
}
