import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const { 
    session, 
    member, 
    device,
    timeRemaining, 
    totalSecondsUsed,
    decrementTimer,
    chargeCredits,
    endCurrentSession,
    lock
  } = useAppStore()
  
  const [isMinimized, setIsMinimized] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Timer countdown for guest sessions
  useEffect(() => {
    if (!session || session.status !== 'active') return
    
    const timer = setInterval(() => {
      decrementTimer()
    }, 1000)
    
    return () => clearInterval(timer)
  }, [session, decrementTimer])

  // Credit charging for member sessions (every 60 seconds)
  useEffect(() => {
    if (!session || session.session_type !== 'member' || session.status !== 'active') return
    
    chargeIntervalRef.current = setInterval(async () => {
      await chargeCredits()
    }, 60000) // Charge every minute
    
    return () => {
      if (chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current)
      }
    }
  }, [session, chargeCredits])

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00:00'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return [hours, minutes, secs]
      .map(v => v.toString().padStart(2, '0'))
      .join(':')
  }

  const formatCredits = (credits: number): string => {
    return `₱${credits.toFixed(2)}`
  }

  const getTimeWarningLevel = (): 'normal' | 'warning' | 'critical' => {
    if (session?.session_type === 'member') return 'normal'
    if (timeRemaining <= 60) return 'critical'
    if (timeRemaining <= 300) return 'warning'
    return 'normal'
  }

  const getCreditsWarningLevel = (): 'normal' | 'warning' | 'critical' => {
    if (!member || session?.session_type !== 'member') return 'normal'
    if (member.credits <= 5) return 'critical'
    if (member.credits <= 20) return 'warning'
    return 'normal'
  }

  const handleEndSession = async () => {
    setShowEndConfirm(false)
    await endCurrentSession()
  }

  const warningLevel = session?.session_type === 'guest' ? getTimeWarningLevel() : getCreditsWarningLevel()

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed top-4 right-4 z-50 cursor-pointer animate-fade-in"
      >
        <div className={`glass rounded-2xl px-4 py-3 flex items-center space-x-3 hover:scale-105 transition-transform ${
          warningLevel === 'critical' ? 'border-red-500/50 bg-red-500/10' :
          warningLevel === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : ''
        }`}>
          <div className={`w-3 h-3 rounded-full ${
            warningLevel === 'critical' ? 'bg-red-500 animate-pulse' :
            warningLevel === 'warning' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
          }`} />
          
          {session?.session_type === 'guest' ? (
            <span className={`font-mono text-lg font-bold ${
              warningLevel === 'critical' ? 'text-red-400' :
              warningLevel === 'warning' ? 'text-amber-400' : 'text-white'
            }`}>
              {formatTime(timeRemaining)}
            </span>
          ) : (
            <span className={`font-bold ${
              warningLevel === 'critical' ? 'text-red-400' :
              warningLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {formatCredits(member?.credits || 0)}
            </span>
          )}
          
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Session Panel */}
      <div className="fixed top-4 right-4 z-50 animate-slide-up">
        <div className={`glass rounded-3xl p-6 min-w-[320px] ${
          warningLevel === 'critical' ? 'border-red-500/50 animate-pulse' :
          warningLevel === 'warning' ? 'border-amber-500/50' : ''
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">{device?.name}</h3>
                <p className="text-xs text-slate-400">
                  {session?.session_type === 'guest' ? 'Guest Session' : 'Member Session'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Timer / Credits Display */}
          {session?.session_type === 'guest' ? (
            <div className="text-center mb-6">
              <p className="text-sm text-slate-400 mb-2">Time Remaining</p>
              <div className={`text-5xl font-bold timer-display ${
                warningLevel === 'critical' ? 'text-red-400' :
                warningLevel === 'warning' ? 'text-amber-400' : 'text-white'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          ) : (
            <div className="text-center mb-6">
              <p className="text-sm text-slate-400 mb-2">Credits Balance</p>
              <div className={`text-5xl font-bold ${
                warningLevel === 'critical' ? 'text-red-400' :
                warningLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {formatCredits(member?.credits || 0)}
              </div>
              {member && (
                <p className="text-sm text-slate-400 mt-2">
                  Welcome, <span className="text-white">{member.full_name || member.username}</span>
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Session Time</p>
              <p className="text-lg font-mono text-white">{formatTime(totalSecondsUsed)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Rate</p>
              <p className="text-lg text-white">
                {session?.rates ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}min` : '-'}
              </p>
            </div>
          </div>

          {/* Warning Message */}
          {warningLevel === 'critical' && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-4 text-center animate-pulse">
              <p className="text-red-400 text-sm font-medium">
                {session?.session_type === 'guest' 
                  ? 'Session ending soon!' 
                  : 'Low credits! Please top up.'}
              </p>
            </div>
          )}

          {/* End Session Button */}
          <button
            onClick={() => setShowEndConfirm(true)}
            className="w-full btn-secondary flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Session
          </button>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl p-8 max-w-sm w-full mx-4 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">End Session?</h3>
              <p className="text-slate-400">
                Are you sure you want to end your current session?
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
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
