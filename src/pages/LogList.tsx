import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, FileDown, ChevronDown, Filter } from 'lucide-react'
import type { OperationLog, PaginatedResult } from '@/types'
import { downloadFile } from '@/lib/helpers'

const TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'checkin', label: '入住' },
  { value: 'checkout', label: '退宿' },
  { value: 'inspection', label: '检查' },
  { value: 'import', label: '导入' },
  { value: 'warning', label: '预警' },
  { value: 'other', label: '其他' },
]

export default function LogList() {
  const [list, setList] = useState<OperationLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [employeeName, setEmployeeName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [operationType, setOperationType] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const pageSize = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (employeeName) params.set('employeeName', employeeName)
      if (roomNumber) params.set('roomNumber', roomNumber)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (operationType) params.set('operationType', operationType)
      const res = await fetch(`/api/logs?${params}`)
      if (!res.ok) throw new Error()
      const data: PaginatedResult<OperationLog> = await res.json()
      setList(data.list)
      setTotal(data.total)
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [page, employeeName, roomNumber, startDate, endDate, operationType])

  useEffect(() => { fetchData() }, [fetchData])

  const filterDisplayText = useMemo(() => {
    const parts: string[] = []
    if (employeeName) parts.push(`操作人="${employeeName}"`)
    if (roomNumber) parts.push(`房间="${roomNumber}"`)
    if (operationType) {
      const label = TYPE_OPTIONS.find(o => o.value === operationType)?.label || operationType
      parts.push(`类型="${label}"`)
    }
    if (startDate) parts.push(`开始=${startDate}`)
    if (endDate) parts.push(`结束=${endDate}`)
    return parts.length > 0 ? parts.join('，') : '无'
  }, [employeeName, roomNumber, operationType, startDate, endDate])

  const buildExportUrl = (scope: 'current' | 'all') => {
    const filtersObj: Record<string, string> = {}
    if (employeeName) filtersObj.employeeName = employeeName
    if (roomNumber) filtersObj.roomNumber = roomNumber
    if (operationType) filtersObj.operationType = operationType
    if (startDate) filtersObj.startDate = startDate
    if (endDate) filtersObj.endDate = endDate

    const params = new URLSearchParams()
    params.set('scope', scope)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('filters', encodeURIComponent(JSON.stringify(filtersObj)))

    return `/api/logs/export?${params}`
  }

  const handleExport = async (scope: 'current' | 'all') => {
    setExportMenuOpen(false)
    setExporting(true)
    try {
      await downloadFile(buildExportUrl(scope), `operation-logs-${scope === 'current' ? 'page' : 'all'}.xlsx`)
    } catch { alert('导出失败') }
    finally { setExporting(false) }
  }

  const totalPages = Math.ceil(total / pageSize)

  const typeLabel = (t: string) => {
    const map: Record<string, string> = { checkin: '入住', checkout: '退宿', inspection: '检查', import: '导入', warning: '预警', other: '其他' }
    return map[t] || t
  }

  const typeColor = (t: string) => {
    const map: Record<string, string> = { checkin: 'badge-success', checkout: 'badge-danger', inspection: 'badge-info', import: 'badge-info', warning: 'badge-warning', other: 'badge-pending' }
    return map[t] || 'badge-info'
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">操作日志</h1>
        <div className="relative">
          <button
            className="btn-outline flex items-center gap-2 text-sm"
            disabled={exporting}
            onClick={() => setExportMenuOpen(o => !o)}
          >
            <FileDown className="w-4 h-4" />
            {exporting ? '导出中...' : '导出Excel'}
            <ChevronDown className="w-4 h-4" />
          </button>
          {exportMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                onClick={() => handleExport('current')}
              >
                导出当前页
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                onClick={() => handleExport('all')}
              >
                导出全部结果
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="操作人姓名" value={employeeName} onChange={e => { setEmployeeName(e.target.value); setPage(1) }} />
        </div>
        <input className="input-field w-32" placeholder="房间编号" value={roomNumber} onChange={e => { setRoomNumber(e.target.value); setPage(1) }} />
        <input type="date" className="input-field w-36" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        <span className="text-gray-400">至</span>
        <input type="date" className="input-field w-36" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        <select className="select-field w-28" value={operationType} onChange={e => { setOperationType(e.target.value); setPage(1) }}>
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="card p-3 bg-blue-50 border-blue-100 flex items-start gap-2 text-sm">
        <Filter className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <span className="text-blue-800 font-medium">当前筛选：</span>
          <span className="text-blue-700">{filterDisplayText}</span>
          <span className="text-blue-500 ml-2">（共 {total} 条记录）</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">操作人</th>
              <th className="px-4 py-3">操作类型</th>
              <th className="px-4 py-3">房间编号</th>
              <th className="px-4 py-3">描述</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={5} className="table-cell text-center text-gray-400">暂无数据</td></tr>
            ) : list.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="table-cell text-gray-500">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                <td className="table-cell font-medium">{log.employeeName}</td>
                <td className="table-cell"><span className={typeColor(log.operationType)}>{typeLabel(log.operationType)}</span></td>
                <td className="table-cell">{log.roomNumber}</td>
                <td className="table-cell max-w-xs truncate">{log.description}</td>
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
    </div>
  )
}
