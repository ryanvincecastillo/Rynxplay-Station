import { Bell, Search, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useState } from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  const { refreshAll, sidebarOpen } = useAppStore()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshAll()
    setTimeout(() => setIsRefreshing(false), 500)
  }
  
  return (
    <header className={`sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4 transition-all ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-100">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              className="input input-sm pl-9 w-64 bg-slate-800/30"
            />
          </div>
          
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="btn-ghost btn-icon"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Notifications */}
          <button className="btn-ghost btn-icon relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rynx-400 rounded-full" />
          </button>
          
          {/* Custom action */}
          {action}
        </div>
      </div>
    </header>
  )
}
