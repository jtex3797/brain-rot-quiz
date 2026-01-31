/**
 * 뱃지 시스템 서비스
 */

import { createClient } from './client';
import { logger } from '@/lib/utils/logger';
import type {
  Badge,
  UserBadge,
  NewlyEarnedBadge,
  BadgeCheckResult,
  BadgeProgress,
  BadgeCategory,
  BadgeTier,
} from '@/types/badge';

// ============================================
// DB Row → 앱 타입 변환
// ============================================

interface BadgeRow {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  sort_order: number;
  created_at: string;
}

interface UserBadgeRow {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  is_notified: boolean;
  badges?: BadgeRow;
}

function transformBadge(row: BadgeRow): Badge {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category as BadgeCategory,
    tier: row.tier as BadgeTier,
    conditionType: row.condition_type,
    conditionValue: row.condition_value,
    isHidden: row.is_hidden,
    sortOrder: row.sort_order,
  };
}

function transformUserBadge(row: UserBadgeRow): UserBadge {
  return {
    id: row.id,
    badgeId: row.badge_id,
    earnedAt: new Date(row.earned_at),
    isNotified: row.is_notified,
    badge: row.badges ? transformBadge(row.badges) : ({} as Badge),
  };
}

// ============================================
// 뱃지 조회 함수
// ============================================

/**
 * 모든 뱃지 정의 조회
 */
export async function getAllBadges(): Promise<Badge[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('sort_order');

  if (error) {
    logger.error('Badges', '뱃지 목록 조회 실패', { error: error.message });
    return [];
  }

  return (data as BadgeRow[]).map(transformBadge);
}

/**
 * 사용자 획득 뱃지 조회
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_badges')
    .select(
      `
      *,
      badges(*)
    `
    )
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });

  if (error) {
    logger.error('Badges', '사용자 뱃지 조회 실패', {
      error: error.message,
      userId,
    });
    return [];
  }

  return (data as UserBadgeRow[]).map(transformUserBadge);
}

// ============================================
// 뱃지 체크 및 부여
// ============================================

/**
 * 뱃지 체크 및 부여 (세션 완료 시 호출)
 */
export async function checkAndAwardBadges(
  userId: string
): Promise<BadgeCheckResult> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('check_and_award_badges', {
    p_user_id: userId,
  });

  if (error) {
    logger.error('Badges', '뱃지 체크 RPC 실패', {
      error: error.message,
      userId,
    });
    return { newBadges: [] };
  }

  const newBadges: NewlyEarnedBadge[] = (data || []).map(
    (row: { badge_code: string; badge_name: string; badge_icon: string }) => ({
      code: row.badge_code,
      name: row.badge_name,
      icon: row.badge_icon,
    })
  );

  if (newBadges.length > 0) {
    logger.info('Badges', '새 뱃지 획득', {
      userId,
      newBadges: newBadges.map((b) => b.code),
    });
  }

  return { newBadges };
}

/**
 * 미알림 뱃지 알림 처리 완료
 */
export async function markBadgesNotified(userId: string): Promise<void> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_badges')
    .update({ is_notified: true })
    .eq('user_id', userId)
    .eq('is_notified', false);

  if (error) {
    logger.error('Badges', '뱃지 알림 처리 실패', { error: error.message });
  }
}

// ============================================
// 뱃지 진행도
// ============================================

/**
 * 뱃지 진행도 계산 (프로필 페이지용)
 */
export async function getBadgeProgress(userId: string): Promise<BadgeProgress> {
  const [allBadges, userBadges] = await Promise.all([
    getAllBadges(),
    getUserBadges(userId),
  ]);

  const earnedIds = new Set(userBadges.map((ub) => ub.badgeId));

  const byCategory = {} as Record<
    BadgeCategory,
    { earned: number; total: number }
  >;

  for (const badge of allBadges) {
    if (!byCategory[badge.category]) {
      byCategory[badge.category] = { earned: 0, total: 0 };
    }
    byCategory[badge.category].total++;
    if (earnedIds.has(badge.id)) {
      byCategory[badge.category].earned++;
    }
  }

  return {
    earned: userBadges.length,
    total: allBadges.length,
    byCategory,
  };
}
