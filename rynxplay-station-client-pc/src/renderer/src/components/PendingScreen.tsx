import { useAppStore } from '../stores/appStore'

export function PendingScreen() {
  const { deviceCode, qrCodeUrl, config } = useAppStore()

  return (
    <div className="min-h-screen lock-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-6 glow-effect">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">RYNXPLAY STATION</h1>
        <p className="text-slate-400 mb-8">{config?.deviceName || 'PC Client'}</p>

        {/* Pending Card */}
        <div className="glass rounded-3xl p-8">
          {/* Animated waiting icon */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
            {/* Outer ring animation */}
            <div className="absolute inset-0 border-4 border-amber-500/30 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 border-4 border-amber-500/50 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            
            {/* Icon */}
            <div className="relative w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-amber-400 mb-2">
            Waiting for Approval
          </h2>
          <p className="text-slate-400 mb-6">
            This device is registered and waiting for an administrator to assign it to a shop/branch.
          </p>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex justify-center mb-4">
              <div className="bg-white p-2 rounded-xl">
                <img src={qrCodeUrl} alt="Device QR Code" className="w-32 h-32" />
              </div>
            </div>
          )}

          {/* Device Code */}
          <div className="mb-6">
            <p className="text-xs text-slate-500 mb-1">Device Code</p>
            <code className="text-xl font-mono font-bold text-cyan-400 tracking-wider">
              {deviceCode}
            </code>
          </div>

          {/* Instructions */}
          <div className="bg-slate-800/50 rounded-xl p-4 text-left">
            <p className="text-sm text-slate-400 mb-2">
              <span className="font-semibold text-white">Next Steps:</span>
            </p>
            <ol className="text-sm text-slate-400 space-y-2">
              <li className="flex items-start">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">1</span>
                <span>Open the RYNXPLAY Admin Dashboard</span>
              </li>
              <li className="flex items-start">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">2</span>
                <span>Go to Devices → Add New Device</span>
              </li>
              <li className="flex items-start">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">3</span>
                <span>Scan the QR code or enter the device code</span>
              </li>
              <li className="flex items-start">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">4</span>
                <span>Select the shop and branch for this device</span>
              </li>
            </ol>
          </div>

          {/* Auto-refresh notice */}
          <p className="text-xs text-slate-600 mt-4">
            This screen will automatically update when the device is approved
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600 mt-6">
          Powered by <span className="text-cyan-500 font-semibold">RYNXPLAY STATION</span>
        </p>
      </div>
    </div>
  )
}
