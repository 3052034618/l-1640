import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X, Printer, Download, Users, Star, ChevronRight, Settings, Wand2, Plus, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import type { Application, DepartmentPriority, BuildingPreference, ForbiddenRule, AssignmentRuleData, AutoAssignResult, MatchBedsResult, ForbiddenBuildingInfo } from '@/types'
import { formatStatus, statusBadgeClass } from '@/lib/helpers'
import Modal from '@/components/Modal'
import { v4 as uuidv4 } from 'uuid'

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

type RuleTab = 'priority' | 'preference' | 'forbidden'

export default function CheckinDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = useState<Application | null>(null)
  const [beds, setBeds] = useState<MatchedBed[]>([])
  const [forbiddenBuildings, setForbiddenBuildings] = useState<ForbiddenBuildingInfo[]>([])
  const [selectedBed, setSelectedBed] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activePriority, setActivePriority] = useState<string>('all')
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [rulesData, setRulesData] = useState<AssignmentRuleData | null>(null)
  const [rulesTab, setRulesTab] = useState<RuleTab>('priority')
  const [savingRules, setSavingRules] = useState(false)
  const [autoAssignReason, setAutoAssignReason] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [conflictError, setConflictError] = useState('')
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [refreshBedsKey, setRefreshBedsKey] = useState(0)

  const loadApplicationAndBeds = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/applications/${id}`).then(r => r.json()) as Promise<Application>,
      fetch(`/api/applications/${id}/match-beds`).then(r => r.json()) as Promise<MatchBedsResult>,
    ]).then(([appData, bedData]) => {
      setApp(appData)
      setBeds(bedData.beds || [])
      setForbiddenBuildings(bedData.forbiddenBuildings || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadApplicationAndBeds()
  }, [id, refreshBedsKey])

  const loadRules = async () => {
    try {
      const res = await fetch('/api/applications/rules')
      if (res.ok) {
        const data = await res.json() as AssignmentRuleData
        setRulesData(data)
      }
    } catch {}
  }

  const handleOpenRules = () => {
    loadRules()
    setShowRulesModal(true)
  }

  const handleSaveRules = async () => {
    if (!rulesData) return
    setSavingRules(true)
    try {
      const res = await fetch('/api/applications/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentPriorities: rulesData.departmentPriorities,
          buildingPreferences: rulesData.buildingPreferences,
          forbiddenRules: rulesData.forbiddenRules,
        }),
      })
      if (res.ok) {
        setShowRulesModal(false)
        setRefreshBedsKey(k => k + 1)
        alert('规则保存成功')
      } else {
        alert('保存失败')
      }
    } catch {
      alert('保存失败')
    } finally {
      setSavingRules(false)
    }
  }

  const addDeptPriority = () => {
    if (!rulesData) return
    setRulesData({
      ...rulesData,
      departmentPriorities: [
        ...rulesData.departmentPriorities,
        { id: uuidv4(), department: rulesData.departments[0] || '', priority: 5 },
      ],
    })
  }

  const updateDeptPriority = (idx: number, field: 'department' | 'priority', value: string | number) => {
    if (!rulesData) return
    const updated = [...rulesData.departmentPriorities]
    updated[idx] = { ...updated[idx], [field]: value } as DepartmentPriority
    setRulesData({ ...rulesData, departmentPriorities: updated })
  }

  const removeDeptPriority = (idx: number) => {
    if (!rulesData) return
    const updated = rulesData.departmentPriorities.filter((_, i) => i !== idx)
    setRulesData({ ...rulesData, departmentPriorities: updated })
  }

  const addBuildingPref = () => {
    if (!rulesData) return
    setRulesData({
      ...rulesData,
      buildingPreferences: [
        ...rulesData.buildingPreferences,
        { id: uuidv4(), department: rulesData.departments[0] || '', buildingId: rulesData.buildings[0]?.id || '', priority: 5 },
      ],
    })
  }

  const updateBuildingPref = (idx: number, field: string, value: string | number) => {
    if (!rulesData) return
    const updated = [...rulesData.buildingPreferences]
    updated[idx] = { ...updated[idx], [field]: value } as BuildingPreference
    setRulesData({ ...rulesData, buildingPreferences: updated })
  }

  const removeBuildingPref = (idx: number) => {
    if (!rulesData) return
    const updated = rulesData.buildingPreferences.filter((_, i) => i !== idx)
    setRulesData({ ...rulesData, buildingPreferences: updated })
  }

  const addForbiddenRule = () => {
    if (!rulesData) return
    setRulesData({
      ...rulesData,
      forbiddenRules: [
        ...rulesData.forbiddenRules,
        { id: uuidv4(), department: rulesData.departments[0] || '', buildingId: rulesData.buildings[0]?.id || '', reason: '' },
      ],
    })
  }

  const updateForbiddenRule = (idx: number, field: string, value: string) => {
    if (!rulesData) return
    const updated = [...rulesData.forbiddenRules]
    updated[idx] = { ...updated[idx], [field]: value } as ForbiddenRule
    setRulesData({ ...rulesData, forbiddenRules: updated })
  }

  const removeForbiddenRule = (idx: number) => {
    if (!rulesData) return
    const updated = rulesData.forbiddenRules.filter((_, i) => i !== idx)
    setRulesData({ ...rulesData, forbiddenRules: updated })
  }

  const handleAutoAssign = async () => {
    if (!id) return
    setAutoAssigning(true)
    setConflictError('')
    try {
      const res = await fetch(`/api/applications/${id}/auto-assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || '自动分配失败')
        return
      }
      const result = await res.json() as AutoAssignResult
      setSelectedBed(result.bed.id)
      setAutoAssignReason(result.assignReason)
    } catch {
      alert('自动分配失败')
    } finally {
      setAutoAssigning(false)
    }
  }

  const handleApprove = () => {
    if (!selectedBed) {
      alert('请选择床位')
      return
    }
    setConflictError('')
    setShowConfirmModal(true)
  }

  const confirmApprove = async () => {
    if (!selectedBed || !id) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/applications/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedId: selectedBed, assignReason: autoAssignReason }),
      })
      if (res.status === 409) {
        const err = await res.json().catch(() => ({}))
        setConflictError(err.reason || '床位分配冲突')
        setRefreshBedsKey(k => k + 1)
        setSelectedBed('')
        setAutoAssignReason('')
        setShowConfirmModal(false)
        return
      }
      if (!res.ok) throw new Error()
      const updated = await res.json() as Application
      setApp(updated)
      setShowConfirmModal(false)
    } catch {
      alert('操作失败')
    } finally {
      setSubmitting(false)
    }
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
        app?.assignReason ? `Reason: ${app.assignReason}` : '',
      ].filter(Boolean)
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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">申请详情</h2>
          <button
            className="btn-outline flex items-center gap-1 text-sm"
            onClick={handleOpenRules}
          >
            <Settings className="w-4 h-4" /> 分配规则
          </button>
        </div>
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
          {app.assignReason && app.status === 'assigned' && (
            <div className="col-span-3">
              <span className="text-gray-500">分配原因：</span>
              <span className="text-blue-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {app.assignReason}
              </span>
            </div>
          )}
        </div>
      </div>

      {app.status === 'pending' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">推荐床位</h3>
            <div className="flex items-center gap-3">
              <button
                className="btn-outline flex items-center gap-1 text-sm"
                onClick={handleAutoAssign}
                disabled={autoAssigning}
              >
                <Wand2 className={`w-4 h-4 ${autoAssigning ? 'animate-spin' : ''}`} />
                {autoAssigning ? '分配中...' : '一键自动分配'}
              </button>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>按部门规则排序（{app.department}优先同部门房间）</span>
              </div>
            </div>
          </div>

          {forbiddenBuildings.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700">
                <div className="font-medium mb-1">禁住规则提示：</div>
                {forbiddenBuildings.map((fb, i) => (
                  <div key={i}>• {fb.buildingName}：{fb.reason}</div>
                ))}
              </div>
            </div>
          )}

          {conflictError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700">
                <div className="font-medium mb-1">审批冲突：</div>
                <div>{conflictError}（候选床位已刷新，请重新选择）</div>
              </div>
            </div>
          )}

          {autoAssignReason && selectedBed && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <div className="font-medium mb-1">分配原因：</div>
                <div>{autoAssignReason}</div>
              </div>
            </div>
          )}

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
                    onClick={() => {
                      setSelectedBed(bed.id)
                      setAutoAssignReason('')
                      setConflictError('')
                    }}>
                    <div className="flex items-center gap-3">
                      <input type="radio" name="bed" checked={selectedBed === bed.id} onChange={() => {
                        setSelectedBed(bed.id)
                        setAutoAssignReason('')
                        setConflictError('')
                      }} className="accent-[#1E3A5F]" />
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
                {app.assignReason && (
                  <p className="text-yellow-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    分配原因：{app.assignReason}
                  </p>
                )}
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

      <Modal open={showRulesModal} onClose={() => setShowRulesModal(false)} title="分配规则配置" width="max-w-3xl">
        {rulesData ? (
          <>
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              {[
                { key: 'priority' as RuleTab, label: '部门优先级' },
                { key: 'preference' as RuleTab, label: '楼栋偏好' },
                { key: 'forbidden' as RuleTab, label: '禁住规则' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    rulesTab === tab.key
                      ? 'border-[#1E3A5F] text-[#1E3A5F]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setRulesTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {rulesTab === 'priority' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-gray-500">数值越大优先级越高（1-10）</p>
                  <button className="btn-outline text-xs py-1 flex items-center gap-1" onClick={addDeptPriority}>
                    <Plus className="w-3 h-3" /> 新增
                  </button>
                </div>
                <div className="space-y-2">
                  {rulesData.departmentPriorities.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">暂无部门优先级配置</p>
                  ) : (
                    rulesData.departmentPriorities.map((dp, idx) => (
                      <div key={dp.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                        <select
                          className="input-field text-sm py-1.5 flex-1"
                          value={dp.department}
                          onChange={e => updateDeptPriority(idx, 'department', e.target.value)}
                        >
                          {rulesData.departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">优先级:</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className="input-field text-sm py-1.5 w-20 text-center"
                            value={dp.priority}
                            onChange={e => updateDeptPriority(idx, 'priority', Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                          />
                        </div>
                        <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => removeDeptPriority(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {rulesTab === 'preference' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-gray-500">数值越大偏好越强（1-10），偏好楼栋的床位优先推荐</p>
                  <button className="btn-outline text-xs py-1 flex items-center gap-1" onClick={addBuildingPref}>
                    <Plus className="w-3 h-3" /> 新增
                  </button>
                </div>
                <div className="space-y-2">
                  {rulesData.buildingPreferences.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">暂无楼栋偏好配置</p>
                  ) : (
                    rulesData.buildingPreferences.map((bp, idx) => (
                      <div key={bp.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg">
                        <select
                          className="input-field text-sm py-1.5 flex-1"
                          value={bp.department}
                          onChange={e => updateBuildingPref(idx, 'department', e.target.value)}
                        >
                          {rulesData.departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <span className="text-xs text-gray-400">→</span>
                        <select
                          className="input-field text-sm py-1.5 flex-1"
                          value={bp.buildingId}
                          onChange={e => updateBuildingPref(idx, 'buildingId', e.target.value)}
                        >
                          {rulesData.buildings.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">权重:</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className="input-field text-sm py-1.5 w-20 text-center"
                            value={bp.priority}
                            onChange={e => updateBuildingPref(idx, 'priority', Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                          />
                        </div>
                        <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => removeBuildingPref(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {rulesTab === 'forbidden' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-gray-500">被禁住部门无法选择对应楼栋的床位</p>
                  <button className="btn-outline text-xs py-1 flex items-center gap-1" onClick={addForbiddenRule}>
                    <Plus className="w-3 h-3" /> 新增
                  </button>
                </div>
                <div className="space-y-2">
                  {rulesData.forbiddenRules.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">暂无禁住规则</p>
                  ) : (
                    rulesData.forbiddenRules.map((fr, idx) => (
                      <div key={fr.id} className="p-2 border border-gray-200 rounded-lg space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            className="input-field text-sm py-1.5 flex-1"
                            value={fr.department}
                            onChange={e => updateForbiddenRule(idx, 'department', e.target.value)}
                          >
                            {rulesData.departments.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          <span className="text-xs text-gray-400">禁止入住</span>
                          <select
                            className="input-field text-sm py-1.5 flex-1"
                            value={fr.buildingId}
                            onChange={e => updateForbiddenRule(idx, 'buildingId', e.target.value)}
                          >
                            {rulesData.buildings.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => removeForbiddenRule(idx)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          className="input-field text-sm py-1.5 w-full"
                          placeholder="请输入禁住原因..."
                          value={fr.reason}
                          onChange={e => updateForbiddenRule(idx, 'reason', e.target.value)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
              <button className="btn-outline" onClick={() => setShowRulesModal(false)}>取消</button>
              <button className="btn-primary" disabled={savingRules} onClick={handleSaveRules}>
                {savingRules ? '保存中...' : '保存规则'}
              </button>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        )}
      </Modal>

      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="确认分配" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">确认将以下床位分配给 <strong>{app.employee?.name}</strong> 吗？</p>
          {selectedBed && (() => {
            const bed = beds.find(b => b.id === selectedBed)
            if (!bed) return null
            return (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="font-medium text-sm mb-1">
                  {bed.buildingName} {bed.roomNumber} - {bed.bedNumber}号床
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>楼层：{bed.floor}F | 房型：{DORM_TYPE_MAP[bed.dormitoryType]}</div>
                  <div>当前入住：{bed.roomOccupants}/{bed.roomCapacity}</div>
                </div>
              </div>
            )
          })()}
          {(autoAssignReason || (() => {
            const bed = beds.find(b => b.id === selectedBed)
            return bed?.priorityReason
          })()) && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 分配原因：
              </div>
              <div className="text-xs text-amber-600">
                {autoAssignReason || beds.find(b => b.id === selectedBed)?.priorityReason}
              </div>
            </div>
          )}
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
            <p className="font-medium mb-1">📧 通知信息：</p>
            <p>将向员工 {app.employee?.name} 发送入住通知，包含：</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-500">
              <li>分配的床位信息</li>
              <li>入住日期与到期日期</li>
              <li>分配原因说明</li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <button className="btn-outline" onClick={() => setShowConfirmModal(false)}>取消</button>
          <button className="btn-primary" disabled={submitting} onClick={confirmApprove}>
            {submitting ? '确认中...' : '确认分配'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
