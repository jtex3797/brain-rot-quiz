'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { signIn } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirectTo') || '/';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const { error: signInError } = await signIn(email, password);

            if (signInError) {
                setError(signInError.message);
                return;
            }

            router.push(redirectTo);
            router.refresh();
        } catch {
            setError('로그인 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
                <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground/80">
                        이메일
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="name@example.com"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-foreground/80">
                        비밀번호
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
            >
                {isLoading ? '로그인 중...' : '로그인'}
            </Button>

            <p className="text-center text-sm text-muted">
                계정이 없으신가요?{' '}
                <Link
                    href="/auth/signup"
                    className="font-medium text-primary hover:text-primary/80"
                >
                    회원가입
                </Link>
            </p>
        </form>
    );
}

export default function LoginPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-center text-3xl font-bold text-foreground">
                    BrainRotQuiz
                </h1>
                <h2 className="mt-2 text-center text-xl text-muted">
                    로그인
                </h2>
            </div>

            <Suspense fallback={<div className="text-center">로딩 중...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
