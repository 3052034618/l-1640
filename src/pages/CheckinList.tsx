import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import type { Application, PaginatedResult } from '@/types'
import { formatStatus, statusBadgeClass } from '@/lib/helpers'

const GENDER_MAP: Record<string, string> = { male: '男', female: '女' }
const DORM_TYPE_MAP: Record<string, string> = { single: '单人间', double: '双人间', quad: '四人间' }

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'assigned', label: '已分配' },
  { value: 'rejected', label: '已拒绝' },
]

export default function CheckinList() {
  const navigate = useNavigate()
  const [list, setList] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const pageSize = 10

  const [form, setForm] = useState({ employeeId: '', gender: 'male', department: '', position: '', dormitoryType: 'single', expectedDate: '' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (status) params.set('status', status)
      if (keyword) params.set('keyword', keyword)
      const res = await fetch(`/api/applications?${params}`)
      if (!res.ok) throw new Error()
      const data: PaginatedResult<Application> = await res.json()
      setList(data.list)
      setTotal(data.total)
    } catch { setList([]) }
    finally { setLoading(false) }
  }, [page, status, keyword])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!form.employeeId || !form.expectedDate) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setShowModal(false)
      setForm({ employeeId: '', gender: 'male', department: '', position: '', dormitoryType: 'single', expectedDate: '' })
      fetchData()
    } catch { alert('提交失败') }
    finally { setSubmitting(false) }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">入住管理</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> 新建申请
        </button>
      </div>

      <div className="card p-4 flex items-center gap-4">
        <select className="select-field w-32" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="搜索申请人..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3">申请人</th>
              <th className="px-4 py-3">性别</th>
              <th className="px-4 py-3">部门</th>
              <th className="px-4 py-3">职位</th>
              <th className="px-4 py-3">房型</th>
              <th className="px-4 py-3">申请日期</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="table-cell"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
            )) : list.length === 0 ? (
              <tr><td colSpan={8} className="table-cell text-center text-gray-400">暂无数据</td></tr>
            ) : list.map(app => (
              <tr key={app.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{app.employee?.name || '-'}</td>
                <td className="table-cell">{GENDER_MAP[app.gender] || app.gender}</td>
                <td className="table-cell">{app.department}</td>
                <td className="table-cell">{app.position}</td>
                <td className="table-cell">{DORM_TYPE_MAP[app.dormitoryType] || app.dormitoryType}</td>
                <td className="table-cell">{new Date(app.createdAt).toLocaleDateString('zh-CN')}</td>
                <td className="table-cell"><span className={statusBadgeClass(app.status)}>{formatStatus(app.status)}</span></td>
                <td className="table-cell">
                  {app.status === 'pending' ? (
                    <button className="text-[#1E3A5F] hover:underline text-sm font-medium" onClick={() => navigate(`/checkin/${app.id}`)}>审批</button>
                  ) : (
                    <button className="text-[#1E3A5F] hover:underline text-sm" onClick={() => navigate(`/checkin/${app.id}`)}>查看</button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">新建入住申请</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">员工ID</label>
                <input className="input-field" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} placeholder="输入员工ID" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">性别</label>
                  <select className="select-field" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option value="">请选择</option><option value="male">男</option><option value="female">女</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">房型</label>
                  <select className="select-field" value={form.dormitoryType} onChange={e => setForm(f => ({ ...f, dormitoryType: e.target.value }))}>
                    <option value="single">单人间</option><option value="double">双人间</option><option value="quad">四人间</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">部门</label>
                <input className="input-field" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="部门" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">职位</label>
                <input className="input-field" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="职位" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">期望入住日期</label>
                <input type="date" className="input-field" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} />
              </div>
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
