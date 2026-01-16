import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import type { SystemSpecs } from '../types'

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function SpecItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center space-x-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-cyan-400">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  )
}

export function SetupScreen() {
  const { 
    deviceCode, 
    qrCodeUrl, 
    systemSpecs, 
    config, 
    error, 
    setError,
    setDeviceName,
    registerPendingDevice,
    isSupabaseConfigured
  } = useAppStore()
  
  const [deviceName, setLocalDeviceName] = useState(config?.deviceName || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    if (systemSpecs?.os.hostname && !deviceName) {
      setLocalDeviceName(systemSpecs.os.hostname)
    }
  }, [systemSpecs])

  const handleRegister = async () => {
    if (!deviceName.trim()) {
      setError('Please enter a device name')
      return
    }

    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Please check your environment variables.')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      await setDeviceName(deviceName.trim())
      const success = await registerPendingDevice()
      
      if (success) {
        setIsRegistered(true)
      } else {
        setError('Failed to register device. Please try again.')
      }
    } catch (err) {
      setError('An error occurred during registration.')
    }
    
    setIsLoading(false)
  }

  const handleCopyCode = async () => {
    if (deviceCode) {
      await navigator.clipboard.writeText(deviceCode)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  return (
    <div className="min-h-screen lock-bg flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 glow-effect">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">RYNXPLAY STATION</h1>
          <p className="text-slate-400">Client PC Setup</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - QR Code & Device Code */}
          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 text-center">
              Device Registration
            </h2>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              {qrCodeUrl ? (
                <div className="bg-white p-3 rounded-2xl">
                  <img src={qrCodeUrl} alt="Device QR Code" className="w-48 h-48" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-800 rounded-2xl flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>

            {/* Device Code */}
            <div className="text-center mb-6">
              <p className="text-xs text-slate-500 mb-2">Device Code</p>
              <div className="flex items-center justify-center space-x-2">
                <code className="text-2xl font-mono font-bold text-cyan-400 tracking-wider">
                  {deviceCode || 'Loading...'}
                </code>
                <button
                  onClick={handleCopyCode}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  {copySuccess ? (
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Device Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Device Name
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setLocalDeviceName(e.target.value)}
                placeholder="e.g., PC-001 or Gaming Station"
                disabled={isRegistered}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Register Button */}
            {!isRegistered ? (
              <button
                onClick={handleRegister}
                disabled={isLoading || !deviceCode}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : (
                  'Register Device'
                )}
              </button>
            ) : (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 mb-3">
                  <svg className="w-6 h-6 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-amber-400 font-medium mb-1">Waiting for Admin Approval</p>
                <p className="text-sm text-slate-500">
                  Ask your admin to add this device in the dashboard using the code above
                </p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-xs text-slate-500 text-center">
                Scan QR code or enter the device code in the admin panel to add this PC
              </p>
            </div>
          </div>

          {/* Right Column - System Specs */}
          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              System Specifications
            </h2>

            {systemSpecs ? (
              <div className="space-y-1">
                {/* OS */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                  label="Operating System"
                  value={`${systemSpecs.os.distro} ${systemSpecs.os.release} (${systemSpecs.os.arch})`}
                />

                {/* Hostname */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  }
                  label="Hostname"
                  value={systemSpecs.os.hostname}
                />

                {/* CPU */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  }
                  label="Processor"
                  value={`${systemSpecs.cpu.brand} (${systemSpecs.cpu.physicalCores} cores @ ${systemSpecs.cpu.speed}GHz)`}
                />

                {/* Memory */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                  label="Memory (RAM)"
                  value={formatBytes(systemSpecs.memory.total)}
                />

                {/* Graphics */}
                {systemSpecs.graphics.controllers.map((gpu, index) => (
                  <SpecItem
                    key={index}
                    icon={
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                    label={`Graphics ${systemSpecs.graphics.controllers.length > 1 ? index + 1 : ''}`}
                    value={`${gpu.model}${gpu.vram ? ` (${gpu.vram}MB)` : ''}`}
                  />
                ))}

                {/* Storage */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  }
                  label="Storage"
                  value={`${formatBytes(systemSpecs.disk.total)} (${formatBytes(systemSpecs.disk.free)} free)`}
                />

                {/* Network */}
                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  }
                  label="Network (IP)"
                  value={systemSpecs.network.ip}
                />

                <SpecItem
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                  }
                  label="MAC Address"
                  value={systemSpecs.network.mac}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 text-cyan-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-slate-400">Loading system specs...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            Powered by <span className="text-cyan-500 font-semibold">RYNXPLAY STATION</span>
          </p>
        </div>
      </div>
    </div>
  )
}
