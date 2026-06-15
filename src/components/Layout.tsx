import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2,
  LayoutDashboard,
  LogIn,
  LogOut,
  AlertTriangle,
  BarChart3,
  FileText,
  Menu,
  X,
  ChevronRight,
  User,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useMemo } from 'react'

const navItems = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard },
  { to: '/checkin', label: '入住管理', icon: LogIn },
  { to: '/checkout', label: '退宿管理', icon: LogOut },
  { to: '/dormitory', label: '宿舍管理', icon: Building2 },
  { to: '/warning', label: '预警中心', icon: AlertTriangle },
  { to: '/report', label: '统计报表', icon: BarChart3 },
  { to: '/log', label: '操作日志', icon: FileText },
]

const breadcrumbMap: Record<string, string> = {
  '/': '仪表盘',
  '/checkin': '入住管理',
  '/checkout': '退宿管理',
  '/dormitory': '宿舍管理',
  '/warning': '预警中心',
  '/report': '统计报表',
  '/log': '操作日志',
}

function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  const crumbs = useMemo(() => {
    if (segments.length === 0) return [{ label: '仪表盘', path: '/' }]
    const result: { label: string; path: string }[] = [{ label: '首页', path: '/' }]
    let current = ''
    for (const seg of segments) {
      current += `/${seg}`
      result.push({
        label: breadcrumbMap[current] || seg,
        path: current,
      })
    }
    return result
  }, [segments])

  return (
    <nav className="flex items-center text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center">
          {i > 0 && <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />}
          <span
            className={
              i === crumbs.length - 1
                ? 'text-[#1E3A5F] font-medium'
                : 'text-gray-500'
            }
          >
            {crumb.label}
          </span>
        </span>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F4F8]">
      {sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#1E3A5F] text-white flex flex-col transform transition-transform duration-300 ${
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center px-6 gap-3 border-b border-white/10">
          <Building2 className="w-7 h-7 text-emerald-400 flex-shrink-0" />
          <span className="text-lg font-semibold tracking-wide whitespace-nowrap">
            宿舍管理系统
          </span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                if (sidebarCollapsed) toggleSidebar()
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <span>管理员</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? (
                <Menu className="w-5 h-5 text-gray-600" />
              ) : (
                <X className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
