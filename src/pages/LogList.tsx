import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, FileDown, ChevronDown, Filter, Download, History, RefreshCw } from 'lucide-react'
import type { OperationLog, PaginatedResult, ExportTask } from '@/types'
import { downloadFile } from '@/lib/helpers'
import Modal from '@/components/Modal'

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
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([])
  const [exportTasksLoading, setExportTasksLoading] = useState(false)
  const [reExportingId, setReExportingId] = useState<string | null>(null)
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

  const fetchExportTasks = useCallback(async () => {
    setExportTasksLoading(true)
    try {
      const res = await fetch('/api/logs/export-tasks?pageSize=10')
      if (!res.ok) throw new Error()
      const data: PaginatedResult<ExportTask> = await res.json()
      setExportTasks(data.list)
    } catch { setExportTasks([]) }
    finally { setExportTasksLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (exportModalOpen) {
      fetchExportTasks()
    }
  }, [exportModalOpen, fetchExportTasks])

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
      fetchExportTasks()
    } catch { alert('导出失败') }
    finally { setExporting(false) }
  }

  const handleReExport = async (task: ExportTask) => {
    setReExportingId(task.id)
    try {
      const filters = task.filters || {}
      const params = new URLSearchParams()
      params.set('scope', task.scope)
      params.set('page', String(filters.page || 1))
      params.set('pageSize', String(filters.pageSize || 10))
      params.set('filters', encodeURIComponent(JSON.stringify(filters)))
      await downloadFile(`/api/logs/export?${params}`, task.fileName)
    } catch { alert('重新导出失败') }
    finally { setReExportingId(null) }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
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
        <div className="flex items-center gap-3">
          <button
            className="btn-outline flex items-center gap-2 text-sm"
            onClick={() => setExportModalOpen(true)}
          >
            <History className="w-4 h-4" />
            导出记录
          </button>
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

      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="导出记录"
        width="max-w-4xl"
      >
        <div className="space-y-4">
          {exportTasksLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : exportTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无导出记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">导出时间</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">文件名</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">范围</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">筛选条件</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">记录数</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-gray-600">文件大小</th>
                    <th className="px-3 py-2 text-right text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {exportTasks.map(task => (
                    <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 font-medium max-w-[180px] truncate" title={task.fileName}>
                        {task.fileName}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${task.scope === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {task.scope === 'all' ? '全部' : '当前页'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={task.filterDescription}>
                        {task.filterDescription}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {task.recordCount} 条
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {formatFileSize(task.fileSize)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                            onClick={() => handleReExport(task)}
                            disabled={reExportingId === task.id}
                          >
                            <Download className="w-3.5 h-3.5" />
                            {reExportingId === task.id ? '下载中...' : '下载'}
                          </button>
                          <button
                            className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 disabled:opacity-50"
                            onClick={() => handleReExport(task)}
                            disabled={reExportingId === task.id}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            重新导出
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pt-2 text-xs text-gray-400 text-center">
            显示最近 10 条导出记录，记录保留 7 天
          </div>
        </div>
      </Modal>
    </div>
  )
}
