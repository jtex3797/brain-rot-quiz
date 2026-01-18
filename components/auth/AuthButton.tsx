'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

export function AuthButton() {
  const { user, profile, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="h-10 w-20 bg-gray-200 animate-pulse rounded-lg" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          {profile?.nickname || user.email?.split('@')[0]}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut()}
        >
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/auth/login">
        <Button variant="outline" size="sm">
          로그인
        </Button>
      </Link>
      <Link href="/auth/signup">
        <Button size="sm">
          회원가입
        </Button>
      </Link>
    </div>
  );
}
