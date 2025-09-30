'use client';

import { useState, ReactNode, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const pathname = usePathname();

  // Load sidebar state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState) {
      setIsSidebarCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Determine if sidebar should be expanded
  const isSidebarExpanded = isSidebarHovered || isMenuOpen;

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Upload Resumes', href: '/upload', icon: Upload },
    { name: 'Job Management', href: '/jobs', icon: Briefcase },
    { name: 'Comparisons', href: '/comparisons', icon: Target },
    { name: 'Ranking', href: '/ranking', icon: Award },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Processing', href: '/processing', icon: FileText },
    // { name: 'System', href: '/system', icon: Settings },
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
    'Homepage';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button - moved to the left */}
      <div className="md:hidden fixed top-4 left-4 z-50">
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
        className={`fixed inset-y-0 left-0 z-40 bg-white shadow-lg transform transition-all duration-300 ease-in-out md:translate-x-0 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center px-4 py-4 border-b ${isSidebarExpanded ? 'px-6' : 'justify-center'}`}>
            <div className="flex items-center">
              {/* Use favicon*/}
              <div className="w-9 h-9 flex items-center justify-center">
                <Link href="/">
                <Image
                  src="/favicon-32x32.png" // or "/android-chrome-192x192.png" for higher res
                  alt="Recruvizz Logo"
                  width={36}
                  height={36}
                  className="rounded-lg"
                />
                </Link>
              </div>

              {isSidebarExpanded && (
                <h1 className="text-lg font-semibold text-gray-900 ml-3">RecruVizz</h1>
              )}
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
                      } ${isSidebarExpanded ? '' : 'justify-center'}`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {isSidebarExpanded && (
                        <span className="ml-3">{item.name}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={isSidebarExpanded ? "md:ml-64" : "md:ml-20"}>
        {/* Fixed Header - Added padding for mobile menu button */}
        <header className={`fixed top-0 right-0 left-0 backdrop-blur-sm bg-white/90 shadow-sm z-30 ${isSidebarExpanded ? 'md:left-64' : 'md:left-20'}`}>
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center">
              {/* Added spacing for mobile menu button */}
              <div className="md:hidden w-10"></div>
              <h1 className="text-xl font-semibold text-gray-900">{derivedTitle}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${getStatusColor(systemHealth)}`}>
                {systemHealth === 'healthy' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="font-medium capitalize hidden xs:inline">System {systemHealth}</span>
                <span className="font-medium capitalize xs:hidden">Sys {systemHealth}</span>
              </div>
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
      
      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}