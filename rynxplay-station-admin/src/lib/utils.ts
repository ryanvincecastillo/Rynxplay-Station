// Simple class name merger (without external dependencies)
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

// Format currency (Philippine Peso)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount)
}

// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Format time duration
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '00:00:00'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  return [hours, minutes, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':')
}

// Format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

// Format date and time
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Format date only
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format time only
export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Get status color classes
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-500',
    in_use: 'bg-rynx-400',
    pending: 'bg-amber-500',
    active: 'bg-emerald-500',
    completed: 'bg-slate-500',
    terminated: 'bg-red-500',
    paused: 'bg-amber-500'
  }
  return colors[status] || 'bg-slate-500'
}

// Get status text color classes
export function getStatusTextColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'text-emerald-400',
    offline: 'text-slate-400',
    in_use: 'text-rynx-400',
    pending: 'text-amber-400',
    active: 'text-emerald-400',
    completed: 'text-slate-400',
    terminated: 'text-red-400',
    paused: 'text-amber-400'
  }
  return colors[status] || 'text-slate-400'
}

// Get status badge styles
export function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    online: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    offline: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    in_use: 'bg-rynx-500/20 text-rynx-400 border-rynx-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    terminated: 'bg-red-500/20 text-red-400 border-red-500/30',
    paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  }
  return badges[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

// Truncate text
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Check if device is online (heartbeat within last 2 minutes)
export function isDeviceOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false
  
  const heartbeatTime = new Date(lastHeartbeat).getTime()
  const now = Date.now()
  const twoMinutes = 2 * 60 * 1000
  
  return (now - heartbeatTime) < twoMinutes
}
