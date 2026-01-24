'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SoundToggle } from '@/components/ui/SoundToggle';

interface MinimalHeaderProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
}

export function MinimalHeader({
  backHref = '/',
  backLabel = '나가기',
  title,
}: MinimalHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="text-sm text-foreground/60 hover:text-primary transition-colors"
            >
              ← {backLabel}
            </Link>
            {title && (
              <h1 className="text-lg font-bold text-foreground truncate max-w-[200px] sm:max-w-none">
                {title}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SoundToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
