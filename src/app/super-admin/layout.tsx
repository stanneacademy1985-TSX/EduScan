'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearAdminSessions, fetchAdminById, getStoredAdminSession, storeAdminSession } from '../../../lib/admin-auth'
import { 
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Shield
} from 'lucide-react'
import Link from 'next/link'

interface SuperAdminUser {
  id: string
  full_name: string
  email: string
  role: string
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState<SuperAdminUser | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (pathname === '/super-admin/login') {
          setAuthChecking(false)
          return
        }

        const adminData = getStoredAdminSession()
        if (!adminData) {
          clearAdminSessions()
          router.replace('/super-admin/login')
          return
        }

        if (adminData.role !== 'super_admin') {
          router.replace('/super-admin/login')
          return
        }

        const freshAdmin = adminData.id ? await fetchAdminById(adminData.id) : null
        if (!freshAdmin) {
          clearAdminSessions()
          router.replace('/super-admin/login')
          return
        }

        if (freshAdmin.role !== 'super_admin') {
          storeAdminSession(freshAdmin)
          localStorage.setItem('admin', JSON.stringify(freshAdmin))
          router.replace('/super-admin/login')
          return
        }

        setAdmin(freshAdmin)
        storeAdminSession(freshAdmin)
        localStorage.setItem('admin', JSON.stringify(freshAdmin))
        setAuthChecking(false)
      } catch (error) {
        console.error('Auth check error:', error)
        clearAdminSessions()
        router.replace('/super-admin/login')
      }
    }
    
    checkAuth()
  }, [router, pathname])

  const handleLogout = () => {
    clearAdminSessions()
    router.replace('/super-admin/login')
  }

  const isActive = (path: string) => {
    return pathname === path
  }

  if (pathname === '/super-admin/login') {
    return <>{children}</>
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center px-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 sm:mt-6 text-gray-600">Loading Super Admin Panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )}

      {/* Side Navigation */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white border-r border-gray-200 shadow-lg
          flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-64 lg:w-20' : 'w-64 sm:w-72'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 sm:h-20 flex items-center px-3 sm:px-4 border-b border-gray-200 relative">
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="St. Anne's Academy" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-white font-bold text-base sm:text-lg bg-gradient-to-br from-indigo-600 to-purple-800 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xs sm:text-sm font-bold text-gray-900 truncate">Super Admin Portal</h2>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">St. Anne's Academy</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(true)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md"
              >
                <ChevronLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <div className="w-full flex justify-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="SAA" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-white font-bold text-base sm:text-lg bg-gradient-to-br from-indigo-600 to-purple-800 w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(false)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md"
              >
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Admin Profile Summary */}
        {!sidebarCollapsed ? (
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{admin?.full_name || 'Super Admin'}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">Super Administrator</p>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate hidden sm:block">{admin?.email}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-2 sm:p-3 space-y-1 flex-1 overflow-y-auto pb-20 lg:pb-4">
          <Link
            href="/super-admin/dashboard"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-colors
              ${isActive('/super-admin/dashboard') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium">Dashboard</span>}
          </Link>

          <Link
            href="/super-admin/teachers"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-colors
              ${isActive('/super-admin/teachers') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <UserCog className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium">Manage Teachers</span>}
          </Link>

          <Link
            href="/super-admin/students"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-colors
              ${isActive('/super-admin/students') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium">Students</span>}
          </Link>

          <Link
            href="/super-admin/reports"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-colors
              ${isActive('/super-admin/reports') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium">Overall Reports</span>}
          </Link>
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-2 sm:p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-xs sm:text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-1.5 sm:p-2 rounded-lg hover:bg-gray-100"
                >
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                </button>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <div className="hidden sm:flex items-center gap-2 sm:gap-3">
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">{admin?.full_name || 'Super Admin'}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">Super Administrator</p>
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                  </div>
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 hidden md:block">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto py-3 sm:py-4 px-3 sm:px-4 md:px-6 lg:px-8 border-t border-gray-200 bg-white/80">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5">
                <img 
                  src="/logo.png" 
                  alt="St. Anne's Academy" 
                  className="w-full h-full object-contain opacity-75"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className="font-medium text-gray-700 text-xs sm:text-sm">St. Anne's Academy</span>
            </div>
            <p className="text-gray-600 text-[10px] sm:text-xs">EduScan Super Admin Portal • © {new Date().getFullYear()}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}