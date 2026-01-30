'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { BadgeCard } from './BadgeCard';
import { getAllBadges, getUserBadges } from '@/lib/supabase/badges';
import type { Badge, UserBadge, BadgeCategory } from '@/types/badge';
import { BADGE_CATEGORY_LABELS } from '@/types/badge';

interface BadgeListProps {
  userId: string;
}

export function BadgeList({ userId }: BadgeListProps) {
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBadges() {
      const [all, user] = await Promise.all([
        getAllBadges(),
        getUserBadges(userId),
      ]);
      setAllBadges(all);
      setUserBadges(user);
      setIsLoading(false);
    }
    loadBadges();
  }, [userId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>뱃지</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-foreground/10 rounded w-1/4" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-foreground/10 rounded-full mx-auto w-12"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const earnedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub]));
  const categories = [...new Set(allBadges.map((b) => b.category))];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          뱃지 ({userBadges.length}/{allBadges.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => {
          const badgesInCategory = allBadges.filter(
            (b) => b.category === category
          );
          const earnedCount = badgesInCategory.filter((b) =>
            earnedMap.has(b.id)
          ).length;

          return (
            <div key={category}>
              <h4 className="text-sm font-medium text-foreground/60 mb-3">
                {BADGE_CATEGORY_LABELS[category as BadgeCategory]} ({earnedCount}
                /{badgesInCategory.length})
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {badgesInCategory.map((badge) => {
                  const userBadge = earnedMap.get(badge.id);
                  return (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      earned={!!userBadge}
                      earnedAt={userBadge?.earnedAt}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
