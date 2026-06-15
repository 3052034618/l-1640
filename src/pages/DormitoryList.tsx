import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Users } from 'lucide-react'
import type { Building } from '@/types'

export default function DormitoryList() {
  const navigate = useNavigate()
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/buildings')
      .then(r => r.json())
      .then(data => setBuildings(Array.isArray(data) ? data : data.buildings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const genderLabel = (gender: string) => gender === 'male' ? '男' : '女'
  const genderColor = (gender: string) => gender === 'male' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">宿舍管理</h1>
        <button className="btn-outline flex items-center gap-2" onClick={() => navigate('/dormitory/import')}>
          <Upload className="w-4 h-4" /> 批量导入
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 h-44 animate-pulse" />
          ))}
        </div>
      ) : buildings.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">暂无楼栋数据</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {buildings.map(b => (
            <div key={b.id} className="card p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/dormitory/${b.id}`)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">{b.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${genderColor(b.gender)}`}>
                  {genderLabel(b.gender)}生
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" /> {b.floors}层
                </span>
                <span>{b.totalRooms}间房</span>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>入住率</span>
                  <span>{b.occupancyRate ?? 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-[#1E3A5F] h-2 rounded-full transition-all" style={{ width: `${b.occupancyRate ?? 0}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>已住 {b.occupiedBeds ?? 0}</span>
                  <span>总床位 {b.totalBeds ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
