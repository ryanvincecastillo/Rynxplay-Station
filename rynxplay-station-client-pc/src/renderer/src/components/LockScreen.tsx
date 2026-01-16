import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

export function LockScreen() {
  const { device, setScreen, handleMemberLogin, error, setError } = useAppStore()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showMemberLogin, setShowMemberLogin] = useState(false)
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleLogin = async () => {
    if (!username || !pin) {
      setError('Please enter username and PIN')
      return
    }
    
    setIsLoggingIn(true)
    const success = await handleMemberLogin(username, pin)
    setIsLoggingIn(false)
    
    if (success) {
      setShowMemberLogin(false)
      setUsername('')
      setPin('')
    }
  }

  const handlePinKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen lock-bg flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '-1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 glow-effect animate-pulse-slow">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Time Display */}
        <div className="mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="text-8xl font-light text-white tracking-tight timer-display">
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Date Display */}
        <div className="mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-2xl text-slate-400 font-light">
            {formatDate(currentTime)}
          </div>
        </div>

        {/* Device Info Card */}
        <div className="glass rounded-2xl px-8 py-6 mb-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-3 h-3 rounded-full status-online animate-pulse" />
            <span className="text-white font-medium">{device?.name || 'PC-001'}</span>
          </div>
          
          <div className="text-sm text-slate-400">
            {device?.device_code && (
              <span className="font-mono bg-slate-800/50 px-3 py-1 rounded-lg">
                {device.device_code}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!showMemberLogin ? (
          <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={() => setShowMemberLogin(true)}
              className="btn-primary px-12"
            >
              <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Member Login
            </button>
            
            <div className="text-slate-500 text-sm">
              Insert coins at the kiosk to start a guest session
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 w-80 animate-fade-in">
            <h3 className="text-xl font-semibold text-white mb-6">Member Login</h3>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 outline-none transition-all"
                />
              </div>
              
              <div>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyPress={handlePinKeyPress}
                  placeholder="PIN"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 outline-none transition-all tracking-widest"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowMemberLogin(false)
                  setUsername('')
                  setPin('')
                  setError(null)
                }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <svg className="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Branding */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-slate-600 text-sm">
          Powered by <span className="text-cyan-500 font-semibold">RYNXPLAY STATION</span>
        </p>
      </div>
    </div>
  )
}
