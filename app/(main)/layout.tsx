import { Header } from '@/components/layout/Header';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4">
        {children}
      </main>
    </div>
  );
}
