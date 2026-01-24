import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrainRotQuiz - AI 기반 게이미피케이션 퀴즈 앱",
  description: "읽기 어려운 문장들을 재미있게 퀴즈로 변환하여 학습 효율을 극대화하는 게이미피케이션 퀴즈 앱",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 서버에서 세션 prefetch (깜빡임 방지)
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // 프로필도 함께 prefetch (선택)
  let profile = null;
  if (session?.user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    profile = data;
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialSession={session} initialProfile={profile}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
