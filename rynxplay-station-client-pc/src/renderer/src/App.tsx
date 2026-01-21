import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { SetupScreen, PendingScreen, LockScreen, SessionScreen, MessageOverlay, DebugOverlay } from './components'

function LoadingScreen() {
  return (
    <div className="min-h-screen lock-bg flex items-center justify-center">
      <div className="text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-8 glow-effect animate-pulse">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        
        {/* Loading Text */}
        <h1 className="text-2xl font-bold text-white mb-4">RYNXPLAY STATION</h1>
        
        {/* Loading Spinner */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        <p className="text-slate-500 mt-4">Initializing...</p>
      </div>
    </div>
  )
}

function App() {
  const { screen, isInitialized, session, message, initialize, cleanup, endCurrentSession } = useAppStore()

  // Initialize on mount
  useEffect(() => {
    initialize()
    
    // Cleanup on unmount
    return () => {
      cleanup()
    }
  }, [initialize, cleanup])

  // Listen for timer-ended from main process (floating timer reached zero)
  useEffect(() => {
    const handleTimerEnded = () => {
      console.log('⏱️ Received timer-ended from main process')
      endCurrentSession()
    }

    // Add listener via preload API
    window.api?.onTimerEnded?.(handleTimerEnded)

    return () => {
      window.api?.removeTimerEndedListener?.()
    }
  }, [endCurrentSession])

  // Listen for timer-sync from floating timer to update store
  useEffect(() => {
    const handleTimerSync = (data: { timeRemaining: number, totalSecondsUsed: number, sessionType: string }) => {
      const currentSession = useAppStore.getState().session
      if (!currentSession) return

      // Update store with the actual values from floating timer
      useAppStore.setState({ 
        timeRemaining: data.timeRemaining,
        totalSecondsUsed: data.totalSecondsUsed
      })
      
      console.log('⏱️ Store updated from floating timer:', data.timeRemaining, 'remaining,', data.totalSecondsUsed, 'used')
    }

    window.api?.onTimerSync?.(handleTimerSync)

    return () => {
      window.api?.removeTimerSyncListener?.()
    }
  }, [])

  // Show loading screen while initializing
  if (!isInitialized) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen">
      {/* Main Screen */}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'pending' && <PendingScreen />}
      {screen === 'lock' && <LockScreen />}
      
      {/* Session Overlay (shows on top of unlocked desktop) */}
      {session && screen === 'session' && <SessionScreen />}
      
      {/* Message Overlay (highest z-index) */}
      {message && <MessageOverlay />}
      
      {/* Debug Overlay - Always visible for debugging */}
      <DebugOverlay />
    </div>
  )
}

export default App