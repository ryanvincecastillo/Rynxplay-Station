import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

interface DebugLog {
  id: number
  time: string
  type: 'info' | 'success' | 'error' | 'command' | 'terminal'
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
  const [terminalInput, setTerminalInput] = useState('')
  const [terminalHistory, setTerminalHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isProcessing, setIsProcessing] = useState(false)
  const terminalInputRef = useRef<HTMLInputElement>(null)
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
      if (e.key === 'Meta') return

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        setIsVisible(prev => !prev)
        e.preventDefault()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus terminal input when panel opens
  useEffect(() => {
    if (isVisible && terminalInputRef.current) {
      setTimeout(() => terminalInputRef.current?.focus(), 100)
    }
  }, [isVisible])

  const addTerminalLog = (type: DebugLog['type'], message: string) => {
    const log: DebugLog = {
      id: logId++,
      time: new Date().toLocaleTimeString(),
      type,
      message
    }
    debugLogs = [log, ...debugLogs].slice(0, 50)
    setLogs([...debugLogs])
  }

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const command = terminalInput.trim()
    if (!command) return

    // Add to history
    setTerminalHistory(prev => [command, ...prev].slice(0, 20))
    setHistoryIndex(-1)
    setTerminalInput('')

    // Log the command (masked if it looks like a kill code)
    const maskedCommand = command.startsWith('RYNX-') ? '********' : command
    addTerminalLog('terminal', `> ${maskedCommand}`)

    // Process commands
    if (command.toLowerCase() === 'help') {
      addTerminalLog('info', '═══ Available Commands ═══')
      addTerminalLog('info', '  help     - Show this help')
      addTerminalLog('info', '  status   - Show system status')
      addTerminalLog('info', '  clear    - Clear terminal')
      addTerminalLog('info', '═══ To Exit App ═══')
      addTerminalLog('info', '  Type: RYNX-ADMIN-EXIT-2024')
      addTerminalLog('info', '  (This is the default kill code)')
      return
    }

    if (command.toLowerCase() === 'clear') {
      debugLogs = []
      setLogs([])
      return
    }

    if (command.toLowerCase() === 'status') {
      addTerminalLog('info', `Device: ${device?.device_code || 'N/A'}`)
      addTerminalLog('info', `Status: ${device?.status || 'Unknown'}`)
      addTerminalLog('info', `Channels: ${channels.length} active`)
      addTerminalLog('info', `Supabase: ${isSupabaseConfigured ? 'Connected' : 'Not configured'}`)
      return
    }

    // Try as kill code (any input that's not a recognized command)
    setIsProcessing(true)
    addTerminalLog('info', '🔐 Verifying kill code...')

    try {
      const result = await window.api.quitApp(command)
      if (result) {
        addTerminalLog('success', '✓ Kill code accepted!')
        addTerminalLog('success', '✓ Exiting application...')
        // App should quit now, but add a fallback message
        setTimeout(() => {
          addTerminalLog('error', '⚠ If app did not close, try restarting')
          setIsProcessing(false)
        }, 3000)
      } else {
        addTerminalLog('error', '✗ Invalid kill code')
        addTerminalLog('info', '💡 Try: RYNX-ADMIN-EXIT-2024')
        setIsProcessing(false)
      }
    } catch (error) {
      addTerminalLog('error', `✗ Error: ${error}`)
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < terminalHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setTerminalInput(terminalHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setTerminalInput(terminalHistory[newIndex])
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setTerminalInput('')
      }
    }
  }

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
      case 'terminal': return 'text-amber-400'
      default: return 'text-slate-400'
    }
  }

  const getLogIcon = (type: DebugLog['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'command': return '🎮'
      case 'terminal': return '💻'
      default: return '📡'
    }
  }

  return (
    <div className="fixed inset-4 z-[9999] pointer-events-none">
      <div className="absolute right-0 top-0 w-[420px] max-h-[85vh] bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col">
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
        <div className="flex-1 overflow-y-auto p-3 min-h-[150px]">
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

        {/* Terminal Section */}
        <div className="border-t border-slate-700 bg-slate-950">
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">💻 Admin Terminal</span>
              <span className="text-[10px] text-slate-600">|</span>
              <span className="text-[10px] text-slate-600">Type 'help' for commands</span>
            </div>
          </div>
          
          <form onSubmit={handleTerminalSubmit} className="p-2">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-emerald-400 font-mono text-sm">$</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isProcessing ? 'Processing...' : 'Enter kill code to exit...'}
                disabled={isProcessing}
                className="flex-1 bg-transparent text-slate-200 text-sm font-mono placeholder-slate-600 outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              {isProcessing && (
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </form>
          
          <div className="px-3 pb-2 space-y-1">
            <p className="text-[9px] text-slate-600">
              ↑↓ History • Enter to execute
            </p>
            <p className="text-[9px] text-amber-500/70">
              💡 Default kill code: RYNX-ADMIN-EXIT-2024
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-slate-700 bg-slate-800/50">
          <p className="text-[10px] text-slate-500 text-center">
            Ctrl+Shift+D DevTools • Ctrl+Shift+L Toggle Panel
          </p>
        </div>
      </div>
    </div>
  )
}