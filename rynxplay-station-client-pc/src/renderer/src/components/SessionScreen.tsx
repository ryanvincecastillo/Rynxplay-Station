import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'

export function SessionScreen() {
  const { 
    session, 
    member, 
    device,
    timeRemaining, 
    totalSecondsUsed,
    endCurrentSession
  } = useAppStore()
  
  const [isMinimized, setIsMinimized] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  // Debug: Log session state changes
  useEffect(() => {
    console.log('🔍 SessionScreen render:', {
      sessionId: session?.id,
      sessionStatus: session?.status,
      sessionType: session?.session_type,
      timeRemaining,
      totalSecondsUsed
    })
  }, [session?.id, session?.status, session?.session_type, timeRemaining, totalSecondsUsed])

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
      <div className="fixed top-4 right-4 z-50 animate-slide-up max-h-[calc(100vh-2rem)] overflow-hidden">
        <div className={`glass rounded-3xl p-5 w-[300px] ${
          warningLevel === 'critical' ? 'border-red-500/50 animate-pulse' :
          warningLevel === 'warning' ? 'border-amber-500/50' : ''
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{device?.name}</h3>
                <p className="text-xs text-slate-400">
                  {session?.session_type === 'guest' ? 'Guest Session' : 'Member Session'}
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Timer / Credits Display */}
          {session?.session_type === 'guest' ? (
            <div className="text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">Time Remaining</p>
              <div className={`text-4xl font-bold timer-display ${
                warningLevel === 'critical' ? 'text-red-400' :
                warningLevel === 'warning' ? 'text-amber-400' : 'text-white'
              }`}>
                {formatTime(timeRemaining)}
              </div>
            </div>
          ) : (
            <div className="text-center mb-4">
              <p className="text-xs text-slate-400 mb-1">Credits Balance</p>
              <div className={`text-4xl font-bold ${
                warningLevel === 'critical' ? 'text-red-400' :
                warningLevel === 'warning' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {formatCredits(member?.credits || 0)}
              </div>
              {member && (
                <p className="text-xs text-slate-400 mt-1">
                  Welcome, <span className="text-white">{member.full_name || member.username}</span>
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Session Time</p>
              <p className="text-sm font-mono text-white">{formatTime(totalSecondsUsed)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Rate</p>
              <p className="text-sm text-white">
                {session?.rates ? `₱${session.rates.price_per_unit}/${session.rates.unit_minutes}min` : '-'}
              </p>
            </div>
          </div>

          {/* Warning Message */}
          {warningLevel === 'critical' && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-2.5 mb-3 text-center animate-pulse">
              <p className="text-red-400 text-xs font-medium">
                {session?.session_type === 'guest' 
                  ? 'Session ending soon!' 
                  : 'Low credits! Please top up.'}
              </p>
            </div>
          )}

          {/* End Session Button */}
          <button
            onClick={() => setShowEndConfirm(true)}
            className="w-full btn-secondary flex items-center justify-center py-2.5 text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Session
          </button>
        </div>
      </div>

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass rounded-3xl p-6 max-w-sm w-full mx-4 animate-slide-up">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 mx-auto mb-3 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">End Session?</h3>
              <p className="text-slate-400 text-sm">
                Are you sure you want to end your current session?
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 btn-secondary py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors"
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