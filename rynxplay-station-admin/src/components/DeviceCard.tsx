import { Monitor, Smartphone, MoreVertical, Power, RefreshCw, MessageSquare, Lock, Info } from 'lucide-react'
import { useState } from 'react'
import type { Device } from '@/types'
import { formatRelativeTime, getStatusBadge, formatBytes } from '@/lib/utils'

interface DeviceCardProps {
  device: Device
  onCommand: (command: 'shutdown' | 'restart' | 'lock' | 'message') => void
  onViewDetails: () => void
}

export function DeviceCard({ device, onCommand, onViewDetails }: DeviceCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const Icon = device.device_type === 'pc' ? Monitor : Smartphone
  
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      online: 'Online',
      offline: 'Offline',
      in_use: 'In Use',
      pending: 'Pending'
    }
    return labels[status] || status
  }
  
  return (
    <div className="card-hover p-5 group relative">
      {/* Status indicator */}
      <div className={`absolute top-4 right-4 status-dot ${device.status}`} />
      
      {/* Device icon and name */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
          device.status === 'in_use' 
            ? 'bg-rynx-500/20 text-rynx-400' 
            : device.status === 'online'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-slate-800 text-slate-500'
        }`}>
          <Icon className="w-7 h-7" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{device.name}</h3>
          <p className="text-sm text-slate-500 font-mono">{device.device_code}</p>
        </div>
        
        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 animate-scale-in">
                <button
                  onClick={() => { onViewDetails(); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <Info className="w-4 h-4" />
                  View Details
                </button>
                <button
                  onClick={() => { onCommand('message'); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </button>
                <button
                  onClick={() => { onCommand('lock'); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  Lock Device
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => { onCommand('restart'); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-slate-700/50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Restart
                </button>
                <button
                  onClick={() => { onCommand('shutdown'); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                >
                  <Power className="w-4 h-4" />
                  Shutdown
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`badge ${getStatusBadge(device.status)}`}>
          {getStatusLabel(device.status)}
        </span>
        {device.rates && (
          <span className="badge bg-slate-800 text-slate-400 border-slate-700">
            ₱{device.rates.price_per_unit}/{device.rates.unit_minutes}min
          </span>
        )}
      </div>
      
      {/* Specs preview */}
      {device.specs && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span>CPU</span>
            <span className="text-slate-300 truncate ml-2 max-w-[60%] text-right">{device.specs.cpu.brand}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>RAM</span>
            <span className="text-slate-300">{formatBytes(device.specs.memory.total)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Last seen</span>
            <span className="text-slate-300">{device.last_heartbeat ? formatRelativeTime(device.last_heartbeat) : 'Never'}</span>
          </div>
        </div>
      )}
      
      {/* Branch info */}
      {device.branches && (
        <div className="mt-4 pt-4 border-t border-slate-800/50">
          <p className="text-xs text-slate-500">
            {device.branches.name}
          </p>
        </div>
      )}
    </div>
  )
}
