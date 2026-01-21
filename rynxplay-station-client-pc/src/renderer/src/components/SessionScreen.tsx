import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const session = useAppStore(s => s.session)
  const member = useAppStore(s => s.member)
  const device = useAppStore(s => s.device)
  const storeTimeRemaining = useAppStore(s => s.timeRemaining)
  const storeTotalUsed = useAppStore(s => s.totalSecondsUsed)
  const endCurrentSession = useAppStore(s => s.endCurrentSession)

  const [minimized, setMinimized] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0)
  const [timeUsed, setTimeUsed] = useState(0)
  const timerIdRef = useRef<number | null>(null)
  const initializedRef = useRef(false)

  // Session info
  const isGuest = session?.session_type === 'guest'
  const isActive = session?.status === 'active'

  // Combined initialization and timer effect
  useEffect(() => {
    // Clear any existing timer
    if (timerIdRef.current) {
      window.clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }

    // Don't do anything if no active session
    if (!session || !isActive) {
      initializedRef.current = false
      return
    }

    // Get the best available time value
    let initialTime = 0
    if (session.time_remaining_seconds && session.time_remaining_seconds > 0) {
      initialTime = session.time_remaining_seconds
    } else if (storeTimeRemaining && storeTimeRemaining > 0) {
      initialTime = storeTimeRemaining
    }
    
    const initialUsed = session.total_seconds_used || storeTotalUsed || 0

    console.log('⏱️ Timer init:', initialTime, 'seconds')

    // Set initial values
    setTimeLeft(initialTime)
    setTimeUsed(initialUsed)
    initializedRef.current = true

    // Don't start timer if guest session has no time
    if (isGuest && initialTime <= 0) {
      console.log('⚠️ No time for guest session')
      return
    }

    console.log('✅ Timer started')

    // Start the timer
    timerIdRef.current = window.setInterval(() => {
      setTimeUsed(prev => prev + 1)

      if (isGuest) {
        setTimeLeft(prev => {
          const newVal = prev - 1
          if (newVal <= 0) {
            console.log('⏱️ Time up!')
            endCurrentSession()
            return 0
          }
          return newVal
        })
      }
    }, 1000)

    return () => {
      if (timerIdRef.current) {
        window.clearInterval(timerIdRef.current)
        timerIdRef.current = null
      }
    }
  }, [session?.id, isActive, isGuest, storeTimeRemaining, storeTotalUsed, endCurrentSession])

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

  // Theme colors based on session type and warning
  const getBg = () => {
    if (warning === 'critical') return 'from-red-600 to-rose-700'
    if (warning === 'warning') return 'from-amber-500 to-orange-600'
    return isGuest ? 'from-blue-600 to-cyan-600' : 'from-emerald-600 to-teal-600'
  }

  // ===== MINIMIZED VIEW =====
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className={`fixed top-3 right-3 z-50 bg-gradient-to-r ${getBg()} px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 hover:scale-105 transition-transform`}
      >
        <span className={`w-2 h-2 rounded-full bg-white ${warning === 'critical' ? 'animate-ping' : ''}`} />
        <span className="font-mono font-bold text-white">
          {isGuest ? formatTime(timeLeft) : `₱${(member?.credits || 0).toFixed(2)}`}
        </span>
        <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    )
  }

  // ===== FULL VIEW - COMPACT =====
  return (
    <>
      <div className={`fixed top-3 right-3 z-50 w-64 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br ${getBg()}`}>
        {/* Header Row */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              {isGuest ? (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-none">{device?.name || 'Station'}</p>
              <p className="text-white/60 text-xs">{isGuest ? 'Guest' : member?.username || 'Member'}</p>
            </div>
          </div>
          <button onClick={() => setMinimized(true)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
        </div>

        {/* Main Display */}
        <div className="px-3 pb-2 text-center">
          {isGuest ? (
            <>
              <p className="text-white/60 text-[10px] uppercase tracking-wider">Time Remaining</p>
              <p className={`text-4xl font-bold font-mono text-white ${warning === 'critical' ? 'animate-pulse' : ''}`}>
                {formatTime(timeLeft)}
              </p>
            </>
          ) : (
            <>
              <p className="text-white/60 text-[10px] uppercase tracking-wider">Credits</p>
              <p className={`text-4xl font-bold text-white ${warning === 'critical' ? 'animate-pulse' : ''}`}>
                ₱{(member?.credits || 0).toFixed(2)}
              </p>
            </>
          )}
        </div>

        {/* Stats Row */}
        <div className="px-3 pb-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
              <p className="text-white/50 text-[9px] uppercase">Elapsed</p>
              <p className="text-white text-xs font-mono">{formatTime(timeUsed)}</p>
            </div>
            <div className="flex-1 bg-black/20 rounded-lg p-2 text-center">
              <p className="text-white/50 text-[9px] uppercase">Rate</p>
              <p className="text-white text-xs">
                {session?.rates ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}m` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Warning */}
        {warning !== 'normal' && (
          <div className="px-3 pb-3">
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="text-white text-xs font-medium">
                {isGuest
                  ? (warning === 'critical' ? '⚠️ Less than 1 min!' : '⏰ Less than 5 min')
                  : (warning === 'critical' ? '⚠️ Low credits!' : '💰 Running low')}
              </p>
            </div>
          </div>
        )}

        {/* End Button */}
        <div className="p-3 pt-0">
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full bg-black/30 hover:bg-black/40 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Session
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 rounded-2xl p-5 w-72 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">End Session?</h3>
              <p className="text-gray-400 text-sm">PC will be locked.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); endCurrentSession() }}
                className="bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl transition"
              >
                End
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}