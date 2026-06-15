import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, History, FileDown, RotateCcw, Building, BedDouble, Users, Eye, ChevronDown, ChevronRight, X, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'
import type {
  PreviewResult,
  ImportHistory,
  ConfirmResult,
  ImportError,
  PreviewBuildItem,
  PreviewRoomItem,
  ImportHistoryDetail,
  RollbackPreviewResult,
  FailedRow,
  CreatedBuilding,
  CreatedRoom,
} from '@/types'
import Modal from '@/components/Modal'

const TEMPLATE_COLUMNS = ['楼栋名称', '性别', '楼层数', '楼层号', '房间号', '房型']
const TABS = [
  { key: 'import', label: '导入', icon: Upload },
  { key: 'history', label: '历史', icon: History },
  { key: 'template', label: '下载模板', icon: FileDown },
] as const

type TabKey = typeof TABS[number]['key']

export default function DormitoryImport() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('import')
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([])
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null)
  const [histories, setHistories] = useState<ImportHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [rollbackId, setRollbackId] = useState<string | null>(null)

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailData, setDetailData] = useState<ImportHistoryDetail | null>(null)
  const [detailTab, setDetailTab] = useState<'buildings' | 'rooms' | 'failed'>('buildings')
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [rollbackModalOpen, setRollbackModalOpen] = useState(false)
  const [rollbackPreviewData, setRollbackPreviewData] = useState<RollbackPreviewResult | null>(null)
  const [loadingRollbackPreview, setLoadingRollbackPreview] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [rollbackExpandBuildings, setRollbackExpandBuildings] = useState(false)
  const [rollbackExpandRooms, setRollbackExpandRooms] = useState(false)
  const [rollbackExpandBeds, setRollbackExpandBeds] = useState(false)

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/buildings/import-history')
      if (res.ok) {
        const data = await res.json()
        setHistories(Array.isArray(data) ? data : [])
      }
    } catch {
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab])

  const parseFile = (file: File) => {
    setFileName(file.name)
    setPreview(null)
    setConfirmResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      setRawData(raw)
      if (raw.length > 0) {
        doPreview(raw, file.name)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const doPreview = async (data: Record<string, unknown>[], fn: string) => {
    setPreviewing(true)
    try {
      const res = await fetch('/api/buildings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, filename: fn }),
      })
      if (!res.ok) throw new Error()
      const result: PreviewResult = await res.json()
      setPreview(result)
    } catch {
      alert('预览请求失败')
    } finally {
      setPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConfirming(true)
    try {
      const res = await fetch('/api/buildings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewId: preview.previewId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '确认失败' }))
        alert(err.error || '确认失败')
        return
      }
      const result: ConfirmResult = await res.json()
      setConfirmResult(result)
      setPreview(null)
      setRawData([])
      setFileName('')
    } catch {
      alert('确认请求失败')
    } finally {
      setConfirming(false)
    }
  }

  const fetchImportDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/buildings/import-history/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailData(data)
      }
    } catch {
      alert('获取详情失败')
    } finally {
      setLoadingDetail(false)
    }
  }

  const openDetailModal = async (id: string) => {
    setDetailTab('buildings')
    setDetailData(null)
    setDetailModalOpen(true)
    await fetchImportDetail(id)
  }

  const fetchRollbackPreview = async (id: string) => {
    setLoadingRollbackPreview(true)
    try {
      const res = await fetch(`/api/buildings/import-history/${id}/rollback-preview`)
      if (res.ok) {
        const data = await res.json()
        setRollbackPreviewData(data)
      }
    } catch {
      alert('获取撤回预览失败')
    } finally {
      setLoadingRollbackPreview(false)
    }
  }

  const openRollbackModal = async (id: string) => {
    setRollbackId(id)
    setRollbackPreviewData(null)
    setRollbackExpandBuildings(false)
    setRollbackExpandRooms(false)
    setRollbackExpandBeds(false)
    setRollbackModalOpen(true)
    await fetchRollbackPreview(id)
  }

  const closeRollbackModal = () => {
    setRollbackModalOpen(false)
    setRollbackId(null)
    setRollbackPreviewData(null)
  }

  const doRollback = async () => {
    if (!rollbackId || !rollbackPreviewData?.canRollback) return
    setRollingBack(true)
    try {
      const res = await fetch(`/api/buildings/import-history/${rollbackId}/rollback`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '撤回失败' }))
        alert(err.error || '撤回失败')
        return
      }
      await fetchHistory()
      closeRollbackModal()
    } catch {
      alert('撤回请求失败')
    } finally {
      setRollingBack(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleDownloadTemplate = () => {
    const templateData = [
      { '楼栋名称': '男生宿舍3号楼', '性别': '男', '楼层数': 3, '楼层号': 1, '房间号': '101', '房型': '单人间' },
      { '楼栋名称': '男生宿舍3号楼', '性别': '男', '楼层数': 3, '楼层号': 1, '房间号': '102', '房型': '双人间' },
      { '楼栋名称': '女生宿舍3号楼', '性别': '女', '楼层数': 2, '楼层号': 1, '房间号': '101', '房型': '四人间' },
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(templateData)
    ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 14 }))
    XLSX.utils.book_append_sheet(wb, ws, '导入模板')
    XLSX.writeFile(wb, '宿舍导入模板.xlsx')
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  }

  const formatType = (t: string) => {
    const map: Record<string, string> = { single: '单人间', double: '双人间', quad: '四人间', 单人间: '单人间', 双人间: '双人间', 四人间: '四人间' }
    return map[t] || t
  }

  const genderLabel = (g: string) => g === 'male' || g === '男' ? '男' : '女'

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">批量导入</h1>
      </div>

      <div className="card p-1 inline-flex gap-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-[#1E3A5F] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'import' && (
        <div className="space-y-4">
          <div
            className={`card p-8 border-2 border-dashed transition-colors ${dragOver ? 'border-[#1E3A5F] bg-blue-50' : 'border-gray-300'} ${previewing ? 'opacity-60 pointer-events-none' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-center">
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">拖拽文件到此处，或 <span className="text-[#1E3A5F] font-medium cursor-pointer">点击上传</span></p>
              <p className="text-xs text-gray-400 mt-1">支持 .xlsx / .csv 格式</p>
              {fileName && <p className="text-xs text-emerald-600 mt-2 flex items-center justify-center gap-1"><FileSpreadsheet className="w-3 h-3" /> {fileName}</p>}
              {previewing && <p className="text-sm text-[#1E3A5F] mt-2 animate-pulse">正在校验数据...</p>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]) }} />
          </div>

          {confirmResult && (
            <div className="card p-4">
              <div className="flex items-center gap-6 mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm">成功导入: <strong className="text-emerald-600">{confirmResult.successCount}</strong> 间</span>
                </div>
                {confirmResult.failedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm">校验失败: <strong className="text-red-600">{confirmResult.failedCount}</strong> 行</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">导入完成，可在"历史"标签页查看记录</p>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">预览结果</h3>
                  <button
                    className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    onClick={handleConfirm}
                    disabled={confirming || preview.rooms.length === 0}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {confirming ? '确认导入中...' : `确认导入 (${preview.rooms.length} 间)`}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Building className="w-4 h-4" /> 新增楼栋
                    </div>
                    <div className="text-2xl font-bold text-[#1E3A5F]">{preview.buildings.length}</div>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <BedDouble className="w-4 h-4" /> 新增房间
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{preview.rooms.length}</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Users className="w-4 h-4" /> 新增床位
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {preview.rooms.reduce((sum, r) => sum + r.capacity, 0)}
                    </div>
                  </div>
                </div>
              </div>

              {preview.buildings.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">新增楼栋列表</h3>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="table-header">
                          <th className="px-3 py-2 text-left">楼栋名称</th>
                          <th className="px-3 py-2 text-left">性别</th>
                          <th className="px-3 py-2 text-left">楼层数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.buildings.map((b: PreviewBuildItem, i: number) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{b.name}</td>
                            <td className="px-3 py-2 text-gray-700">{genderLabel(b.gender)}</td>
                            <td className="px-3 py-2 text-gray-700">{b.floors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.rooms.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">新增房间列表</h3>
                  </div>
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="table-header">
                          <th className="px-3 py-2 text-left">所属楼栋</th>
                          <th className="px-3 py-2 text-left">楼层</th>
                          <th className="px-3 py-2 text-left">房号</th>
                          <th className="px-3 py-2 text-left">房型</th>
                          <th className="px-3 py-2 text-left">床位数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rooms.map((r: PreviewRoomItem, i: number) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{r.buildingName}</td>
                            <td className="px-3 py-2 text-gray-700">{r.floor}</td>
                            <td className="px-3 py-2 text-gray-700">{r.roomNumber}</td>
                            <td className="px-3 py-2 text-gray-700">{formatType(r.dormitoryType)}</td>
                            <td className="px-3 py-2 text-gray-700">{r.capacity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-bold text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      错误明细 ({preview.errors.length} 条)
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="table-header">
                          <th className="px-3 py-2 w-16">行号</th>
                          <th className="px-3 py-2 text-left">错误原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.errors.map((e: ImportError, i: number) => (
                          <tr key={i} className="border-b border-gray-50 bg-red-50">
                            <td className="px-3 py-2 text-center text-red-600 font-bold">{e.row}</td>
                            <td className="px-3 py-2 text-red-700">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          {loadingHistory ? (
            <div className="p-12 text-center text-gray-400">加载中...</div>
          ) : histories.length === 0 ? (
            <div className="p-12 text-center text-gray-400">暂无导入记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">导入时间</th>
                    <th className="px-4 py-3 text-left">文件名</th>
                    <th className="px-4 py-3 text-left">操作人</th>
                    <th className="px-4 py-3 text-center">成功</th>
                    <th className="px-4 py-3 text-center">失败</th>
                    <th className="px-4 py-3 text-left">状态</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {histories.map(h => (
                    <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{formatTime(h.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-gray-400" /> {h.fileName}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{h.operator}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-600 font-medium">{h.successCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={h.failedCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {h.failedCount}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.status === 'confirmed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {h.status === 'confirmed' ? '已确认' : '已撤回'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-md text-[#1E3A5F] hover:bg-blue-50 transition-colors"
                            onClick={() => openDetailModal(h.id)}
                          >
                            <Eye className="w-3 h-3" />
                            详情
                          </button>
                          <button
                            className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-md transition-colors ${
                              h.status === 'confirmed'
                                ? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                            onClick={() => h.status === 'confirmed' && openRollbackModal(h.id)}
                            disabled={h.status !== 'confirmed' || rollbackId === h.id}
                          >
                            <RotateCcw className="w-3 h-3" />
                            {rollbackId === h.id ? '撤回中...' : '撤回'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'template' && (
        <div className="card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-[#1E3A5F] bg-opacity-10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-8 h-8 text-[#1E3A5F]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">导入模板说明</h3>
              <p className="text-sm text-gray-500 mb-3">
                请按照模板格式填写数据，支持 .xlsx 和 .csv 格式的Excel文件。
              </p>
              <button
                className="btn-primary inline-flex items-center gap-2 text-sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="w-4 h-4" /> 下载模板
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h4 className="font-bold text-gray-900 mb-4">字段说明</h4>
            <div className="space-y-3">
              {[
                { name: '楼栋名称', desc: '楼栋的名称，如"男生宿舍3号楼"', required: true },
                { name: '性别', desc: '性别，男/女，男/male 或 女/female', required: true },
                { name: '楼层数', desc: '楼栋总楼层数', required: false },
                { name: '楼层号', desc: '房间所在楼层号，从1开始', required: true },
                { name: '房间号', desc: '房间编号，如"101"', required: true },
                { name: '房型', desc: '单人间/双人间/四人间', required: true },
              ].map(item => (
                <div key={item.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900 w-24 flex-shrink-0">{item.name}</div>
                  <div className="text-sm text-gray-600 flex-1">{item.desc}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    item.required ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {item.required ? '必填' : '可选'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="导入详情"
        width="max-w-3xl"
      >
        {loadingDetail ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !detailData ? (
          <div className="p-8 text-center text-gray-400">暂无数据</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-500">文件名：</span>
                <span className="font-medium text-gray-900 flex items-center gap-1">
                  <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                  {detailData.fileName}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500">操作人：</span>
                <span className="font-medium text-gray-900">{detailData.operator}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Building className="w-4 h-4" /> 新增楼栋
                </div>
                <div className="text-2xl font-bold text-[#1E3A5F]">{detailData.createdBuildings.length}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <BedDouble className="w-4 h-4" /> 新增房间
                </div>
                <div className="text-2xl font-bold text-emerald-600">{detailData.createdRooms.length}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Users className="w-4 h-4" /> 新增床位
                </div>
                <div className="text-2xl font-bold text-orange-600">{detailData.createdBeds.length}</div>
              </div>
            </div>

            <div className="border-b border-gray-200">
              <div className="flex gap-1">
                {[
                  { key: 'buildings', label: `新增楼栋 (${detailData.createdBuildings.length})` },
                  { key: 'rooms', label: `新增房间 (${detailData.createdRooms.length})` },
                  { key: 'failed', label: `失败明细 (${detailData.failedRows.length})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key as any)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab.key
                        ? 'border-[#1E3A5F] text-[#1E3A5F]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {detailTab === 'buildings' && (
                detailData.createdBuildings.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">暂无新增楼栋</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="table-header">
                        <th className="px-3 py-2 text-left">楼栋名称</th>
                        <th className="px-3 py-2 text-left">性别</th>
                        <th className="px-3 py-2 text-left">楼层数</th>
                        <th className="px-3 py-2 text-left">房间数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.createdBuildings.map((b: CreatedBuilding, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{b.name}</td>
                          <td className="px-3 py-2 text-gray-700">{genderLabel(b.gender)}</td>
                          <td className="px-3 py-2 text-gray-700">{b.floors}</td>
                          <td className="px-3 py-2 text-gray-700">{b.totalRooms}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {detailTab === 'rooms' && (
                detailData.createdRooms.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">暂无新增房间</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="table-header">
                        <th className="px-3 py-2 text-left">所属楼栋</th>
                        <th className="px-3 py-2 text-left">楼层</th>
                        <th className="px-3 py-2 text-left">房号</th>
                        <th className="px-3 py-2 text-left">房型</th>
                        <th className="px-3 py-2 text-left">床位数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.createdRooms.map((r: CreatedRoom, i: number) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{r.buildingName}</td>
                          <td className="px-3 py-2 text-gray-700">{r.floor}</td>
                          <td className="px-3 py-2 text-gray-700">{r.roomNumber}</td>
                          <td className="px-3 py-2 text-gray-700">{formatType(r.dormitoryType)}</td>
                          <td className="px-3 py-2 text-gray-700">{r.bedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {detailTab === 'failed' && (
                detailData.failedRows.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">暂无失败记录</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="table-header">
                        <th className="px-3 py-2 w-16">行号</th>
                        <th className="px-3 py-2 text-left">原始数据</th>
                        <th className="px-3 py-2 text-left">错误原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.failedRows.map((row: FailedRow, i: number) => (
                        <tr key={i} className="border-b border-gray-50 bg-red-50">
                          <td className="px-3 py-2 text-center text-red-600 font-bold align-top">{row.row}</td>
                          <td className="px-3 py-2 text-gray-700 align-top">
                            <div className="text-xs space-y-0.5">
                              {Object.entries(row.data).slice(0, 4).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-gray-500">{key}：</span>
                                  <span>{String(value || '')}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-red-700 align-top">{row.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rollbackModalOpen}
        onClose={closeRollbackModal}
        title="撤回确认"
        width="max-w-lg"
      >
        {loadingRollbackPreview ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !rollbackPreviewData ? (
          <div className="p-8 text-center text-gray-400">暂无数据</div>
        ) : (
          <div className="space-y-4">
            {!rollbackPreviewData.canRollback ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">无法撤回</h4>
                    <p className="text-sm text-red-700 mt-1">{rollbackPreviewData.reason}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">风险提示</h4>
                    <p className="text-sm text-yellow-700 mt-1">{rollbackPreviewData.riskWarning}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">删除楼栋</div>
                <div className="text-xl font-bold text-[#1E3A5F]">{rollbackPreviewData.buildingCount}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">删除房间</div>
                <div className="text-xl font-bold text-emerald-600">{rollbackPreviewData.roomCount}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1">删除床位</div>
                <div className="text-xl font-bold text-orange-600">{rollbackPreviewData.bedCount}</div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setRollbackExpandBuildings(!rollbackExpandBuildings)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700">楼栋列表 ({rollbackPreviewData.buildingCount})</span>
                {rollbackExpandBuildings ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {rollbackExpandBuildings && (
                <div className="pl-4 pr-2 py-2 space-y-1 max-h-32 overflow-y-auto">
                  {rollbackPreviewData.buildingNames.map((name, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <Building className="w-3 h-3 text-gray-400" /> {name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setRollbackExpandRooms(!rollbackExpandRooms)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700">房间列表 ({rollbackPreviewData.roomCount})</span>
                {rollbackExpandRooms ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {rollbackExpandRooms && (
                <div className="pl-4 pr-2 py-2 space-y-1 max-h-40 overflow-y-auto">
                  {rollbackPreviewData.rooms.map((r, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <BedDouble className="w-3 h-3 text-gray-400" />
                      {r.buildingName} - {r.floor}层 - {r.roomNumber}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setRollbackExpandBeds(!rollbackExpandBeds)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700">床位列表 ({rollbackPreviewData.bedCount})</span>
                {rollbackExpandBeds ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {rollbackExpandBeds && (
                <div className="pl-4 pr-2 py-2 space-y-1 max-h-40 overflow-y-auto">
                  {rollbackPreviewData.beds.map((b, i) => (
                    <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <Users className="w-3 h-3 text-gray-400" />
                      {b.buildingName} - {b.roomNumber} - {b.bedNumber}号床
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={closeRollbackModal}
                className="flex-1 btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={doRollback}
                disabled={!rollbackPreviewData.canRollback || rollingBack}
                className="flex-1 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rollingBack ? '撤回中...' : '确认撤回'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
