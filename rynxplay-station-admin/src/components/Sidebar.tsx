import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import {
  LayoutDashboard,
  Monitor,
  Users,
  Timer,
  Receipt,
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  Bell,
  Play
} from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/devices', icon: Monitor, label: 'Devices' },
  { path: '/members', icon: Users, label: 'Members' },
  { path: '/sessions', icon: Timer, label: 'Sessions' },
  { path: '/transactions', icon: Receipt, label: 'Transactions' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarOpen, toggleSidebar, organization, staff, signOut, stats } = useAppStore()
  
  return (
    <aside 
      className={`fixed left-0 top-0 h-screen bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/50 transition-all duration-300 z-40 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rynx-400 to-rynx-600 flex items-center justify-center shadow-lg shadow-rynx-500/25">
              <Play className="w-5 h-5 text-slate-900" fill="currentColor" />
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in">
                <h1 className="font-display font-bold text-slate-100">RYNXPLAY</h1>
                <p className="text-xs text-slate-500">Admin Panel</p>
              </div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className={`w-5 h-5 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Organization info */}
      {sidebarOpen && organization && (
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-rynx-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-rynx-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{organization.name}</p>
              <p className="text-xs text-slate-500 capitalize">{staff?.role}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path
          const Icon = item.icon
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
              
              {/* Badge for pending devices */}
              {item.path === '/devices' && stats?.pendingDevices && stats.pendingDevices > 0 && (
                <span className={`ml-auto bg-amber-500/20 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full ${!sidebarOpen ? 'absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0' : ''}`}>
                  {stats.pendingDevices}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
      
      {/* User section */}
      <div className="p-4 border-t border-slate-800/50">
        {sidebarOpen ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300">
                {staff?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{staff?.name}</p>
                <p className="text-xs text-slate-500 truncate">{staff?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center p-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  )
}
