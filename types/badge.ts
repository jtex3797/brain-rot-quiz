/**
 * 뱃지 시스템 타입 정의
 */

// 뱃지 카테고리
export type BadgeCategory =
  | 'level' // 레벨 달성
  | 'combo' // 콤보 달성
  | 'accuracy' // 정답률 유지
  | 'streak' // 스트릭 달성
  | 'quiz_count' // 퀴즈 완료 수
  | 'special'; // 특별 뱃지

// 뱃지 티어 (1=브론즈, 2=실버, 3=골드, 4=다이아)
export type BadgeTier = 1 | 2 | 3 | 4;

// 뱃지 정의
export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  tier: BadgeTier;
  conditionType: string;
  conditionValue: number;
  isHidden: boolean;
  sortOrder: number;
}

// 사용자 획득 뱃지
export interface UserBadge {
  id: string;
  badgeId: string;
  earnedAt: Date;
  isNotified: boolean;
  badge: Badge;
}

// 새로 획득한 뱃지 (알림용)
export interface NewlyEarnedBadge {
  code: string;
  name: string;
  icon: string;
}

// 뱃지 체크 결과
export interface BadgeCheckResult {
  newBadges: NewlyEarnedBadge[];
}

// 뱃지 진행도
export interface BadgeProgress {
  earned: number;
  total: number;
  byCategory: Record<BadgeCategory, { earned: number; total: number }>;
}

// 카테고리 라벨
export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  level: '레벨',
  combo: '콤보',
  streak: '스트릭',
  quiz_count: '퀴즈 완료',
  accuracy: '정답률',
  special: '특별',
};

// 티어 색상
export const BADGE_TIER_COLORS: Record<BadgeTier, { bg: string; border: string }> = {
  1: { bg: 'bg-amber-600/20', border: 'border-amber-600/40' }, // 브론즈
  2: { bg: 'bg-slate-400/20', border: 'border-slate-400/40' }, // 실버
  3: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' }, // 골드
  4: { bg: 'bg-cyan-400/20', border: 'border-cyan-400/40' }, // 다이아
};
