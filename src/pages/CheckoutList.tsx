import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import type { Checkout, PaginatedResult } from '@/types'

interface CheckoutRow extends Checkout {
  employeeName?: string
  roomNumber?: string
}
import { formatStatus, statusBadgeClass } from '@/lib/helpers'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'inspection', label: '待检查' },
  { value: 'confirming', label: '待确认' },
  { value: 'settling', label: '待结算' },
  { value: 'completed', label: '已完成' },
]

export default function CheckoutList() {
  const navigate = useNavigate()
  const [list, setList] = useState<CheckoutRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ applicationId: '', reason: '' })
  const pageSize = 10

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      if (keyword) params.set('keyword', keyword)
      const res = await fetch(`/api/checkouts?${params}`)
      if (!res.ok) throw new Error()
      const data: PaginatedResult<Checkout> = await res.json()
      setList(data.list)
      setTotal(data.total)
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [page, status, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!form.applicationId) return alert('请输入申请ID')
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setShowModal(false)
      setForm({ applicationId: '', reason: '' })
      fetchData()
    } catch { alert('提交失败') }
    finally { setSubmitting(false) }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">退宿管理</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> 新建退宿
        </button>
      </div>

      <div className="card p-4 flex items-center gap-4">
        <select className="select-field w-32" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="搜索..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3">申请人</th>
              <th className="px-4 py-3">房间</th>
              <th className="px-4 py-3">申请日期</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={5} className="table-cell text-center text-gray-400">暂无数据</td></tr>
            ) : list.map(co => (
              <tr key={co.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{(co as CheckoutRow).employeeName || '-'}</td>
                <td className="table-cell">{(co as CheckoutRow).roomNumber || '-'}</td>
                <td className="table-cell">{new Date(co.createdAt).toLocaleDateString('zh-CN')}</td>
                <td className="table-cell"><span className={statusBadgeClass(co.status)}>{formatStatus(co.status)}</span></td>
                <td className="table-cell">
                  <button className="text-[#1E3A5F] hover:underline text-sm font-medium" onClick={() => navigate(`/checkout/${co.id}`)}>处理</button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">新建退宿</h2>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">入住申请ID</label>
              <input className="input-field" value={form.applicationId} onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))} placeholder="输入申请ID" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">退宿原因</label>
              <textarea className="input-field" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="请输入退宿原因..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-outline" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>{submitting ? '提交中...' : '提交'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
