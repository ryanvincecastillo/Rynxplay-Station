import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

interface DebugLog {
  id: number
  time: string
  type: 'info' | 'success' | 'error' | 'command'
  message: string
}

// Global debug log store
let debugLogs: DebugLog[] = []
let logId = 0
let debugListeners: ((logs: DebugLog[]) => void)[] = []

export function addDebugLog(type: DebugLog['type'], message: string) {
  const log: DebugLog = {
    id: logId++,
    time: new Date().toLocaleTimeString(),
    type,
    message
  }
  debugLogs = [log, ...debugLogs].slice(0, 50) // Keep last 50 logs
  debugListeners.forEach(listener => listener([...debugLogs]))
}

// Expose globally for supabase.ts to use
;(window as any).addDebugLog = addDebugLog

export function DebugOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<DebugLog[]>([])
  const { device, channels, isSupabaseConfigured } = useAppStore()

  // Subscribe to debug logs
  useEffect(() => {
    const listener = (newLogs: DebugLog[]) => setLogs(newLogs)
    debugListeners.push(listener)
    setLogs([...debugLogs])
    
    return () => {
      debugListeners = debugListeners.filter(l => l !== listener)
    }
  }, [])

  // Toggle with Ctrl+Shift+L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      
      //handle if window key is pressed
      if (e.key === 'Meta') return

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        setIsVisible(prev => !prev)
        e.preventDefault()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999]">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-slate-800/80 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-mono hover:bg-slate-700/80 transition-colors"
        >
          🐛 Debug (Ctrl+Shift+L)
        </button>
      </div>
    )
  }

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400'
      case 'error': return 'text-red-400'
      case 'command': return 'text-cyan-400'
      default: return 'text-slate-400'
    }
  }

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'command': return '🎮'
      default: return '📡'
    }
  }

  return (
    <div className="fixed inset-4 z-[9999] pointer-events-none">
      <div className="absolute right-0 top-0 w-96 max-h-[80vh] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-sm font-bold text-slate-200">🐛 Debug Panel</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Section */}
        <div className="p-3 border-b border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Supabase Configured:</span>
            <span className={isSupabaseConfigured ? 'text-emerald-400' : 'text-red-400'}>
              {isSupabaseConfigured ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Device ID:</span>
            <span className="text-slate-200 font-mono text-[10px]">
              {device?.id?.slice(0, 8) || 'N/A'}...
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Active Channels:</span>
            <span className={channels.length > 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {channels.length} channel(s)
            </span>
          </div>
          
          <div className="mt-2 p-2 bg-slate-800 rounded-lg">
            <p className="text-[10px] text-slate-500 mb-1">Channel Status:</p>
            {channels.length === 0 ? (
              <p className="text-xs text-amber-400">No active subscriptions</p>
            ) : (
              <div className="space-y-1">
                {channels.map((channel, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-2 h-2 rounded-full ${
                      (channel as any).state === 'joined' ? 'bg-emerald-400' : 
                      (channel as any).state === 'joining' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <span className="text-slate-300 font-mono truncate">
                      {(channel as any).topic || `Channel ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logs Section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-300">Event Log</h4>
            <button
              onClick={() => {
                debugLogs = []
                setLogs([])
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          </div>
          
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No events yet...</p>
          ) : (
            <div className="space-y-1">
              {logs.map(log => (
                <div key={log.id} className="text-[10px] font-mono">
                  <span className="text-slate-600">{log.time}</span>
                  <span className="mx-1">{getLogIcon(log.type)}</span>
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-slate-700 bg-slate-800/50">
          <p className="text-[10px] text-slate-500 text-center">
            Press Ctrl+Shift+D for DevTools • Ctrl+Shift+L to toggle
          </p>
        </div>
      </div>
    </div>
  )
}