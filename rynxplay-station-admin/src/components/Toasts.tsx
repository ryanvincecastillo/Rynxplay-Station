import { useAppStore } from '@/stores/appStore'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

export function Toasts() {
  const { toasts, removeToast } = useAppStore()
  
  if (toasts.length === 0) return null
  
  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map(toast => {
        const Icon = icons[toast.type]
        
        return (
          <div
            key={toast.id}
            className={`toast ${toast.type} min-w-[300px] max-w-md`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
