import { useAppStore } from '../stores/appStore'

export function MessageOverlay() {
  const { message, clearMessage } = useAppStore()

  if (!message) return null

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={clearMessage}
    >
      <div className="glass rounded-3xl p-10 max-w-lg w-full mx-4 text-center animate-slide-up">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 mx-auto mb-6 flex items-center justify-center glow-effect">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-4">
          Message from Admin
        </h2>

        {/* Message Content */}
        <p className="text-lg text-slate-300 mb-8 leading-relaxed">
          {message}
        </p>

        {/* Dismiss Button */}
        <button
          onClick={clearMessage}
          className="btn-primary px-12"
        >
          Dismiss
        </button>

        {/* Auto-dismiss hint */}
        <p className="text-sm text-slate-500 mt-4">
          This message will auto-dismiss in a few seconds
        </p>
      </div>
    </div>
  )
}
