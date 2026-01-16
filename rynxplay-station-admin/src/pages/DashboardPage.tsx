import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Monitor, 
  Users, 
  Timer, 
  Wallet, 
  TrendingUp, 
  Activity,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react'
import { Header, StatCard } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { formatCurrency, formatRelativeTime, formatDuration, getStatusBadge } from '@/lib/utils'

export function DashboardPage() {
  const { stats, devices, activeSessions, pendingDevices, fetchStats, fetchActiveSessions } = useAppStore()
  
  useEffect(() => {
    fetchStats()
    fetchActiveSessions()
    
    // Refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchStats()
      fetchActiveSessions()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div>
      <Header title="Dashboard" subtitle="Welcome back! Here's what's happening." />
      
      <main className="p-6">
        {/* Stats Grid */}
        <div className="grid-stats mb-8">
          <StatCard
            title="Total Devices"
            value={stats?.totalDevices || 0}
            subtitle={`${stats?.activeDevices || 0} active`}
            icon={Monitor}
            color="rynx"
          />
          <StatCard
            title="Active Sessions"
            value={stats?.activeSessions || 0}
            subtitle="Currently running"
            icon={Timer}
            color="emerald"
          />
          <StatCard
            title="Total Members"
            value={stats?.totalMembers || 0}
            subtitle={`${stats?.activeMembers || 0} active`}
            icon={Users}
            color="purple"
          />
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(stats?.todayRevenue || 0)}
            icon={Wallet}
            color="amber"
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Sessions */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-100">Active Sessions</h2>
                  <p className="text-sm text-slate-500">{activeSessions.length} running now</p>
                </div>
              </div>
              <Link to="/sessions" className="btn-ghost text-sm">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            {activeSessions.length > 0 ? (
              <div className="space-y-3">
                {activeSessions.slice(0, 5).map(session => (
                  <div key={session.id} className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">
                        {session.devices?.name || 'Unknown Device'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {session.session_type === 'member' 
                          ? session.members?.username 
                          : 'Guest Session'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-rynx-400">
                        {session.session_type === 'guest' && session.time_remaining_seconds
                          ? formatDuration(session.time_remaining_seconds)
                          : formatDuration(session.total_seconds_used)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {session.session_type === 'guest' ? 'remaining' : 'elapsed'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No active sessions</p>
              </div>
            )}
          </div>
          
          {/* Pending Devices */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-100">Pending Approval</h2>
                  <p className="text-sm text-slate-500">{pendingDevices.length} devices waiting</p>
                </div>
              </div>
              <Link to="/devices" className="btn-ghost text-sm">
                Manage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            
            {pendingDevices.length > 0 ? (
              <div className="space-y-3">
                {pendingDevices.slice(0, 5).map(device => (
                  <div key={device.id} className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">{device.name}</p>
                      <p className="text-sm text-slate-500 font-mono">{device.device_code}</p>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${getStatusBadge('pending')}`}>Pending</span>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatRelativeTime(device.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500">No pending devices</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Device Overview */}
        <div className="card p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rynx-500/10 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-rynx-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-100">Device Overview</h2>
                <p className="text-sm text-slate-500">{devices.length} total devices</p>
              </div>
            </div>
            <Link to="/devices" className="btn-ghost text-sm">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/30 rounded-xl text-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-100">
                {devices.filter(d => d.status === 'online').length}
              </p>
              <p className="text-sm text-slate-500">Online</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-xl text-center">
              <div className="w-3 h-3 rounded-full bg-rynx-400 mx-auto mb-2 animate-pulse" />
              <p className="text-2xl font-bold text-slate-100">
                {devices.filter(d => d.status === 'in_use').length}
              </p>
              <p className="text-sm text-slate-500">In Use</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-xl text-center">
              <div className="w-3 h-3 rounded-full bg-slate-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-slate-100">
                {devices.filter(d => d.status === 'offline').length}
              </p>
              <p className="text-sm text-slate-500">Offline</p>
            </div>
            <div className="p-4 bg-slate-800/30 rounded-xl text-center">
              <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-2 animate-pulse" />
              <p className="text-2xl font-bold text-slate-100">
                {pendingDevices.length}
              </p>
              <p className="text-sm text-slate-500">Pending</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
