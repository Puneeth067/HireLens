'use client';

import { useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Upload, 
  Briefcase, 
  Target, 
  Award, 
  TrendingUp, 
  FileText, 
  Settings,
  Menu,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  systemHealth?: 'healthy' | 'degraded' | 'error';
}

export default function DashboardLayout({ 
  children, 
  title,
  systemHealth = 'healthy'
}: DashboardLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Upload Resumes', href: '/upload', icon: Upload },
    { name: 'Job Management', href: '/jobs', icon: Briefcase },
    { name: 'Comparisons', href: '/comparisons', icon: Target },
    { name: 'Ranking', href: '/ranking', icon: Award },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Processing', href: '/processing', icon: FileText },
    { name: 'System', href: '/system', icon: Settings },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // If no title is provided, try to derive it from the current path
  const derivedTitle = title || 
    navigationItems.find(item => pathname === item.href)?.name || 
    navigationItems.find(item => pathname?.startsWith(item.href + '/'))?.name || 
    'Dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="bg-white shadow-lg"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm">RP</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Resume Parser</h1>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-2">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <li key={item.name}>
                    <Link 
                      href={item.href}
                      className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-blue-50 text-blue-600 font-medium' 
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Profile / Footer */}
          <div className="p-4 border-t">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-700 font-medium">U</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">User Name</p>
                <p className="text-xs text-gray-500">Recruiter</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:ml-64">
        {/* Fixed Header */}
        <header className="fixed top-0 right-0 left-0 md:left-64 backdrop-blur-sm bg-white/90 shadow-sm z-30">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">{derivedTitle}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${getStatusColor(systemHealth)}`}>
                {systemHealth === 'healthy' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="font-medium capitalize">System {systemHealth}</span>
              </div>
              <Button variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="pt-20 pb-8">
          {children}
        </main>
      </div>

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </div>
  );
}