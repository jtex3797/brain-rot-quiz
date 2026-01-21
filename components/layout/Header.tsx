'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { UserMenu } from '@/components/auth/UserMenu';

export function Header() {
  const { user, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="text-xl font-bold text-foreground">
            BrainRotQuiz
          </Link>

          {/* 우측 메뉴 */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SoundToggle />

            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-foreground/10 animate-pulse" />
            ) : user ? (
              <UserMenu />
            ) : (
              <Link href="/auth/login">
                <Button variant="primary" size="sm">
                  로그인
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
