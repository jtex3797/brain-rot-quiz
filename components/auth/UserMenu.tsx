'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName = profile?.nickname || user.email?.split('@')[0] || '사용자';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-foreground/10 transition-colors"
      >
        {/* 아바타 */}
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        <span className="text-sm font-medium text-foreground/80 hidden sm:block">
          {displayName}
        </span>
        {/* 드롭다운 화살표 */}
        <svg
          className={`w-4 h-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-background rounded-lg shadow-lg border border-border py-1 z-50">
          {/* 사용자 정보 */}
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted">{user.email}</p>
            {profile && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <span>Lv.{profile.level}</span>
                <span>|</span>
                <span>{profile.xp} XP</span>
              </div>
            )}
          </div>

          {/* 메뉴 아이템 */}
          <Link
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm text-foreground/80 hover:bg-foreground/5"
          >
            내 프로필
          </Link>
          <Link
            href="/my-quizzes"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm text-foreground/80 hover:bg-foreground/5"
          >
            내 퀴즈
          </Link>

          <div className="border-t border-border mt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error/10"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
