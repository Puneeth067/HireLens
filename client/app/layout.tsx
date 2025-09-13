import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Resume Parser & Insight Generator',
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
        <div className="flex flex-col min-h-screen">
          
          {/* Header */}
          <header className="backdrop-blur-sm bg-white/90 shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-800 font-semibold text-sm">RP</span>
                </div>
                <h1 className="text-lg font-semibold text-gray-900">Resume Parser</h1>
              </div>
              <div className="text-sm text-gray-500">
                Powered by AI
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 container mx-auto px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-gray-100 border-t mt-auto">
            <div className="container mx-auto px-6 py-6 text-center text-sm text-gray-500">
              &copy; 2025 Resume Parser. Built for recruiters to streamline hiring.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
