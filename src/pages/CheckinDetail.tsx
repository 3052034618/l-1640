import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Printer, Download, Users, Star, ChevronRight } from 'lucide-react'
import type { Application } from '@/types'
import { formatStatus, statusBadgeClass } from '@/lib/helpers'

const GENDER_MAP: Record<string, string> = { male: '男', female: '女' }
const DORM_TYPE_MAP: Record<string, string> = { single: '单人间', double: '双人间', quad: '四人间' }
const PRIORITY_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: '推荐', color: 'bg-emerald-100 text-emerald-800' },
  medium: { text: '一般', color: 'bg-blue-100 text-blue-800' },
  low: { text: '不推荐', color: 'bg-gray-100 text-gray-600' },
}

interface MatchedBed {
  id: string
  bedNumber: number
  roomNumber: string
  buildingName: string
  buildingId: string
  floor: number
  dormitoryType: string
  roomOccupants: number
  roomCapacity: number
  occupantDepartments: string[]
  priority: 'high' | 'medium' | 'low'
  priorityReason: string
}

export default function CheckinDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = useState<Application | null>(null)
  const [beds, setBeds] = useState<MatchedBed[]>([])
  const [selectedBed, setSelectedBed] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activePriority, setActivePriority] = useState<string>('all')

  useEffect(() => {
    Promise.all([
      fetch(`/api/applications/${id}`).then(r => r.json()) as Promise<Application>,
      fetch(`/api/applications/${id}/match-beds`).then(r => r.json()) as Promise<{ beds: MatchedBed[]; department: string }>,
    ]).then(([appData, bedData]) => {
      setApp(appData)
      setBeds(bedData.beds || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const handleApprove = async () => {
    if (!selectedBed) return alert('请选择床位')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/applications/${id}/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedId: selectedBed }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setApp(updated)
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return alert('请输入拒绝原因')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/applications/${id}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setApp(updated)
      setShowReject(false)
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const handlePrint = () => window.print()

  const handleDownloadPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF()
      doc.setFont('helvetica')
      doc.setFontSize(18)
      doc.text('Check-in Notice', 20, 20)
      doc.setFontSize(12)
      const lines = [
        `Employee: ${app?.employee?.name || '-'}`,
        `Room: ${(app as any)?.bed?.room?.roomNumber || '-'}`,
        `Bed: ${(app as any)?.bed?.bedNumber || '-'}`,
        `Start: ${app?.startDate || '-'}`,
        `End: ${app?.endDate || '-'}`,
      ]
      lines.forEach((line, i) => doc.text(line, 20, 35 + i * 8))
      doc.save(`checkin-notice-${id}.pdf`)
    })
  }

  const filteredBeds = activePriority === 'all' ? beds : beds.filter(b => b.priority === activePriority)
  const groupedBeds = {
    high: beds.filter(b => b.priority === 'high'),
    medium: beds.filter(b => b.priority === 'medium'),
    low: beds.filter(b => b.priority === 'low'),
  }

  if (loading) return <div className="p-6 space-y-4"><div className="card p-6 h-64 animate-pulse" /></div>
  if (!app) return <div className="p-6 text-center text-red-500">未找到申请</div>

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">申请详情</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">申请人：</span>{app.employee?.name || '-'}</div>
          <div><span className="text-gray-500">性别：</span>{GENDER_MAP[app.gender] || app.gender}</div>
          <div><span className="text-gray-500">部门：</span>{app.department}</div>
          <div><span className="text-gray-500">职位：</span>{app.position}</div>
          <div><span className="text-gray-500">房型：</span>{DORM_TYPE_MAP[app.dormitoryType] || app.dormitoryType}</div>
          <div><span className="text-gray-500">状态：</span><span className={statusBadgeClass(app.status)}>{formatStatus(app.status)}</span></div>
          <div><span className="text-gray-500">申请日期：</span>{new Date(app.createdAt).toLocaleDateString('zh-CN')}</div>
          <div><span className="text-gray-500">期望日期：</span>{app.expectedDate}</div>
          {app.rejectedReason && <div className="col-span-3"><span className="text-gray-500">拒绝原因：</span><span className="text-red-600">{app.rejectedReason}</span></div>}
        </div>
      </div>

      {app.status === 'pending' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">推荐床位</h3>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>按部门规则排序（{app.department}优先同部门房间）</span>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: `全部 (${beds.length})` },
              { key: 'high', label: `推荐 (${groupedBeds.high.length})` },
              { key: 'medium', label: `一般 (${groupedBeds.medium.length})` },
              { key: 'low', label: `不推荐 (${groupedBeds.low.length})` },
            ].map(tab => (
              <button key={tab.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activePriority === tab.key ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                onClick={() => setActivePriority(tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>

          {filteredBeds.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无匹配床位</p>
          ) : (
            <div className="space-y-3 mb-4">
              {filteredBeds.map(bed => {
                const pl = PRIORITY_LABEL[bed.priority]
                return (
                  <label key={bed.id}
                    className={`block p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedBed === bed.id ? 'border-[#1E3A5F] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setSelectedBed(bed.id)}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="bed" checked={selectedBed === bed.id} onChange={() => setSelectedBed(bed.id)} className="accent-[#1E3A5F]" />
                      <span className="font-medium text-sm">{bed.buildingName} {bed.roomNumber} - {bed.bedNumber}号床</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pl.color}`}>{pl.text}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 ml-6">
                      <span>楼层: {bed.floor}F</span>
                      <span>房型: {DORM_TYPE_MAP[bed.dormitoryType] || bed.dormitoryType}</span>
                      <span>入住: {bed.roomOccupants}/{bed.roomCapacity}</span>
                      {bed.occupantDepartments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {bed.occupantDepartments.join('、')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1 ml-6 flex items-center gap-1">
                      {bed.priority === 'high' && <Star className="w-3 h-3 text-emerald-500 fill-emerald-500" />}
                      <span className={bed.priority === 'high' ? 'text-emerald-600 font-medium' : bed.priority === 'low' ? 'text-gray-400' : 'text-gray-500'}>
                        {bed.priorityReason}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-1" disabled={submitting || !selectedBed} onClick={handleApprove}>
              <Check className="w-4 h-4" /> 确认分配
            </button>
            <button className="btn-danger flex items-center gap-1" onClick={() => setShowReject(true)}>
              <X className="w-4 h-4" /> 拒绝
            </button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="card p-6 border-red-200">
          <h3 className="text-sm font-bold text-gray-900 mb-2">拒绝原因</h3>
          <textarea className="input-field mb-3" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="请输入拒绝原因..." />
          <div className="flex gap-2">
            <button className="btn-danger" disabled={submitting} onClick={handleReject}>确认拒绝</button>
            <button className="btn-outline" onClick={() => setShowReject(false)}>取消</button>
          </div>
        </div>
      )}

      {app.status === 'assigned' && (
        <div className="card p-6" id="notice-card">
          <h3 className="text-lg font-bold text-gray-900 mb-4">入住通知</h3>
          <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2A4F7F] text-white p-6 rounded-xl">
            <div className="text-center mb-4">
              <h4 className="text-xl font-bold">员工宿舍入住通知</h4>
              <div className="w-16 h-0.5 bg-white/50 mx-auto mt-2" />
            </div>
            <div className="space-y-2 text-sm">
              <p>尊敬的 <strong>{app.employee?.name}</strong> 先生/女士：</p>
              <p>您已成功申请宿舍，现将入住信息通知如下：</p>
              <div className="bg-white/10 rounded-lg p-4 space-y-1 my-3">
                <p>房间号：{(app as any)?.bed?.room?.roomNumber || '-'}</p>
                <p>床位号：{(app as any)?.bed?.bedNumber || '-'}</p>
                <p>入住日期：{app.startDate || '-'}</p>
                <p>到期日期：{app.endDate || '-'}</p>
              </div>
              <p>请于入住日期当天携带本人证件前往宿舍办理入住手续。</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4 print:hidden">
            <button className="btn-outline flex items-center gap-1" onClick={handlePrint}><Printer className="w-4 h-4" /> 打印</button>
            <button className="btn-outline flex items-center gap-1" onClick={handleDownloadPDF}><Download className="w-4 h-4" /> 下载PDF</button>
          </div>
        </div>
      )}
    </div>
  )
}
