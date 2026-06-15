import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, Droplets, Zap, BedDouble, Plus, Trash2,
  FileSpreadsheet, FileText, AlertTriangle, Wallet, Calculator
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { Checkout, ChecklistItem, DamageItem } from '@/types'
import { formatStatus, statusBadgeClass } from '@/lib/helpers'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const STEPS = ['检查', '确认', '结算', '完成']

interface InvoiceData {
  invoiceNumber: string
  billedAt: string
  employee: {
    id: string
    name: string
    gender: string
    department: string
    position: string
    phone: string
  } | null
  room: {
    buildingName: string
    roomNumber: string
    floor: number
    dormitoryType: string
    bedNumber: number | null
  } | null
  dates: {
    checkinDate: string | null
    checkoutDate: string
    applyDate: string
  }
  checklistSummary: {
    total: number
    pass: number
    fail: number
    items: { itemName: string; status: string; remark: string }[]
  }
  utilities: {
    water: { previousReading: number; currentReading: number; usage: number; unitPrice: number; fee: number }
    electric: { previousReading: number; currentReading: number; usage: number; unitPrice: number; fee: number }
  }
  facilityDamages: DamageItem[]
  damagesTotal: number
  deposit: { original: number; deducted: number; remaining: number }
  totalFee: number
  finalFee: number
  paymentStatus: string
}

