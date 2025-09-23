import type { Metadata } from 'next';
import './globals.css';
import ErrorBoundary from '@/components/error-boundary';
import DashboardLayout from '@/components/ui/dashboard-layout';

export const metadata: Metadata = {
  title: 'RecruVizz - Resume Parser & Insight Generator',
  description: 'NLP-based resume parsing and job matching system for recruiters',

  // 👇 Add these
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <ErrorBoundary errorBoundaryName="RootLayout">
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </ErrorBoundary>
      </body>
    </html>
  );
}