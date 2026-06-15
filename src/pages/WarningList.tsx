import { useEffect, useState, useCallback } from 'react'
import { Search, ScanLine } from 'lucide-react'
import type { Warning, PaginatedResult } from '@/types'

interface WarningRow extends Warning {
  employeeName?: string
  roomNumber?: string
  endDate?: string
}

const LEVEL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'expiring', label: '即将到期' },
  { value: 'expired', label: '已超期' },
]

const HANDLED_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'unhandled', label: '未处理' },
  { value: 'handled', label: '已处理' },
]

export default function WarningList() {
  const [list, setList] = useState<WarningRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [level, setLevel] = useState('')
  const [handled, setHandled] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [selectedWarning, setSelectedWarning] = useState<WarningRow | null>(null)
  const [action, setAction] = useState('')
  const [extendDays, setExtendDays] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pageSize = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (level) params.set('level', level)
      if (handled === 'unhandled') params.set('handled', 'false')
      else if (handled === 'handled') params.set('handled', 'true')
      const res = await fetch(`/api/warnings?${params}`)
      if (!res.ok) throw new Error()
      const data: PaginatedResult<WarningRow> = await res.json()
      setList(data.list)
      setTotal(data.total)
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [page, level, handled])

  useEffect(() => { fetchData() }, [fetchData])

  const handleScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/warnings/scan', { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      alert(`扫描完成，新增 ${data.newWarnings} 条预警`)
      fetchData()
    } catch { alert('扫描失败') }
    finally { setScanning(false) }
  }

  const handleAction = async () => {
    if (!action) return alert('请选择处理方式')
    if (action === 'extend' && !extendDays) return alert('请输入延期天数')
    setSubmitting(true)
    try {
      const body: Record<string, string> = { action }
      if (action === 'extend') body.extendDays = extendDays
      const res = await fetch(`/api/warnings/${selectedWarning!.id}/handle`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setSelectedWarning(null)
      setAction('')
      setExtendDays('')
      fetchData()
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const totalPages = Math.ceil(total / pageSize)
  const levelLabel = (l: string) => l === 'expired' ? '已超期' : l === 'expiring' ? '即将到期' : l
  const levelColor = (l: string) => l === 'expired' ? 'badge-danger' : 'badge-warning'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">预警中心</h1>
        <button className="btn-primary flex items-center gap-2" disabled={scanning} onClick={handleScan}>
          <ScanLine className="w-4 h-4" /> {scanning ? '扫描中...' : '立即扫描'}
        </button>
      </div>

      <div className="card p-4 flex items-center gap-4">
        <select className="select-field w-32" value={level} onChange={e => { setLevel(e.target.value); setPage(1) }}>
          {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="select-field w-32" value={handled} onChange={e => { setHandled(e.target.value); setPage(1) }}>
          {HANDLED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3">员工</th>
              <th className="px-4 py-3">房间</th>
              <th className="px-4 py-3">预警级别</th>
              <th className="px-4 py-3">到期日期</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={6} className="table-cell text-center text-gray-400">暂无预警</td></tr>
            ) : list.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{(w as WarningRow).employeeName || '-'}</td>
                <td className="table-cell">{(w as WarningRow).roomNumber || '-'}</td>
                <td className="table-cell"><span className={levelColor(w.level)}>{levelLabel(w.level)}</span></td>
                <td className="table-cell">{(w as WarningRow).endDate ? new Date((w as WarningRow).endDate!).toLocaleDateString('zh-CN') : '-'}</td>
                <td className="table-cell">
                  <span className={w.status === 'handled' ? 'badge-success' : 'badge-pending'}>
                    {w.status === 'handled' ? '已处理' : '未处理'}
                  </span>
                </td>
                <td className="table-cell">
                  {w.status !== 'handled' && (
                    <button className="text-[#1E3A5F] hover:underline text-sm font-medium" onClick={() => setSelectedWarning(w)}>处理</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-outline text-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button className="btn-outline text-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
        </div>
      )}

      {selectedWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedWarning(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">处理预警</h2>
            <p className="text-sm text-gray-500">
              员工: {(selectedWarning as WarningRow).employeeName || '-'} | 级别: {levelLabel(selectedWarning.level)}
            </p>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">处理方式</label>
              <select className="select-field" value={action} onChange={e => setAction(e.target.value)}>
                <option value="">请选择</option>
                <option value="renew">续住</option>
                <option value="checkout">退宿</option>
                <option value="extend">延期</option>
              </select>
            </div>
            {action === 'extend' && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">延期天数</label>
                <input type="number" className="input-field" value={extendDays} onChange={e => setExtendDays(e.target.value)} placeholder="输入天数" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-outline" onClick={() => { setSelectedWarning(null); setAction(''); setExtendDays('') }}>取消</button>
              <button className="btn-primary" disabled={submitting} onClick={handleAction}>{submitting ? '处理中...' : '确认'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
