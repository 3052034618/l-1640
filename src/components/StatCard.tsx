import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon: ReactNode
  trend?: number
  color?: 'primary' | 'success' | 'warning' | 'danger'
}

const colorMap = {
  primary: 'from-[#1E3A5F] to-[#2A4F7F]',
  success: 'from-emerald-500 to-emerald-600',
  warning: 'from-amber-500 to-amber-600',
  danger: 'from-red-500 to-red-600',
}

const iconBgMap = {
  primary: 'bg-white/20',
  success: 'bg-white/20',
  warning: 'bg-white/20',
  danger: 'bg-white/20',
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  color = 'primary',
}: StatCardProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl p-6 text-white bg-gradient-to-br',
        colorMap[color],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-white/80">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-white/90" />
              ) : (
                <TrendingDown className="w-4 h-4 text-white/90" />
              )}
              <span className="text-white/90">
                {trend >= 0 ? '+' : ''}
                {trend}%
              </span>
            </div>
          )}
        </div>
        <div className={clsx('p-3 rounded-lg', iconBgMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}
