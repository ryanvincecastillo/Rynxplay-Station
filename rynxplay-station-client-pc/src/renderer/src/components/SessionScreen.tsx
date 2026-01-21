import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const session = useAppStore(s => s.session)
  const member = useAppStore(s => s.member)
  const device = useAppStore(s => s.device)
  const storeTimeRemaining = useAppStore(s => s.timeRemaining)
  const endCurrentSession = useAppStore(s => s.endCurrentSession)

  const [showConfirm, setShowConfirm] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  
  // Timer state - LOCAL to this component
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeUsed, setTimeUsed] = useState(0)
  const [timerStarted, setTimerStarted] = useState(false)

  const isGuest = session?.session_type === 'guest'

  // Initialize timer ONCE when component mounts or session changes
  useEffect(() => {
    if (!session) return

    // Get initial time from session or store
    const initialTime = session.time_remaining_seconds || storeTimeRemaining || 0
    const initialUsed = session.total_seconds_used || 0

    console.log('🎮 Session loaded - initialTime:', initialTime)
    
    setTimeLeft(initialTime)
    setTimeUsed(initialUsed)
    setTimerStarted(true)
  }, [session?.id])

  // THE TIMER - runs when timerStarted is true
  useEffect(() => {
    if (!timerStarted || !session) return

    console.log('⏱️ Starting interval timer')

    const intervalId = setInterval(() => {
      // Increment elapsed time
      setTimeUsed(prev => prev + 1)

      // For guest sessions, decrement remaining time
      if (isGuest) {
        setTimeLeft(prev => {
          const newTime = prev - 1
          
          // Update floating timer
          if (window.api?.updateFloatingTimer) {
            window.api.updateFloatingTimer(Math.max(0, newTime), 'guest')
          }

          // Time's up
          if (newTime <= 0) {
            console.log('⏱️ Time is up!')
            endCurrentSession()
            return 0
          }

          return newTime
        })
      } else {
        // Member session - update floating timer with elapsed
        setTimeUsed(prev => {
          if (window.api?.updateFloatingTimer) {
            window.api.updateFloatingTimer(prev, 'member')
          }
          return prev
        })
      }
    }, 1000)

    return () => {
      console.log('⏱️ Clearing interval')
      clearInterval(intervalId)
    }
  }, [timerStarted, session?.id, isGuest, endCurrentSession])

  // Format time
  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Warning level
  const getWarning = () => {
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

  // If panel is hidden, show minimal floating button
  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className={`fixed bottom-20 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 transition-all hover:scale-105 ${
          warning === 'critical' 
            ? 'bg-gradient-to-r from-red-500 to-rose-600' 
            : warning === 'warning'
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : isGuest 
            ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
        }`}
      >
        <div className={`w-3 h-3 rounded-full bg-white ${warning === 'critical' ? 'animate-pulse' : ''}`} />
        <span className="text-white font-mono font-bold text-xl">
          {isGuest ? formatTime(timeLeft) : `₱${(member?.credits || 0).toFixed(2)}`}
        </span>
        <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    )
  }

  // Full panel view - positioned to not cover taskbar
  return (
    <>
      {/* Semi-transparent overlay - click to minimize */}
      <div 
        className="fixed inset-0 z-40"
        style={{ bottom: '48px' }} // Leave space for taskbar
        onClick={() => setShowPanel(false)}
      />

      {/* Main Session Panel */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        style={{ bottom: '48px' }} // Leave space for taskbar
      >
        <div className={`w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl ${
          warning === 'critical' 
            ? 'bg-gradient-to-br from-red-900/95 to-rose-900/95 border border-red-500/50' 
            : warning === 'warning'
            ? 'bg-gradient-to-br from-amber-900/95 to-orange-900/95 border border-amber-500/50'
            : 'bg-gradient-to-br from-slate-900/95 to-slate-800/95 border border-slate-700/50'
        }`}>
          
          {/* Header */}
          <div className={`p-6 ${
            warning === 'critical' 
              ? 'bg-red-500/20' 
              : warning === 'warning'
              ? 'bg-amber-500/20'
              : isGuest ? 'bg-cyan-500/10' : 'bg-emerald-500/10'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  isGuest 
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600' 
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                }`}>
                  {isGuest ? (
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{device?.name || 'PC Station'}</h1>
                  <p className={`text-sm ${isGuest ? 'text-cyan-300' : 'text-emerald-300'}`}>
                    {isGuest ? 'Guest Session' : `${member?.username || 'Member'}`}
                  </p>
                </div>
              </div>
              
              {/* Minimize button */}
              <button
                onClick={() => setShowPanel(false)}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-8">
            {/* Big Timer / Credits Display */}
            <div className="text-center mb-8">
              {isGuest ? (
                <>
                  <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Time Remaining</p>
                  <p className={`text-7xl font-bold font-mono tracking-tight ${
                    warning === 'critical' 
                      ? 'text-red-400 animate-pulse' 
                      : warning === 'warning' 
                      ? 'text-amber-400' 
                      : 'text-white'
                  }`}>
                    {formatTime(timeLeft)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Credits Balance</p>
                  <p className={`text-7xl font-bold ${
                    warning === 'critical' 
                      ? 'text-red-400 animate-pulse' 
                      : warning === 'warning' 
                      ? 'text-amber-400' 
                      : 'text-emerald-400'
                  }`}>
                    ₱{(member?.credits || 0).toFixed(2)}
                  </p>
                  {member?.full_name && (
                    <p className="text-slate-400 mt-2">{member.full_name}</p>
                  )}
                </>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-800/50 rounded-2xl p-5 text-center">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Session Time</p>
                <p className="text-white text-2xl font-mono">{formatTime(timeUsed)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-5 text-center">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Rate</p>
                <p className="text-white text-2xl">
                  {session?.rates 
                    ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}min` 
                    : '—'}
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            {warning !== 'normal' && (
              <div className={`rounded-2xl p-4 mb-6 text-center ${
                warning === 'critical' 
                  ? 'bg-red-500/20 border border-red-500/50' 
                  : 'bg-amber-500/20 border border-amber-500/50'
              }`}>
                <p className={`text-lg font-semibold ${
                  warning === 'critical' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {isGuest
                    ? warning === 'critical' 
                      ? '⚠️ Less than 1 minute remaining!' 
                      : '⏰ Less than 5 minutes remaining'
                    : warning === 'critical' 
                      ? '⚠️ Low credits! Please top up.' 
                      : '💰 Credits running low'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowPanel(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-2xl transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Minimize
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-4 rounded-2xl transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                End Session
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6">
            <p className="text-center text-slate-500 text-sm">
              Click outside or press Minimize to continue using the PC
            </p>
          </div>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">End Session?</h2>
              <p className="text-slate-400 text-lg">
                The computer will be locked after ending your session.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-2xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  endCurrentSession()
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold py-4 rounded-2xl transition"
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