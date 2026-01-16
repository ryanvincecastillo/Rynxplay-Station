import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  color?: 'rynx' | 'emerald' | 'amber' | 'red' | 'purple'
}

const colorClasses = {
  rynx: {
    bg: 'bg-rynx-500/10',
    text: 'text-rynx-400',
    border: 'border-rynx-500/20'
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20'
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20'
  },
  red: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20'
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20'
  }
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'rynx' }: StatCardProps) {
  const colors = colorClasses[color]
  
  return (
    <div className="stat-card group">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center transition-transform group-hover:scale-110`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              <svg 
                className={`w-4 h-4 ${!trend.isPositive ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          )}
        </div>
        
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-3xl font-display font-bold text-slate-100">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}
