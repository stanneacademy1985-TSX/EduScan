'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { clearAdminSessions, fetchAdminById, getStoredAdminSession, storeAdminSession } from '../../../lib/admin-auth'
import { 
  LayoutDashboard,
  Users,
  CalendarDays,
  Scan,
  FileText,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react'
import Link from 'next/link'

interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  name?: string
  assigned_grade?: string | null
  assigned_section?: string | null
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Don't check auth on login page
        if (pathname === '/admin/login') {
          setAuthChecking(false)
          return
        }

        // Check for admin session in sessionStorage (tab-specific)
        const adminData = getStoredAdminSession()
        
        if (!adminData) {
          clearAdminSessions()
          router.replace('/admin/login')
          return
        }

        const freshAdmin = adminData.id ? await fetchAdminById(adminData.id) : null
        if (!freshAdmin) {
          clearAdminSessions()
          router.replace('/admin/login')
          return
        }

        if (freshAdmin.role === 'super_admin') {
          storeAdminSession(freshAdmin)
          localStorage.setItem('admin', JSON.stringify(freshAdmin))
          router.replace('/super-admin/dashboard')
          return
        }

        if (freshAdmin.role !== 'admin' && freshAdmin.role !== 'teacher') {
          clearAdminSessions()
          router.replace('/admin/login')
          return
        }

        setAdmin(freshAdmin)
        storeAdminSession(freshAdmin)
        localStorage.setItem('admin', JSON.stringify(freshAdmin))
        setAuthChecking(false)
      } catch (error) {
        console.error('Auth check error:', error)
        clearAdminSessions()
        router.replace('/admin/login')
      }
    }
    
    checkAuth()
  }, [router, pathname])

  const handleLogout = () => {
    clearAdminSessions()
    router.replace('/admin/login')
  }

  // Helper function to get admin display name
  const getAdminDisplayName = () => {
    if (!admin) return 'Admin';
    // Try different possible field names
    return admin.full_name || admin.name || admin.email?.split('@')[0] || 'Admin';
  }

  const renderProfilePhoto = () => {
    // Since we don't have profile photos for admins, just show the icon
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center border-2 border-white shadow-md">
        <User className="w-5 h-5 text-indigo-600" />
      </div>
    )
  }

  const isActive = (path: string) => {
    if (path === '/admin/dashboard' && pathname === '/admin/dashboard') return true
    if (path === '/admin/students' && pathname === '/admin/students') return true
    if (path === '/admin/attendance/sessions' && pathname === '/admin/attendance/sessions') return true
    if (path === '/admin/attendance/scanner' && pathname === '/admin/attendance/scanner') return true
    if (path === '/admin/attendance/reports' && pathname === '/admin/attendance/reports') return true
    if (path === '/admin/attendance/unregistered' && pathname === '/admin/attendance/unregistered') return true
    return false
  }

  // Don't show sidebar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-20 h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-600 text-lg animate-pulse">Loading...</p>
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
          bg-white border-r border-gray-200 shadow-lg flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-72 lg:w-20' : 'w-72 lg:w-64'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center px-4 border-b border-gray-200 relative">
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2 flex-1">
                <div className="w-12 h-12 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="St. Anne's Academy" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-white font-bold text-lg bg-gradient-to-br from-indigo-600 to-purple-800 w-12 h-12 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-gray-900 truncate">Admin Portal</h2>
                  <p className="text-xs text-gray-500 truncate">St. Anne's Academy</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(true)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </>
          ) : (
            <>
              <div className="w-full flex justify-center">
                <div className="w-12 h-12 relative flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="SAA" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<span class="text-white font-bold text-lg bg-gradient-to-br from-indigo-600 to-purple-800 w-12 h-12 rounded-xl flex items-center justify-center">SAA</span>';
                    }}
                  />
                </div>
              </div>
              <button 
                onClick={() => setSidebarCollapsed(false)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10"
              >
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Admin Profile Summary */}
        {!sidebarCollapsed ? (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {renderProfilePhoto()}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{getAdminDisplayName()}</p>
                <p className="text-xs text-gray-500 truncate">{admin?.role || 'Administrator'}</p>
                <p className="text-xs font-mono text-gray-400 mt-0.5 truncate">{admin?.email}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-gray-200 flex justify-center">
            <div className="relative">
              {renderProfilePhoto()}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto pb-20 lg:pb-4">
          <Link
            href="/admin/dashboard"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/dashboard') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Dashboard</span>}
          </Link>

          <Link
            href="/admin/students"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/students') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Students</span>}
          </Link>

          <Link
            href="/admin/attendance/unregistered"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/attendance/unregistered') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Unregistered</span>}
          </Link>

          <Link
            href="/admin/attendance/sessions"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/attendance/sessions') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <CalendarDays className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Sessions</span>}
          </Link>

          <Link
            href="/admin/attendance/scanner"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/attendance/scanner') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <Scan className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">QR Scanner</span>}
          </Link>

          <Link
            href="/admin/attendance/reports"
            onClick={() => setMobileSidebarOpen(false)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer
              ${isActive('/admin/attendance/reports') 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Reports</span>}
          </Link>

          
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-3 border-t border-gray-200 bg-white">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm font-medium truncate">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Menu className="w-6 h-6 text-gray-600" />
                </button>
                <h1 className="text-lg sm:text-xl font-bold text-gray-800 lg:hidden">
                  {pathname === '/admin/dashboard' && 'Dashboard'}
                  {pathname === '/admin/students' && 'Students'}
                  {pathname === '/admin/attendance/sessions' && 'Sessions'}
                  {pathname === '/admin/attendance/scanner' && 'QR Scanner'}
                  {pathname === '/admin/attendance/reports' && 'Reports'}
                  {pathname === '/admin/attendance/unregistered' && 'Unregistered'}
                </h1>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{getAdminDisplayName()}</p>
                    <p className="text-xs text-gray-500">{admin?.role || 'Administrator'}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 hidden lg:block">
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
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 min-h-0">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto py-4 px-4 sm:px-6 lg:px-8 border-t border-gray-200 bg-white relative z-10 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5">
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
              <span className="font-medium text-gray-700">St. Anne's Academy</span>
            </div>
            <p className="text-gray-600">EduScan QR Attendance System • Admin Portal • © {new Date().getFullYear()}</p>
            <p className="text-gray-500">{getAdminDisplayName()} • {admin?.role || 'Administrator'}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
