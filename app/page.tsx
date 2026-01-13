import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold text-foreground">
            BrainRotQuiz
          </h1>
          <p className="mb-8 text-xl text-foreground/70">
            읽기 어려운 문장들을 재미있게 퀴즈로 변환하여 학습 효율을 극대화하는 게이미피케이션 퀴즈 앱
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/upload">
              <Button size="lg">퀴즈 시작하기</Button>
            </Link>
            <Button variant="outline" size="lg">
              사용 방법
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-foreground">
            주요 기능
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card hover>
              <CardHeader>
                <CardTitle>즉각적 변환</CardTitle>
              </CardHeader>
              <CardContent>
                텍스트를 입력하면 몇 초 만에 AI가 퀴즈로 자동 변환합니다.
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <CardTitle>게이미피케이션</CardTitle>
              </CardHeader>
              <CardContent>
                콤보, 스트릭, 레벨업 시스템으로 학습 동기를 극대화합니다.
              </CardContent>
            </Card>

            <Card hover>
              <CardHeader>
                <CardTitle>적응형 학습</CardTitle>
              </CardHeader>
              <CardContent>
                틀린 문제를 반복 학습하는 스마트 복습 시스템을 제공합니다.
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-foreground">
            사용 방법
          </h2>
          <div className="mx-auto max-w-3xl">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">문서 업로드</h3>
                    <p className="text-foreground/70">
                      학습하고 싶은 텍스트 문서를 업로드하거나 붙여넣기 합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">AI 분석</h3>
                    <p className="text-foreground/70">
                      AI가 문서를 분석하여 핵심 내용을 파악하고 퀴즈를 생성합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">퀴즈 풀이</h3>
                    <p className="text-foreground/70">
                      게임처럼 재미있게 퀴즈를 풀면서 학습 내용을 내 것으로 만듭니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="mx-auto max-w-2xl bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>지금 시작하세요</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-foreground/70">
                지루한 학습은 이제 그만! BrainRotQuiz와 함께 즐겁게 학습하세요.
              </p>
              <Link href="/upload">
                <Button size="lg">첫 퀴즈 만들기</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
