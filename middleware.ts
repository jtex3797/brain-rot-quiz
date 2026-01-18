import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// 보호된 라우트 목록 (로그인 필요)
const protectedRoutes = ['/profile', '/my-quizzes', '/dashboard'];

// 인증된 사용자가 접근하면 안 되는 라우트
const authRoutes = ['/auth/login', '/auth/signup'];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 보호된 라우트 체크
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !user) {
    // 로그인되지 않은 상태로 보호된 라우트 접근 시 로그인 페이지로 리다이렉트
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return Response.redirect(redirectUrl);
  }

  // 이미 로그인된 사용자가 auth 라우트 접근 시 홈으로 리다이렉트
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && user) {
    return Response.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     * - public 폴더 파일
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wav|mp3)$).*)',
  ],
};
