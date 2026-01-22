/**
 * gimci 라이브러리 타입 선언
 * 한국어 형태소 분석 라이브러리
 */

declare module 'gimci' {
  interface Morpheme {
    surface: string; // 표면형
    pos: string; // 품사 태그
  }

  interface AnalyzedToken {
    surface: string;
    morphemes: Morpheme[];
  }

  /**
   * 텍스트를 형태소 분석
   */
  export function analyze(text: string): AnalyzedToken[];
}
