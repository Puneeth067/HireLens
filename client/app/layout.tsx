import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ErrorBoundary from '@/components/error-boundary';
import DashboardLayout from '@/components/ui/dashboard-layout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HireLens - AI Resume Parser & Insight Generator',
  description: 'AI-powered resume parsing and job matching system for recruiters',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        <ErrorBoundary errorBoundaryName="RootLayout">
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </ErrorBoundary>
      </body>
    </html>
  );
}