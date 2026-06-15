import { clsx } from 'clsx'

type StatusType = 'application' | 'checkout' | 'warning' | 'bed'

interface StatusBadgeProps {
  status: string
  type: StatusType
}

const applicationMap: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-amber-100 text-amber-800' },
  assigned: { label: '已分配', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: '已驳回', cls: 'bg-red-100 text-red-800' },
}

const checkoutMap: Record<string, { label: string; cls: string }> = {
  inspection: { label: '检查中', cls: 'bg-amber-100 text-amber-800' },
  confirming: { label: '确认中', cls: 'bg-blue-100 text-blue-800' },
  settling: { label: '结算中', cls: 'bg-purple-100 text-purple-800' },
  completed: { label: '已完成', cls: 'bg-emerald-100 text-emerald-800' },
}

const warningMap: Record<string, { label: string; cls: string }> = {
  expiring: { label: '即将到期', cls: 'bg-amber-100 text-amber-800' },
  expired: { label: '已到期', cls: 'bg-red-100 text-red-800' },
}

const bedMap: Record<string, { label: string; cls: string }> = {
  available: { label: '空闲', cls: 'bg-emerald-100 text-emerald-800' },
  occupied: { label: '已占用', cls: 'bg-blue-100 text-blue-800' },
  maintenance: { label: '维护中', cls: 'bg-red-100 text-red-800' },
}

const maps: Record<StatusType, Record<string, { label: string; cls: string }>> = {
  application: applicationMap,
  checkout: checkoutMap,
  warning: warningMap,
  bed: bedMap,
}

export default function StatusBadge({ status, type }: StatusBadgeProps) {
  const config = maps[type]?.[status]
  if (!config) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {status}
      </span>
    )
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.cls,
      )}
    >
      {config.label}
    </span>
  )
}
