import { useEffect, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { FileDown, Calendar } from 'lucide-react'
import { downloadFile } from '@/lib/helpers'

interface MonthlyData {
  occupancyTrend: { month: string; rate: number }[]
  utilityCostPerBuilding: { buildingId: string; buildingName: string; waterCost: number; electricCost: number }[]
  checkoutDuration: { average: number; unit: string }
}

export default function Report() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/monthly?month=${month}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [month])

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(type)
    try {
      await downloadFile(`/api/reports/export/${type}?month=${month}`, `report-${month}.${type === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch { alert('导出失败') }
    finally { setExporting('') }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">统计报表</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="month" className="input-field w-44" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <button className="btn-outline flex items-center gap-1 text-sm" disabled={exporting === 'pdf'} onClick={() => handleExport('pdf')}>
            <FileDown className="w-4 h-4" /> {exporting === 'pdf' ? '导出中...' : '导出PDF'}
          </button>
          <button className="btn-outline flex items-center gap-1 text-sm" disabled={exporting === 'excel'} onClick={() => handleExport('excel')}>
            <FileDown className="w-4 h-4" /> {exporting === 'excel' ? '导出中...' : '导出Excel'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card p-6 h-72 animate-pulse" />)}
        </div>
      ) : !data ? (
        <div className="card p-12 text-center text-gray-400">暂无数据</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">入住率趋势</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.occupancyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#1E3A5F" strokeWidth={2} dot={{ r: 4 }} name="入住率" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">水电费统计</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.utilityCostPerBuilding}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="buildingName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="waterCost" fill="#3B82F6" name="水费" radius={[4, 4, 0, 0]} />
                <Bar dataKey="electricCost" fill="#F59E0B" name="电费" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6 col-span-2">
            <h3 className="font-bold text-gray-900 mb-4">退宿平均时长</h3>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <p className="text-5xl font-bold text-[#1E3A5F]">{data.checkoutDuration.average}</p>
                <p className="text-gray-500 mt-2">{data.checkoutDuration.unit}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
