'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';

// 레벨별 필요 XP 계산 (schema.sql의 calculate_level 역산)
function getXPForLevel(level: number): number {
  // level = floor((-1 + sqrt(1 + 8 * xp / 100)) / 2)
  // 역산: xp = 100 * level * (level + 1) / 2
  return Math.floor((100 * level * (level + 1)) / 2);
}

export default function ProfilePage() {
  const { profile, isLoading } = useAuth();

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground/70">프로필을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 프로필이 없는 경우 (middleware에서 처리하지만 안전장치)
  if (!profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <p className="text-foreground/70 mb-4">프로필을 찾을 수 없습니다.</p>
          <Link href="/auth/login">
            <Button variant="primary">로그인하기</Button>
          </Link>
        </div>
      </div>
    );
  }

  // XP 진행률 계산
  const currentLevelXP = getXPForLevel(profile.level);
  const nextLevelXP = getXPForLevel(profile.level + 1);
  const xpProgress = profile.xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  const xpPercentage = Math.min(100, Math.round((xpProgress / xpNeeded) * 100));

  // 정답률 계산
  const accuracyRate =
    profile.total_questions_answered > 0
      ? Math.round(
          (profile.total_correct_answers / profile.total_questions_answered) *
            100
        )
      : 0;

  // 닉네임 또는 이메일 앞부분
  const displayName = profile.nickname || profile.email.split('@')[0];

  // 아바타 초성
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <PageContainer maxWidth="MEDIUM" className="py-8">
      <PageHeader title="내 프로필" />

      <div className="grid gap-6 md:grid-cols-3">
        {/* 프로필 카드 */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            {/* 아바타 */}
            <div className="flex flex-col items-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mb-4">
                  <span className="text-4xl font-bold text-white">
                    {avatarInitial}
                  </span>
                </div>
              )}

              {/* 닉네임 */}
              <h2 className="text-2xl font-bold text-foreground mb-1">
                {displayName}
              </h2>

              {/* 이메일 */}
              <p className="text-sm text-foreground/60 mb-4">
                {profile.email}
              </p>

              {/* 레벨 배지 */}
              <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-bold">
                Lv.{profile.level}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 통계 영역 */}
        <div className="md:col-span-2 space-y-6">
          {/* XP/레벨 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>경험치</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground/70">현재 XP</span>
                <span className="text-2xl font-bold text-primary">
                  {profile.xp.toLocaleString()} XP
                </span>
              </div>

              <div>
                <div className="flex justify-between text-sm text-foreground/60 mb-2">
                  <span>Lv.{profile.level}</span>
                  <span>Lv.{profile.level + 1}</span>
                </div>
                <ProgressBar
                  value={xpProgress}
                  max={xpNeeded}
                  color="primary"
                />
                <p className="text-sm text-foreground/60 mt-2 text-center">
                  다음 레벨까지 {(xpNeeded - xpProgress).toLocaleString()} XP
                  ({xpPercentage}%)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 스트릭 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>학습 스트릭</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-combo/10 rounded-xl">
                  <div className="text-4xl mb-2">🔥</div>
                  <div className="text-3xl font-bold text-combo">
                    {profile.current_streak}일
                  </div>
                  <div className="text-sm text-foreground/60">현재 연속</div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-xl">
                  <div className="text-4xl mb-2">🏆</div>
                  <div className="text-3xl font-bold text-primary">
                    {profile.longest_streak}일
                  </div>
                  <div className="text-sm text-foreground/60">최장 기록</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 통계 카드 */}
          <Card>
            <CardHeader>
              <CardTitle>학습 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-foreground/5 rounded-xl">
                  <div className="text-3xl font-bold text-foreground">
                    {profile.total_quizzes_played}
                  </div>
                  <div className="text-sm text-foreground/60">완료한 퀴즈</div>
                </div>
                <div className="text-center p-4 bg-foreground/5 rounded-xl">
                  <div className="text-3xl font-bold text-foreground">
                    {profile.total_questions_answered}
                  </div>
                  <div className="text-sm text-foreground/60">푼 문제</div>
                </div>
                <div className="text-center p-4 bg-foreground/5 rounded-xl">
                  <div
                    className={`text-3xl font-bold ${
                      accuracyRate >= 80
                        ? 'text-success'
                        : accuracyRate >= 60
                          ? 'text-combo'
                          : 'text-foreground'
                    }`}
                  >
                    {accuracyRate}%
                  </div>
                  <div className="text-sm text-foreground/60">정답률</div>
                </div>
              </div>

              {/* 정답/오답 상세 */}
              <div className="mt-4 pt-4 border-t border-foreground/10">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">정답</span>
                  <span className="text-success font-medium">
                    {profile.total_correct_answers}개
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-foreground/60">오답</span>
                  <span className="text-error font-medium">
                    {profile.total_questions_answered -
                      profile.total_correct_answers}
                    개
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 가입일 */}
          <p className="text-sm text-foreground/50 text-center">
            가입일:{' '}
            {new Date(profile.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
