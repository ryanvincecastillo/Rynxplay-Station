import { useState, useEffect } from 'react'
import { 
  Timer, 
  Search, 
  RefreshCw,
  Monitor,
  User,
  Clock,
  DollarSign,
  Play,
  Square,
  Pause,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react'
import { Header, Modal, EmptyState } from '@/components'
import { useAppStore } from '@/stores/appStore'
import { endSession } from '@/lib/supabase'
import { formatCurrency, formatDuration, formatRelativeTime, formatDateTime } from '@/lib/utils'
import type { Session, SessionStatus } from '@/types'

const statusConfig: Record<SessionStatus, { label: string; color: string; icon: typeof Play }> = {
  active: { label: 'Active', color: 'emerald', icon: Play },
  paused: { label: 'Paused', color: 'amber', icon: Pause },
  completed: { label: 'Completed', color: 'blue', icon: Square },
  terminated: { label: 'Terminated', color: 'red', icon: Square }
}

export function SessionsPage() {
  const { sessions, activeSessions, devices, members, fetchSessions, fetchActiveSessions, addToast } = useAppStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'guest' | 'member'>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const itemsPerPage = 15
  
  useEffect(() => {
    fetchSessions()
    fetchActiveSessions()
    
    // Refresh active sessions every 30 seconds
    const interval = setInterval(() => {
      fetchActiveSessions()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchSessions, fetchActiveSessions])
  
  // Get device and member info
  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId)
    return device?.name || 'Unknown Device'
  }
  
  const getMemberName = (memberId: string | null) => {
    if (!memberId) return 'Guest'
    const member = members.find(m => m.id === memberId)
    return member?.username || member?.full_name || 'Unknown Member'
  }
  
  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const deviceName = getDeviceName(session.device_id).toLowerCase()
    const memberName = getMemberName(session.member_id).toLowerCase()
    
    const matchesSearch = 
      deviceName.includes(searchQuery.toLowerCase()) ||
      memberName.includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter
    const matchesType = typeFilter === 'all' || session.session_type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })
  
  // Paginated sessions
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage)
  const paginatedSessions = filteredSessions.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  
  // Stats
  const activeCount = sessions.filter(s => s.status === 'active').length
  const todayRevenue = sessions
    .filter(s => new Date(s.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + s.total_amount, 0)
  const avgDuration = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.total_seconds_used, 0) / sessions.length 
    : 0
  
  const handleRefresh = async () => {
    setIsLoading(true)
    await Promise.all([fetchSessions(), fetchActiveSessions()])
    setIsLoading(false)
  }
  
  const handleEndSession = async () => {
    if (!selectedSession) return
    
    setIsLoading(true)
    const success = await endSession(selectedSession.id, selectedSession.total_seconds_used, selectedSession.total_amount)
    
    if (success) {
      addToast({ type: 'success', message: 'Session ended successfully' })
      setShowEndSessionModal(false)
      setSelectedSession(null)
      fetchSessions()
      fetchActiveSessions()
    } else {
      addToast({ type: 'error', message: 'Failed to end session' })
    }
    setIsLoading(false)
  }
  
  const openDetailsModal = (session: Session) => {
    setSelectedSession(session)
    setShowDetailsModal(true)
  }
  
  const openEndSessionModal = (session: Session) => {
    setSelectedSession(session)
    setShowEndSessionModal(true)
  }
  
  return (
    <div className="p-6">
      <Header 
        title="Sessions"
        subtitle={`${activeSessions.length} active sessions`}
        action={
          <button
            onClick={handleRefresh}
            className="btn-secondary"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Active Sessions</p>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Sessions</p>
              <p className="text-2xl font-bold text-white">{sessions.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rynx-500/20 flex items-center justify-center">
              <Timer className="w-5 h-5 text-rynx-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Today's Revenue</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        </div>
        
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg. Duration</p>
              <p className="text-2xl font-bold text-white">{formatDuration(Math.round(avgDuration))}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Active Sessions Panel */}
      {activeSessions.length > 0 && (
        <div className="card p-4 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Active Sessions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.slice(0, 6).map((session) => (
              <div
                key={session.id}
                className="p-4 bg-gradient-to-br from-emerald-500/5 to-green-500/5 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{getDeviceName(session.device_id)}</p>
                      <p className="text-sm text-slate-400">{getMemberName(session.member_id)}</p>
                    </div>
                  </div>
                  <span className="badge badge-success text-xs">
                    {session.session_type}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="text-lg font-mono text-white">{formatDuration(session.total_seconds_used)}</p>
                  </div>
                  {session.session_type === 'guest' && session.time_remaining_seconds !== null && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Remaining</p>
                      <p className={`text-lg font-mono ${session.time_remaining_seconds < 300 ? 'text-red-400' : 'text-amber-400'}`}>
                        {formatDuration(session.time_remaining_seconds)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => openEndSessionModal(session)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="End Session"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Search by device or member..."
            className="input pl-10"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as 'all' | SessionStatus); setPage(1) }}
          className="select min-w-[140px]"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
        </select>
        
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as 'all' | 'guest' | 'member'); setPage(1) }}
          className="select min-w-[140px]"
        >
          <option value="all">All Types</option>
          <option value="guest">Guest</option>
          <option value="member">Member</option>
        </select>
        
        <button className="btn-secondary">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
      
      {/* Sessions Table */}
      {paginatedSessions.length > 0 ? (
        <>
          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.map((session) => {
                    const config = statusConfig[session.status]
                    const StatusIcon = config.icon
                    
                    return (
                      <tr key={session.id} className="hover:bg-slate-800/50">
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              session.status === 'active' ? 'bg-emerald-500/20' : 'bg-slate-700'
                            }`}>
                              <Monitor className={`w-4 h-4 ${
                                session.status === 'active' ? 'text-emerald-400' : 'text-slate-400'
                              }`} />
                            </div>
                            <span className="font-medium text-white">
                              {getDeviceName(session.device_id)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300">{getMemberName(session.member_id)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${session.session_type === 'member' ? 'badge-info' : 'badge-default'}`}>
                            {session.session_type}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-white">
                            {formatDuration(session.total_seconds_used)}
                          </span>
                        </td>
                        <td>
                          <span className="text-amber-400 font-medium">
                            {formatCurrency(session.total_amount)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${config.color} flex items-center gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-slate-400">
                            {formatRelativeTime(session.started_at)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDetailsModal(session)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Timer className="w-4 h-4" />
                            </button>
                            {session.status === 'active' && (
                              <button
                                onClick={() => openEndSessionModal(session)}
                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="End Session"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredSessions.length)} of {filteredSessions.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Timer}
          title="No sessions found"
          description={searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
            ? 'Try adjusting your search or filters' 
            : 'Sessions will appear here once devices start being used'
          }
        />
      )}
      
      {/* Session Details Modal */}
      <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Session Details" size="md">
        {selectedSession && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl ${
              selectedSession.status === 'active' 
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : selectedSession.status === 'completed'
                ? 'bg-blue-500/10 border border-blue-500/20'
                : 'bg-slate-800/50 border border-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = statusConfig[selectedSession.status]
                    const StatusIcon = config.icon
                    return (
                      <>
                        <StatusIcon className={`w-5 h-5 text-${config.color}-400`} />
                        <span className="font-medium text-white capitalize">{config.label}</span>
                      </>
                    )
                  })()}
                </div>
                <span className="text-sm text-slate-400">
                  {selectedSession.session_type === 'guest' ? 'Guest Session' : 'Member Session'}
                </span>
              </div>
            </div>
            
            {/* Device & User */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Monitor className="w-4 h-4" />
                  <span className="text-sm">Device</span>
                </div>
                <p className="font-medium text-white">{getDeviceName(selectedSession.device_id)}</p>
              </div>
              
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">User</span>
                </div>
                <p className="font-medium text-white">{getMemberName(selectedSession.member_id)}</p>
              </div>
            </div>
            
            {/* Time Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-sm text-slate-400 mb-1">Duration</p>
                <p className="text-2xl font-mono font-bold text-white">
                  {formatDuration(selectedSession.total_seconds_used)}
                </p>
              </div>
              
              {selectedSession.session_type === 'guest' && selectedSession.time_remaining_seconds !== null && (
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-sm text-slate-400 mb-1">Time Remaining</p>
                  <p className={`text-2xl font-mono font-bold ${
                    selectedSession.time_remaining_seconds < 300 ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {formatDuration(selectedSession.time_remaining_seconds)}
                  </p>
                </div>
              )}
            </div>
            
            {/* Financial */}
            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-sm text-slate-400 mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-amber-400">{formatCurrency(selectedSession.total_amount)}</p>
            </div>
            
            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Started</p>
                <p className="text-slate-300">{formatDateTime(selectedSession.started_at)}</p>
              </div>
              {selectedSession.ended_at && (
                <div>
                  <p className="text-slate-500 mb-1">Ended</p>
                  <p className="text-slate-300">{formatDateTime(selectedSession.ended_at)}</p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            {selectedSession.status === 'active' && (
              <button
                onClick={() => { setShowDetailsModal(false); openEndSessionModal(selectedSession) }}
                className="btn-primary w-full bg-red-500 hover:bg-red-600"
              >
                <Square className="w-4 h-4" />
                <span>End Session</span>
              </button>
            )}
          </div>
        )}
      </Modal>
      
      {/* End Session Confirmation Modal */}
      <Modal isOpen={showEndSessionModal} onClose={() => setShowEndSessionModal(false)} title="End Session" size="sm">
        {selectedSession && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
              <Square className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">End this session?</p>
              <p className="text-sm text-slate-400">
                This will lock the device and end the session for {getMemberName(selectedSession.member_id)} on {getDeviceName(selectedSession.device_id)}.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setShowEndSessionModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button 
                onClick={handleEndSession}
                disabled={isLoading}
                className="btn-primary flex-1 bg-red-500 hover:bg-red-600"
              >
                {isLoading ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
