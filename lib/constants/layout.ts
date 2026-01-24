/**
 * 레이아웃 관련 상수 정의
 */

// ============================================
// 컨테이너 max-width 정책
// ============================================
export const CONTAINER_WIDTH = {
  /** 기본 컨테이너 */
  DEFAULT: 'max-w-5xl',
  /** 좁은 컨테이너 (퀴즈 플레이, 폼) */
  NARROW: 'max-w-3xl',
  /** 중간 컨테이너 (프로필, 목록) */
  MEDIUM: 'max-w-4xl',
  /** 작은 컨테이너 (인증 폼) */
  SMALL: 'max-w-md',
  /** 전체 너비 */
  FULL: 'max-w-none',
} as const;

// ============================================
// Padding 정책
// ============================================
export const SPACING = {
  /** 페이지 기본 수직 패딩 */
  PAGE_Y: 'py-8',
  /** 페이지 작은 수직 패딩 */
  PAGE_Y_SM: 'py-6',
  /** 페이지 큰 수직 패딩 */
  PAGE_Y_LG: 'py-12',
  /** 컨테이너 수평 패딩 */
  CONTAINER_X: 'px-4',
} as const;

export type ContainerWidth = keyof typeof CONTAINER_WIDTH;
