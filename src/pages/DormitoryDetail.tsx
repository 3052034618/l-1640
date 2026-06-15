import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User } from 'lucide-react'
import type { Room } from '@/types'

export default function DormitoryDetail() {
  const { buildingId } = useParams<{ buildingId: string }>()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/buildings/${buildingId}/rooms`)
      .then(r => r.json())
      .then(data => setRooms(data.rooms || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [buildingId])

  const DORM_TYPE_MAP: Record<string, string> = { single: '单人间', double: '双人间', quad: '四人间' }

  const typeColor = (type: string) => {
    switch (type) {
      case 'single': return 'bg-purple-100 text-purple-800'
      case 'double': return 'bg-blue-100 text-blue-800'
      case 'quad': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const bedStatusStyle = (status: string, occupant?: { name: string }) => {
    switch (status) {
      case 'available': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'occupied': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'maintenance': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const bedStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return '空闲'
      case 'occupied': return '已住'
      case 'maintenance': return '维修'
      default: return status
    }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card p-4 h-40 animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <h1 className="text-xl font-bold text-gray-900">楼栋房间</h1>

      {rooms.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">暂无房间数据</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {rooms.map(room => (
            <div key={room.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{room.roomNumber}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(room.dormitoryType)}`}>
                  {DORM_TYPE_MAP[room.dormitoryType] || room.dormitoryType}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{room.floor}F · 容纳{room.capacity}人</p>
              <div className="grid grid-cols-2 gap-2">
                {room.beds?.map((bed: any) => (
                  <div key={bed.id} className={`p-2 rounded-lg border text-center ${bedStatusStyle(bed.status)}`}>
                    <p className="text-xs font-medium">{bed.bedNumber}号床</p>
                    <p className="text-xs mt-0.5">{bedStatusLabel(bed.status)}</p>
                    {bed.status === 'occupied' && bed.occupantName && (
                      <p className="text-xs mt-0.5 flex items-center justify-center gap-0.5">
                        <User className="w-3 h-3" /> {bed.occupantName}
                      </p>
                    )}
                  </div>
                ))}
                {(!room.beds || room.beds.length === 0) && (
                  <p className="text-xs text-gray-300 col-span-2 text-center py-2">无床位信息</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
