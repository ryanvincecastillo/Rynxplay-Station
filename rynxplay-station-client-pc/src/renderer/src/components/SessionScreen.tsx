import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const { 
    session, 
    member, 
    device,
    endCurrentSession
  } = useAppStore()
  
  const [isMinimized, setIsMinimized] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  
  // LOCAL timer state - component manages its own countdown
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  // Ref to track if timer is running
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize timer when session loads or changes
  useEffect(() => {
    if (session && session.status === 'active') {
      const initialTime = session.time_remaining_seconds || 0
      const initialElapsed = session.total_seconds_used || 0
      
      console.log('📋 Initializing session timer:', {
        type: session.session_type,
        timeRemaining: initialTime,
        elapsed: initialElapsed
      })
      
      setTimeRemaining(initialTime)
      setElapsedTime(initialElapsed)
    }
  }, [session?.id])

  // THE TIMER - Simple and bulletproof
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Only run if session is active
    if (!session || session.status !== 'active') {
      console.log('⏱️ Timer not started - no active session')
      return
    }

    console.log('⏱️ Starting timer...')

    timerRef.current = setInterval(() => {
      // Increment elapsed time
      setElapsedTime(prev => {
        const newElapsed = prev + 1
        
        // Sync to store every 10 seconds
        if (newElapsed % 10 === 0) {
          useAppStore.setState({ totalSecondsUsed: newElapsed })
          console.log(`⏱️ Elapsed: ${newElapsed}s`)
        }
        
        return newElapsed
      })

      // For GUEST sessions: countdown
      if (session.session_type === 'guest') {
        setTimeRemaining(prev => {
          const newTime = prev - 1
          
          // Update floating timer
          window.api?.updateFloatingTimer?.(Math.max(0, newTime), 'guest')
          
          // Sync to store every 10 seconds
          if (newTime % 10 === 0) {
            useAppStore.setState({ timeRemaining: Math.max(0, newTime) })
          }
          
          // Session ended
          if (newTime <= 0) {
            console.log('⏱️ Time is up!')
            endCurrentSession()
            return 0
          }
          
          return newTime
        })
      } else {
        // For MEMBER sessions: just update floating timer with elapsed
        setElapsedTime(prev => {
          window.api?.updateFloatingTimer?.(prev, 'member')
          return prev
        })
      }
    }, 1000)

    // Cleanup
    return () => {
      if (timerRef.current) {
        console.log('⏱️ Stopping timer')
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [session?.id, session?.status, session?.session_type, endCurrentSession])

  // Format time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(s / 3600)
    const minutes = Math.floor((s % 3600) / 60)
    const secs = s % 60
    
    return [hours, minutes, secs]
      .map(v => v.toString().padStart(2, '0'))
      .join(':')
  }

  const formatCredits = (credits: number): string => {
    return `₱${credits.toFixed(2)}`
  }

  // Warning levels
  const getWarningLevel = (): 'normal' | 'warning' | 'critical' => {
    if (session?.session_type === 'guest') {
      if (timeRemaining <= 60) return 'critical'
      if (timeRemaining <= 300) return 'warning'
    } else if (member) {
      if (member.credits <= 5) return 'critical'
      if (member.credits <= 20) return 'warning'
    }
    return 'normal'
  }

  const handleEndSession = async () => {
    setShowEndConfirm(false)
    await endCurrentSession()
  }

  const warningLevel = getWarningLevel()
  const isGuest = session?.session_type === 'guest'

  // ========== MINIMIZED VIEW ==========
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed top-4 right-4 z-50 cursor-pointer"
      >
        <div className={`glass rounded-xl px-3 py-2 flex items-center gap-2 hover:scale-105 transition-transform ${
          warningLevel === 'critical' ? 'border-red-500/50 bg-red-500/10' :
          warningLevel === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : ''
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${
            warningLevel === 'critical' ? 'bg-red-500 animate-pulse' :
            warningLevel === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
          
          {isGuest ? (
            <span className={`font-mono text-base font-bold ${
              warningLevel === 'critical' ? 'text-red-400' :
              warningLevel === 'warning' ? 'text-amber-400' : 'text-white'
            }`}>
              {formatTime(timeRemaining)}
            </span>
          ) : (
            <span className={`font-semibold ${
              warningLevel === 'critical' ? 'text-red-400' :
              warningLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {formatCredits(member?.credits || 0)}
            </span>
          )}
          
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
      </div>
    )
  }

  // ========== FULL PANEL VIEW ==========
  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <div className={`glass rounded-2xl p-4 w-[280px] ${
          warningLevel === 'critical' ? 'border-red-500/50' :
          warningLevel === 'warning' ? 'border-amber-500/50' : ''
        }`}>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isGuest 
                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600' 
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600'
              }`}>
                {isGuest ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-white text-sm font-medium leading-tight">{device?.name || 'PC'}</p>
                <p className="text-slate-400 text-xs">
                  {isGuest ? 'Guest' : member?.username || 'Member'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* ========== GUEST SESSION ========== */}
          {isGuest && (
            <>
              <div className={`text-center py-4 rounded-xl mb-3 ${
                warningLevel === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                warningLevel === 'warning' ? 'bg-amber-500/10 border border-amber-500/30' : 
                'bg-slate-800/50'
              }`}>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Time Remaining</p>
                <p className={`text-4xl font-bold font-mono tracking-wide ${
                  warningLevel === 'critical' ? 'text-red-400 animate-pulse' :
                  warningLevel === 'warning' ? 'text-amber-400' : 'text-white'
                }`}>
                  {formatTime(timeRemaining)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-800/30 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[10px] uppercase">Elapsed</p>
                  <p className="text-white text-sm font-mono">{formatTime(elapsedTime)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[10px] uppercase">Rate</p>
                  <p className="text-white text-sm">
                    {session?.rates ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}m` : '-'}
                  </p>
                </div>
              </div>

              {warningLevel !== 'normal' && (
                <div className={`rounded-lg p-2 mb-3 text-center ${
                  warningLevel === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  <p className={`text-xs font-medium ${
                    warningLevel === 'critical' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {warningLevel === 'critical' ? '⚠️ Session ending soon!' : '⏰ Less than 5 minutes left'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ========== MEMBER SESSION ========== */}
          {!isGuest && (
            <>
              <div className={`text-center py-4 rounded-xl mb-3 ${
                warningLevel === 'critical' ? 'bg-red-500/10 border border-red-500/30' :
                warningLevel === 'warning' ? 'bg-amber-500/10 border border-amber-500/30' : 
                'bg-slate-800/50'
              }`}>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Credits Balance</p>
                <p className={`text-4xl font-bold ${
                  warningLevel === 'critical' ? 'text-red-400 animate-pulse' :
                  warningLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {formatCredits(member?.credits || 0)}
                </p>
                {member?.full_name && (
                  <p className="text-slate-400 text-xs mt-1">{member.full_name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-800/30 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[10px] uppercase">Session Time</p>
                  <p className="text-white text-sm font-mono">{formatTime(elapsedTime)}</p>
                </div>
                <div className="bg-slate-800/30 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-[10px] uppercase">Rate</p>
                  <p className="text-white text-sm">
                    {session?.rates ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}m` : '-'}
                  </p>
                </div>
              </div>

              {warningLevel !== 'normal' && (
                <div className={`rounded-lg p-2 mb-3 text-center ${
                  warningLevel === 'critical' ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  <p className={`text-xs font-medium ${
                    warningLevel === 'critical' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {warningLevel === 'critical' ? '⚠️ Low credits! Please top up.' : '💰 Credits running low'}
                  </p>
                </div>
              )}
            </>
          )}

          {/* End Session Button */}
          <button
            onClick={() => setShowEndConfirm(true)}
            className="w-full bg-slate-700/50 hover:bg-slate-600/50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Session
          </button>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-2xl p-5 w-72 mx-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">End Session?</h3>
              <p className="text-slate-400 text-sm">
                This will lock the computer.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-xl transition-colors"
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