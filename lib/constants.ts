/**
 * 앱 전역 상수 정의
 * 매직 넘버와 문자열을 중앙 집중화하여 유지보수성 향상
 */

// ============================================
// 스토리지 관련 상수
// ============================================

/** 로컬 스토리지 키 접두사 */
export const STORAGE_KEY_PREFIX = 'brainrotquiz_';

// ============================================
// 퀴즈 설정 관련 상수
// ============================================

/** 문제 수 범위 */
export const QUESTION_COUNT = {
  MIN: 3,
  MAX: 50,
  DEFAULT: 5,
  BATCH_SIZE: 7,
  MAX_BATCHES: 5,
} as const;

/** 텍스트 입력 제한 */
export const CONTENT_LENGTH = {
  MIN: 50,
} as const;

/** 난이도 타입 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 난이도 옵션 (UI용) */
export const DIFFICULTY_OPTIONS: Array<{
  value: Difficulty;
  label: string;
  description: string;
}> = [
  { value: 'easy', label: '쉬움', description: '객관식 위주' },
  { value: 'medium', label: '보통', description: '객관식 + OX' },
  { value: 'hard', label: '어려움', description: '단답형 포함' },
];

/** 난이도별 설명 (프롬프트용) */
export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = {
  easy: '쉬운 난이도: 주요 용어와 기본 개념 중심. 객관식 위주.',
  medium: '보통 난이도: 개념 이해와 적용. 객관식과 OX 혼합.',
  hard: '어려운 난이도: 심화 개념과 추론. 단답형 포함.',
};

// ============================================
// 게이미피케이션 관련 상수
// ============================================

/** 콤보 임계값 */
export const COMBO_THRESHOLDS = {
  /** 콤보 표시 최소값 */
  MIN_DISPLAY: 2,
  /** 중간 콤보 (ON FIRE!) */
  MEDIUM: 5,
  /** 높은 콤보 (AMAZING!) */
  HIGH: 7,
  /** 최대 콤보 (UNSTOPPABLE!) */
  MAX: 10,
} as const;

/** 콤보 텍스트 */
export const COMBO_TEXTS: Record<string, string> = {
  DEFAULT: '',
  COMBO: 'COMBO!',
  ON_FIRE: 'ON FIRE!',
  AMAZING: 'AMAZING!',
  UNSTOPPABLE: 'UNSTOPPABLE!',
};

/** 콤보에 따른 색상 클래스 (text-*) */
export function getComboTextColor(combo: number): string {
  if (combo >= COMBO_THRESHOLDS.MAX) return 'text-error';
  if (combo >= COMBO_THRESHOLDS.MEDIUM) return 'text-combo';
  return 'text-primary';
}

/** 콤보에 따른 배경색 클래스 (bg-*) */
export function getComboBgColor(combo: number): string {
  if (combo >= COMBO_THRESHOLDS.MAX) return 'bg-error';
  if (combo >= COMBO_THRESHOLDS.MEDIUM) return 'bg-combo';
  return 'bg-primary';
}

/** 콤보에 따른 텍스트 */
export function getComboText(combo: number): string {
  if (combo >= COMBO_THRESHOLDS.MAX) return COMBO_TEXTS.UNSTOPPABLE;
  if (combo >= COMBO_THRESHOLDS.HIGH) return COMBO_TEXTS.AMAZING;
  if (combo >= COMBO_THRESHOLDS.MEDIUM) return COMBO_TEXTS.ON_FIRE;
  if (combo >= 3) return COMBO_TEXTS.COMBO;
  return COMBO_TEXTS.DEFAULT;
}

// ============================================
// 타이밍 관련 상수
// ============================================

/** 애니메이션/피드백 지속 시간 (ms) */
export const TIMING = {
  /** 정답 피드백 표시 시간 */
  ANSWER_FEEDBACK_DELAY: 1500,
  /** 콤보 애니메이션 지속 시간 */
  COMBO_ANIMATION_DURATION: 300,
} as const;

// ============================================
// 사운드 관련 상수
// ============================================

/** 사운드 파일 경로 */
export const SOUND_FILES = {
  CORRECT: '/sounds/correct.wav',
  WRONG: '/sounds/wrong.wav',
} as const;

/** 사운드 설정 */
export const SOUND_CONFIG = {
  DEFAULT_VOLUME: 0.5,
} as const;

/** 사운드 관련 스토리지 키 */
export const SOUND_STORAGE_KEYS = {
  ENABLED: `${STORAGE_KEY_PREFIX}sound_enabled`,
  VOLUME: `${STORAGE_KEY_PREFIX}sound_volume`,
} as const;

// ============================================
// 에러 메시지 상수
// ============================================

export const ERROR_MESSAGES = {
  // 입력 검증
  CONTENT_REQUIRED: '텍스트를 입력해주세요',
  CONTENT_TOO_SHORT: '텍스트가 너무 짧습니다. 최소 50자 이상 입력해주세요.',
  CONTENT_INSUFFICIENT: '텍스트가 너무 짧아 최소 3개의 문제를 생성할 수 없습니다. 더 긴 내용을 입력해주세요.',
  INVALID_DIFFICULTY: '유효하지 않은 난이도입니다',
  INVALID_QUESTION_COUNT: '문제 수는 3개에서 50개 사이여야 합니다',

  // 퀴즈 관련
  QUIZ_GENERATION_FAILED: '퀴즈 생성에 실패했습니다',
  QUIZ_GENERATION_ERROR: '퀴즈 생성 중 오류가 발생했습니다',
  QUIZ_DATA_MISSING: '퀴즈 데이터를 받지 못했습니다',
  QUIZ_NOT_FOUND: '퀴즈를 찾을 수 없습니다',
  QUIZ_SAVE_FAILED: '퀴즈 저장에 실패했습니다',

  // 파일 관련
  FILE_TEXT_ONLY: '텍스트 파일만 업로드 가능합니다',
  FILE_READ_FAILED: '파일을 읽을 수 없습니다',

  // 스토리지 관련
  STORAGE_BROWSER_ONLY: 'localStorage is only available in the browser',
} as const;