export default function CheckoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [checkout, setCheckout] = useState<Checkout | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [waterReading, setWaterReading] = useState('')
  const [electricReading, setElectricReading] = useState('')
  const [damages, setDamages] = useState<DamageItem[]>([])
  const [exporting, setExporting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [coRes, clRes] = await Promise.all([
        fetch(`/api/checkouts/${id}`),
        fetch(`/api/checkouts/${id}/checklist`),
      ])
      const coData = await coRes.json()
      const clData = await clRes.json()
      setCheckout(coData)
      setItems(clData.items || [])
      if (coData.waterReading) setWaterReading(String(coData.waterReading))
      if (coData.electricReading) setElectricReading(String(coData.electricReading))
      setDamages(coData.facilityDamages || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [id])

  const stepIndex = ['inspection', 'confirming', 'settling', 'completed'].indexOf(checkout?.status || '')
  const currentStep = stepIndex === -1 ? 0 : stepIndex

  const pendingItems = items.filter(i => i.status === 'pending')
  const hasPendingItems = pendingItems.length > 0

  const wr = Number(waterReading) || 0
  const er = Number(electricReading) || 0
  const pwr = checkout?.previousWaterReading || 0
  const per = checkout?.previousElectricReading || 0

  const waterInvalid = waterReading !== '' && wr < pwr
  const electricInvalid = electricReading !== '' && er < per
  const readingsInvalid = waterInvalid || electricInvalid

  const waterFee = useMemo(() => Math.round(Math.max(0, wr - pwr) * 5 * 100) / 100, [wr, pwr])
  const electricFee = useMemo(() => Math.round(Math.max(0, er - per) * 0.8 * 100) / 100, [er, per])
  const damagesTotal = useMemo(() => Math.round(damages.reduce((s, d) => s + (Number(d.amount) || 0), 0) * 100) / 100, [damages])
  const deposit = checkout?.deposit || 500
  const totalFee = Math.round((waterFee + electricFee + damagesTotal) * 100) / 100
  const depositDeducted = Math.round(Math.min(totalFee, deposit) * 100) / 100
  const finalFee = Math.round((totalFee - depositDeducted) * 100) / 100
  const finalFeeInvalid = finalFee < 0

  const canSettle = !hasPendingItems && !readingsInvalid && !finalFeeInvalid &&
    waterReading !== '' && electricReading !== ''

  const addDamageItem = () => {
    setDamages(prev => [...prev, { id: uuidv4(), name: '', amount: 0, remark: '' }])
  }

  const removeDamageItem = (itemId: string) => {
    setDamages(prev => prev.filter(d => d.id !== itemId))
  }

  const updateDamageItem = (itemId: string, field: keyof DamageItem, value: string | number) => {
    setDamages(prev => prev.map(d =>
      d.id === itemId ? { ...d, [field]: field === 'amount' ? Number(value) || 0 : value } : d
    ))
  }

  const handleChecklistResponse = async (res: Response) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || '操作失败')
    }
    const updated = await res.json()
    setCheckout(updated)
  }

  const saveChecklistAndAdvance = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/checklist`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, advance: true }),
      })
      await handleChecklistResponse(res)
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败')
    }
    finally { setSubmitting(false) }
  }

  const handleSettle = async () => {
    if (!canSettle) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/settle`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waterReading: wr,
          electricReading: er,
          facilityDamages: damages,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '操作失败')
      }
      const updated = await res.json()
      setCheckout(updated)
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败')
    }
    finally { setSubmitting(false) }
  }

  const toggleItem = (itemId: string, status: string) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status } : it))
  }

  const loadInvoice = async (): Promise<InvoiceData | null> => {
    try {
      const res = await fetch(`/api/checkouts/${id}/invoice`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  const genderText = (g: string) => g === 'male' ? '男' : g === 'female' ? '女' : '-'
  const statusText = (s: string) => s === 'pass' ? '合格' : s === 'fail' ? '不合格' : '待处理'
  const dormTypeText = (t: string) => t === 'single' ? '单人间' : t === 'double' ? '双人间' : t === 'quad' ? '四人间' : t

  const exportExcel = async () => {
    setExporting(true)
    try {
      const inv = await loadInvoice()
      if (!inv) { alert('获取账单数据失败'); return }

      const rows1: (string | number)[][] = [
        ['员工退宿结算单', ''],
        ['账单编号', inv.invoiceNumber],
        ['生成时间', new Date(inv.billedAt).toLocaleString('zh-CN')],
        ['', ''],
        ['员工信息', ''],
        ['姓名', inv.employee?.name || '-'],
        ['性别', inv.employee ? genderText(inv.employee.gender) : '-'],
        ['部门', inv.employee?.department || '-'],
        ['职位', inv.employee?.position || '-'],
        ['联系电话', inv.employee?.phone || '-'],
        ['', ''],
        ['房间信息', ''],
        ['楼栋', inv.room?.buildingName || '-'],
        ['房间号', inv.room?.roomNumber || '-'],
        ['楼层', `${inv.room?.floor || '-'}楼`],
        ['房型', inv.room ? dormTypeText(inv.room.dormitoryType) : '-'],
        ['床位号', inv.room?.bedNumber ? `${inv.room.bedNumber}号床` : '-'],
        ['', ''],
        ['入住日期', inv.dates.checkinDate ? new Date(inv.dates.checkinDate).toLocaleDateString('zh-CN') : '-'],
        ['退宿日期', new Date(inv.dates.checkoutDate).toLocaleDateString('zh-CN')],
        ['申请日期', new Date(inv.dates.applyDate).toLocaleDateString('zh-CN')],
        ['', ''],
        ['检查汇总', `共${inv.checklistSummary.total}项，合格${inv.checklistSummary.pass}项，不合格${inv.checklistSummary.fail}项`],
      ]

      const checkRows: (string | number)[][] = [['检查项目', '状态', '备注']]
      inv.checklistSummary.items.forEach(i => {
        checkRows.push([i.itemName, statusText(i.status), i.remark || '-'])
      })

      const utilRows: (string | number)[][] = [
        ['', ''],
        ['水电费用', ''],
        ['项目', '上次读数', '本次读数', '用量', '单价', '费用(元)'],
        ['水费', inv.utilities.water.previousReading, inv.utilities.water.currentReading, inv.utilities.water.usage, `${inv.utilities.water.unitPrice}元/吨`, inv.utilities.water.fee],
        ['电费', inv.utilities.electric.previousReading, inv.utilities.electric.currentReading, inv.utilities.electric.usage, `${inv.utilities.electric.unitPrice}元/度`, inv.utilities.electric.fee],
      ]

      const dmgRows: (string | number)[][] = [['', ''], ['设施赔偿明细', ''], ['序号', '项目名称', '金额(元)', '备注']]
      if (inv.facilityDamages.length === 0) {
        dmgRows.push(['-', '无', 0, '-'])
      } else {
        inv.facilityDamages.forEach((d, i) => {
          dmgRows.push([i + 1, d.name, d.amount, d.remark || '-'])
        })
        dmgRows.push(['', '赔偿合计', inv.damagesTotal, ''])
      }

      const depRows: (string | number)[][] = [
        ['', ''],
        ['押金抵扣', ''],
        ['原始押金(元)', inv.deposit.original],
        ['抵扣金额(元)', inv.deposit.deducted],
        ['剩余押金(元)', inv.deposit.remaining],
        ['', ''],
        ['费用总计', ''],
        ['总费用(元)', inv.totalFee],
        ['最终实付(元)', inv.finalFee],
        ['支付状态', inv.paymentStatus === 'paid' ? '已支付' : '未支付'],
      ]

      const allRows = [...rows1, ...checkRows, ...utilRows, ...dmgRows, ...depRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '结算单')
      XLSX.writeFile(wb, `退宿结算单_${inv.employee?.name || '未知'}_${inv.invoiceNumber}.xlsx`)
    } finally { setExporting(false) }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const inv = await loadInvoice()
      if (!inv) { alert('获取账单数据失败'); return }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let yPos = 20

      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('员工退宿结算单', pageWidth / 2, yPos, { align: 'center' })
      yPos += 12
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`账单编号: ${inv.invoiceNumber}`, 14, yPos)
      doc.text(`生成时间: ${new Date(inv.billedAt).toLocaleString('zh-CN')}`, pageWidth - 14, yPos, { align: 'right' })
      yPos += 10

      const buildSection = (title: string) => {
        yPos += 4
        doc.setFillColor(30, 58, 95)
        doc.rect(14, yPos, pageWidth - 28, 7, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(title, 17, yPos + 5)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        yPos += 11
      }

      buildSection('员工信息')
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        body: [
          ['姓名', inv.employee?.name || '-', '性别', inv.employee ? genderText(inv.employee.gender) : '-'],
          ['部门', inv.employee?.department || '-', '职位', inv.employee?.position || '-'],
          ['联系电话', inv.employee?.phone || '-', '', ''],
        ],
        columnStyles: { 0: { textColor: [100, 100, 100], fontStyle: 'bold' }, 2: { textColor: [100, 100, 100], fontStyle: 'bold' } },
      })
      yPos = (doc as any).lastAutoTable.finalY + 4

      buildSection('房间信息')
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        body: [
          ['楼栋', inv.room?.buildingName || '-', '房间号', inv.room?.roomNumber || '-'],
          ['楼层', `${inv.room?.floor || '-'}楼`, '房型', inv.room ? dormTypeText(inv.room.dormitoryType) : '-'],
          ['床位号', inv.room?.bedNumber ? `${inv.room.bedNumber}号床` : '-', '', ''],
          ['入住日期', inv.dates.checkinDate ? new Date(inv.dates.checkinDate).toLocaleDateString('zh-CN') : '-',
           '退宿日期', new Date(inv.dates.checkoutDate).toLocaleDateString('zh-CN')],
        ],
        columnStyles: { 0: { textColor: [100, 100, 100], fontStyle: 'bold' }, 2: { textColor: [100, 100, 100], fontStyle: 'bold' } },
      })
      yPos = (doc as any).lastAutoTable.finalY + 4

      buildSection(`检查汇总 (共${inv.checklistSummary.total}项，合格${inv.checklistSummary.pass}项，不合格${inv.checklistSummary.fail}项)`)
      autoTable(doc, {
        startY: yPos,
        styles: { fontSize: 9, cellPadding: 3 },
        head: [['检查项目', '状态', '备注']],
        body: inv.checklistSummary.items.map(i => [i.itemName, statusText(i.status), i.remark || '-']),
        headStyles: { fillColor: [240, 244, 248], textColor: 50, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
      })
      yPos = (doc as any).lastAutoTable.finalY + 4

      if (yPos > 230) { doc.addPage(); yPos = 20 }
      buildSection('水电费用')
      autoTable(doc, {
        startY: yPos,
        styles: { fontSize: 10, cellPadding: 3 },
        head: [['项目', '上次读数', '本次读数', '用量', '单价', '费用(元)']],
        body: [
          ['水费', inv.utilities.water.previousReading, inv.utilities.water.currentReading,
           `${inv.utilities.water.usage}吨`, `${inv.utilities.water.unitPrice}元/吨`, inv.utilities.water.fee.toFixed(2)],
          ['电费', inv.utilities.electric.previousReading, inv.utilities.electric.currentReading,
           `${inv.utilities.electric.usage}度`, `${inv.utilities.electric.unitPrice}元/度`, inv.utilities.electric.fee.toFixed(2)],
        ],
        headStyles: { fillColor: [240, 244, 248], textColor: 50, fontStyle: 'bold' },
      })
      yPos = (doc as any).lastAutoTable.finalY + 4

      buildSection('设施赔偿明细')
      const dmgBody = inv.facilityDamages.length === 0
        ? [['-', '无赔偿项目', '0.00', '-']]
        : inv.facilityDamages.map((d, i) => [String(i + 1), d.name, d.amount.toFixed(2), d.remark || '-'])
      if (inv.facilityDamages.length > 0) {
        dmgBody.push(['', '赔偿合计', inv.damagesTotal.toFixed(2), ''])
      }
      autoTable(doc, {
        startY: yPos,
        styles: { fontSize: 10, cellPadding: 3 },
        head: [['序号', '项目名称', '金额(元)', '备注']],
        body: dmgBody,
        headStyles: { fillColor: [240, 244, 248], textColor: 50, fontStyle: 'bold' },
        didParseCell: (data) => {
          if (data.row.index === dmgBody.length - 1 && inv.facilityDamages.length > 0) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
      yPos = (doc as any).lastAutoTable.finalY + 4

      if (yPos > 210) { doc.addPage(); yPos = 20 }
      buildSection('押金抵扣 & 费用总计')
      autoTable(doc, {
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3 },
        body: [
          ['原始押金', `¥${inv.deposit.original.toFixed(2)}`],
          ['抵扣金额', `¥${inv.deposit.deducted.toFixed(2)}`],
          ['剩余押金', `¥${inv.deposit.remaining.toFixed(2)}`],
          ['总费用（水电+赔偿）', `¥${inv.totalFee.toFixed(2)}`],
          ['最终实付', `¥${inv.finalFee.toFixed(2)}`],
          ['支付状态', inv.paymentStatus === 'paid' ? '已支付' : '未支付'],
        ],
        columnStyles: {
          0: { textColor: [100, 100, 100], fontStyle: 'bold' },
          1: { halign: 'right' },
        },
        didParseCell: (data) => {
          if (data.row.index === 4) {
            data.cell.styles.fontSize = 12
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.textColor = [30, 58, 95]
          }
        },
      })

      doc.save(`退宿结算单_${inv.employee?.name || '未知'}_${inv.invoiceNumber}.pdf`)
    } finally { setExporting(false) }
  }

  if (loading) return <div className="p-6 space-y-4"><div className="card p-6 h-64 animate-pulse" /></div>
  if (!checkout) return <div className="p-6 text-center text-red-500">未找到记录</div>

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-lg font-bold text-gray-900">退宿处理</h2>
          <span className={statusBadgeClass(checkout.status)}>{formatStatus(checkout.status)}</span>
        </div>

        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${i <= currentStep ? 'bg-[#1E3A5F] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {i < currentStep ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>
                <span className={`text-xs mt-1 ${i <= currentStep ? 'text-[#1E3A5F] font-medium' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < currentStep ? 'bg-[#1E3A5F]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {currentStep === 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">设施检查清单</h3>
          <p className="text-sm text-gray-500 mb-3">请逐项检查宿舍设施，标记合格或不合格</p>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex gap-2">
                  <button onClick={() => toggleItem(item.id, 'pass')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${item.status === 'pass' ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>合格</button>
                  <button onClick={() => toggleItem(item.id, 'fail')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${item.status === 'fail' ? 'bg-red-100 text-red-800 ring-1 ring-red-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>不合格</button>
                </div>
                <span className="text-sm flex-1">{item.itemName}</span>
                <input className="input-field w-40 text-xs" placeholder="备注（选填）" value={item.remark || ''}
                  onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, remark: e.target.value } : it))} />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn-primary" disabled={submitting || items.every(i => i.status === 'pending')} onClick={saveChecklistAndAdvance}>
              {submitting ? '处理中...' : '确认检查，进入确认'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">检查结果确认</h3>
          {hasPendingItems && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              尚有未处理检查项：{pendingItems.map(i => i.itemName).join('、')}
            </div>
          )}
          <div className="space-y-2 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-gray-50">
                {item.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : item.status === 'fail' ? (
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">!</span>
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
                    <span className="text-white text-[10px]">?</span>
                  </div>
                )}
                <span className="flex-1">{item.itemName}</span>
                <span className={`text-xs font-medium ${item.status === 'pass' ? 'text-emerald-600' : item.status === 'fail' ? 'text-red-600' : 'text-gray-500'}`}>
                  {item.status === 'pass' ? '合格' : item.status === 'fail' ? '不合格' : '待处理'}
                </span>
                {item.remark && <span className="text-gray-400 text-xs">({item.remark})</span>}
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
            确认检查结果后，将进入水电费结算环节
          </div>
          <button className="btn-primary" disabled={submitting || hasPendingItems} onClick={saveChecklistAndAdvance}>
            {submitting ? '处理中...' : '确认结果，进入结算'}
          </button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-5 h-5 text-[#1E3A5F]" />
            <h3 className="font-bold text-gray-900">费用结算</h3>
          </div>

          {hasPendingItems && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              尚有未处理检查项：{pendingItems.map(i => i.itemName).join('、')}，请先完成检查
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" /> 水表读数（吨）
              </label>
              <input
                type="number"
                className={`input-field text-lg ${waterInvalid ? 'border-red-400 ring-2 ring-red-100 focus:ring-red-200' : ''}`}
                value={waterReading}
                onChange={e => setWaterReading(e.target.value)}
                placeholder="输入当前水表读数"
              />
              <p className="text-xs text-gray-500 mt-2">上次读数: <span className="font-medium">{pwr}</span> 吨，水费单价: 5元/吨</p>
              {waterReading !== '' && (
                <p className={`text-sm mt-2 font-medium ${waterInvalid ? 'text-red-600' : 'text-blue-700'}`}>
                  {waterInvalid
                    ? `⚠ 当前读数(${wr})小于上次读数(${pwr})`
                    : `用量: ${wr - pwr} 吨，水费: ¥${waterFee.toFixed(2)}`}
                </p>
              )}
            </div>
            <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100">
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> 电表读数（度）
              </label>
              <input
                type="number"
                className={`input-field text-lg ${electricInvalid ? 'border-red-400 ring-2 ring-red-100 focus:ring-red-200' : ''}`}
                value={electricReading}
                onChange={e => setElectricReading(e.target.value)}
                placeholder="输入当前电表读数"
              />
              <p className="text-xs text-gray-500 mt-2">上次读数: <span className="font-medium">{per}</span> 度，电费单价: 0.8元/度</p>
              {electricReading !== '' && (
                <p className={`text-sm mt-2 font-medium ${electricInvalid ? 'text-red-600' : 'text-amber-700'}`}>
                  {electricInvalid
                    ? `⚠ 当前读数(${er})小于上次读数(${per})`
                    : `用量: ${er - per} 度，电费: ¥${electricFee.toFixed(2)}`}
                </p>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> 设施赔偿项
              </h4>
              <button onClick={addDamageItem}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[#1E3A5F] text-white hover:bg-[#2d4f7c] transition-colors">
                <Plus className="w-4 h-4" /> 新增赔偿项
              </button>
            </div>
            {damages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                暂无设施赔偿项，如无损坏可跳过
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_140px_1fr_40px] gap-3 px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 rounded-lg">
                  <span>项目名称</span>
                  <span>金额(元)</span>
                  <span>备注</span>
                  <span></span>
                </div>
                {damages.map(d => (
                  <div key={d.id} className="grid grid-cols-[1fr_140px_1fr_40px] gap-3 items-center">
                    <input className="input-field text-sm" placeholder="如：床垫损坏"
                      value={d.name} onChange={e => updateDamageItem(d.id, 'name', e.target.value)} />
                    <input type="number" className="input-field text-sm" placeholder="0.00" min="0" step="0.01"
                      value={d.amount || ''} onChange={e => updateDamageItem(d.id, 'amount', e.target.value)} />
                    <input className="input-field text-sm" placeholder="选填"
                      value={d.remark} onChange={e => updateDamageItem(d.id, 'remark', e.target.value)} />
                    <button onClick={() => removeDamageItem(d.id)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {damages.length > 0 && (
              <div className="mt-3 text-right text-sm">
                <span className="text-gray-500">赔偿合计：</span>
                <span className="font-semibold text-orange-600">¥{damagesTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" /> 押金抵扣
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">原始押金</p>
                <p className="text-xl font-bold text-gray-800">¥{deposit.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">抵扣金额</p>
                <p className="text-xl font-bold text-orange-600">¥{depositDeducted.toFixed(2)}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">剩余押金</p>
                <p className="text-xl font-bold text-emerald-600">¥{(deposit - depositDeducted).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> 费用合计
            </h4>
            <div className="space-y-2 text-sm max-w-md ml-auto">
              <div className="flex justify-between py-1.5"><span className="text-gray-500">水费</span><span>¥{waterFee.toFixed(2)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">电费</span><span>¥{electricFee.toFixed(2)}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-gray-500">设施赔偿</span><span>¥{damagesTotal.toFixed(2)}</span></div>
              <div className="flex justify-between py-1.5 border-t border-gray-300/50"><span className="text-gray-500">总费用</span><span className="font-medium">¥{totalFee.toFixed(2)}</span></div>
              <div className="flex justify-between py-1.5 text-orange-600"><span>押金抵扣</span><span>- ¥{depositDeducted.toFixed(2)}</span></div>
              <div className={`flex justify-between py-3 border-t-2 ${finalFeeInvalid ? 'border-red-300' : 'border-[#1E3A5F]'} mt-2`}>
                <span className="font-bold text-base">最终实付</span>
                <span className={`text-2xl font-bold ${finalFeeInvalid ? 'text-red-600' : 'text-[#1E3A5F]'}`}>
                  ¥{finalFee.toFixed(2)}
                </span>
              </div>
              {finalFeeInvalid && (
                <p className="text-xs text-red-600 text-right">⚠ 费用异常，请核对</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary" disabled={submitting || !canSettle} onClick={handleSettle}>
              {submitting ? '处理中...' : '确认结算并完成退宿'}
            </button>
            {!canSettle && (
              <span className="text-sm text-red-500 self-center">
                {hasPendingItems ? '请先完成检查项' : readingsInvalid ? '请核对水电读数' : finalFeeInvalid ? '费用异常' : '请填写水电读数'}
              </span>
            )}
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> 退宿已完成
              </h3>
              <div className="flex gap-2">
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  <FileSpreadsheet className="w-4 h-4" />
                  {exporting ? '导出中...' : '导出入账单 (Excel)'}
                </button>
                <button onClick={exportPDF} disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[#1E3A5F] text-white hover:bg-[#2d4f7c] transition-colors disabled:opacity-50">
                  <FileText className="w-4 h-4" />
                  {exporting ? '导出中...' : '导出PDF账单'}
                </button>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-sm text-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <BedDouble className="w-4 h-4" />
                <span className="font-medium">床位已释放</span>
              </div>
              <p>水电费用已结算扣款，宿舍状态已更新。账单编号：{checkout.invoiceNumber || '-'}</p>
            </div>

            {checkout.invoiceNumber && (
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">账单编号</p>
                  <p className="font-mono font-semibold text-gray-800">{checkout.invoiceNumber}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">账单生成时间</p>
                  <p className="font-medium text-gray-800">
                    {checkout.billedAt ? new Date(checkout.billedAt).toLocaleString('zh-CN') : '-'}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-5 space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500 w-32">水费</span>
                <span className="font-medium">¥{checkout.waterFee?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-500 w-32">电费</span>
                <span className="font-medium">¥{checkout.electricFee?.toFixed(2) || '0.00'}</span>
              </div>
              {(checkout.facilityDamages?.length || 0) > 0 && (
                <div className="py-2 border-b border-gray-200">
                  <p className="text-gray-500 mb-2">设施赔偿明细</p>
                  <div className="space-y-1 pl-3">
                    {checkout.facilityDamages?.map(d => (
                      <div key={d.id} className="flex justify-between">
                        <span className="text-gray-600">• {d.name}{d.remark ? ` (${d.remark})` : ''}</span>
                        <span>¥{Number(d.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-200 text-orange-600">
                <span className="w-32">押金抵扣</span>
                <span className="font-medium">- ¥{checkout.depositDeducted?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="font-bold text-base w-32">最终实付</span>
                <span className="text-2xl font-bold text-[#1E3A5F]">¥{checkout.finalFee?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 pt-2 border-t">
                <span>完成时间</span>
                <span>{checkout.completedAt ? new Date(checkout.completedAt).toLocaleString('zh-CN') : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
