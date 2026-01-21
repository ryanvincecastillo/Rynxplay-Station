import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const session = useAppStore(s => s.session)
  const member = useAppStore(s => s.member)
  const device = useAppStore(s => s.device)
  const endCurrentSession = useAppStore(s => s.endCurrentSession)

  const [minimized, setMinimized] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeUsed, setTimeUsed] = useState(0)
  const timerIdRef = useRef<number | null>(null)

  // Session info
  const isGuest = session?.session_type === 'guest'
  const isActive = session?.status === 'active'

  // Initialize timer when session loads
  useEffect(() => {
    if (session) {
      setTimeLeft(session.time_remaining_seconds || 0)
      setTimeUsed(session.total_seconds_used || 0)
      console.log('📋 Timer initialized:', session.time_remaining_seconds, 'seconds')
    }
  }, [session?.id])

  // Main timer loop
  useEffect(() => {
    // Clear any existing timer
    if (timerIdRef.current) {
      window.clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }

    // Only run if session is active
    if (!isActive) {
      console.log('⏱️ Timer not running - session not active')
      return
    }

    console.log('⏱️ Timer STARTED')

    timerIdRef.current = window.setInterval(() => {
      // Always increment time used
      setTimeUsed(prev => prev + 1)

      // For guest sessions, decrement time left
      if (isGuest) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            console.log('⏱️ TIME UP!')
            endCurrentSession()
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (timerIdRef.current) {
        console.log('⏱️ Timer STOPPED')
        window.clearInterval(timerIdRef.current)
        timerIdRef.current = null
      }
    }
  }, [isActive, isGuest, endCurrentSession])

  // Sync with floating timer
  useEffect(() => {
    if (window.api?.updateFloatingTimer) {
      window.api.updateFloatingTimer(isGuest ? timeLeft : timeUsed, isGuest ? 'guest' : 'member')
    }
  }, [timeLeft, timeUsed, isGuest])

  // Format time as HH:MM:SS
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Get warning level
  const getWarning = (): 'normal' | 'warning' | 'critical' => {
    if (isGuest) {
      if (timeLeft <= 60) return 'critical'
      if (timeLeft <= 300) return 'warning'
    } else if (member) {
      if (member.credits <= 5) return 'critical'
      if (member.credits <= 20) return 'warning'
    }
    return 'normal'
  }

  const warning = getWarning()

  // Theme colors
  const theme = {
    critical: { gradient: 'from-red-500 to-rose-600', text: 'text-white', muted: 'text-red-100' },
    warning: { gradient: 'from-amber-500 to-orange-600', text: 'text-white', muted: 'text-amber-100' },
    normal: isGuest 
      ? { gradient: 'from-blue-500 to-cyan-600', text: 'text-white', muted: 'text-blue-100' }
      : { gradient: 'from-emerald-500 to-teal-600', text: 'text-white', muted: 'text-emerald-100' }
  }
  
  const t = theme[warning]

  // ===== MINIMIZED VIEW =====
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed top-4 right-4 z-50 bg-gradient-to-r ${t.gradient} px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform`}
      >
        <span className={`w-2 h-2 rounded-full bg-white ${warning === 'critical' ? 'animate-ping' : ''}`} />
        <span className={`font-mono font-bold text-lg ${t.text}`}>
          {isGuest ? formatTime(timeLeft) : `₱${(member?.credits || 0).toFixed(2)}`}
        </span>
        <svg className={`w-4 h-4 ${t.muted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    )
  }

  // ===== FULL VIEW =====
  return (
    <>
      <div className="fixed top-4 right-4 z-50 w-72">
        {/* Main Card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className={`bg-gradient-to-br ${t.gradient} p-5`}>
            {/* Top Row */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                  {isGuest ? (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-semibold ${t.text}`}>{device?.name || 'Station'}</p>
                  <p className={`text-xs ${t.muted}`}>
                    {isGuest ? 'Guest Session' : member?.username || 'Member'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white/30 transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                </svg>
              </button>
            </div>

            {/* Big Timer / Credits Display */}
            <div className="text-center py-2">
              {isGuest ? (
                <>
                  <p className={`text-xs uppercase tracking-widest ${t.muted} mb-1`}>Time Remaining</p>
                  <p className={`text-5xl font-bold font-mono tracking-tight ${t.text} ${warning === 'critical' ? 'animate-pulse' : ''}`}>
                    {formatTime(timeLeft)}
                  </p>
                </>
              ) : (
                <>
                  <p className={`text-xs uppercase tracking-widest ${t.muted} mb-1`}>Credits</p>
                  <p className={`text-5xl font-bold ${t.text} ${warning === 'critical' ? 'animate-pulse' : ''}`}>
                    ₱{(member?.credits || 0).toFixed(2)}
                  </p>
                  {member?.full_name && (
                    <p className={`text-sm ${t.muted} mt-1`}>{member.full_name}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stats & Actions */}
          <div className="bg-gray-900 p-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-gray-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">
                  {isGuest ? 'Elapsed' : 'Session'}
                </p>
                <p className="text-white font-mono text-sm">{formatTime(timeUsed)}</p>
              </div>
              <div className="bg-gray-800/80 rounded-2xl p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Rate</p>
                <p className="text-white text-sm">
                  {session?.rates 
                    ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}m` 
                    : '—'}
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            {warning !== 'normal' && (
              <div className={`mb-4 p-3 rounded-2xl text-center ${
                warning === 'critical' 
                  ? 'bg-red-500/20 border border-red-500/40' 
                  : 'bg-amber-500/20 border border-amber-500/40'
              }`}>
                <p className={`text-sm font-medium ${warning === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                  {isGuest
                    ? warning === 'critical' ? '⚠️ Session ending soon!' : '⏰ Less than 5 min left'
                    : warning === 'critical' ? '⚠️ Low credits!' : '💰 Credits running low'}
                </p>
              </div>
            )}

            {/* End Session Button */}
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white font-medium py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">End Session?</h2>
              <p className="text-gray-400">The computer will be locked.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-3.5 rounded-2xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  endCurrentSession()
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-medium py-3.5 rounded-2xl transition-colors"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}