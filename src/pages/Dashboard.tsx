import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BedDouble, Users, Bed, TrendingUp, AlertTriangle, Clock, ClipboardList, Activity } from 'lucide-react'
import type { DashboardData } from '@/types'

function StatCard({ icon: Icon, label, value, color, suffix }: {
  icon: React.ElementType; label: string; value: number | string; color: string; suffix?: string
}) {
  return (
    <div className="card p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}{suffix}</p>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-6 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  )
}

const activityIcons: Record<string, React.ElementType> = {
  checkin: Users,
  checkout: BedDouble,
  assign: Bed,
  warning: AlertTriangle,
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }, [])

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      <div className="grid grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="card p-6 h-40 animate-pulse" />)}</div>
      <div className="card p-6 h-60 animate-pulse" />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={BedDouble} label="总床位" value={data!.totalBeds} color="bg-[#1E3A5F]" />
        <StatCard icon={Users} label="已入住" value={data!.occupiedBeds} color="bg-emerald-500" />
        <StatCard icon={Bed} label="空闲床位" value={data!.availableBeds} color="bg-blue-500" />
        <StatCard icon={TrendingUp} label="入住率" value={data!.occupancyRate} color="bg-amber-500" suffix="%" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> 预警提醒
          </h3>
          <div className="space-y-3">
            <Link to="/warning" className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
              <span className="text-sm text-amber-800">即将到期</span>
              <span className="text-lg font-bold text-amber-600">{data!.expiringCount}</span>
            </Link>
            <Link to="/warning" className="flex items-center justify-between p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
              <span className="text-sm text-red-800">已超期</span>
              <span className="text-lg font-bold text-red-600">{data!.expiredCount}</span>
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-500" /> 待办事项
          </h3>
          <div className="space-y-3">
            <Link to="/checkin" className="flex items-center justify-between p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
              <span className="text-sm text-blue-800">待审批申请</span>
              <span className="text-lg font-bold text-blue-600">{data!.pendingApplications}</span>
            </Link>
            <Link to="/checkout" className="flex items-center justify-between p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
              <span className="text-sm text-purple-800">待处理退宿</span>
              <span className="text-lg font-bold text-purple-600">{data!.pendingCheckouts}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-500" /> 最近动态
        </h3>
        <div className="space-y-4">
          {data!.recentActivities.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">暂无动态</p>
          )}
          {data!.recentActivities.map(act => {
            const Icon = activityIcons[act.operationType] || Activity
            return (
              <div key={act.id} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{act.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <Clock className="w-3 h-3 inline mr-1" />{new Date(act.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
