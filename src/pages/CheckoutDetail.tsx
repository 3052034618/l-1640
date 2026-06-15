import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Droplets, Zap, BedDouble } from 'lucide-react'
import type { Checkout, ChecklistItem } from '@/types'
import { formatStatus, statusBadgeClass } from '@/lib/helpers'

const STEPS = ['检查', '确认', '结算', '完成']

export default function CheckoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [checkout, setCheckout] = useState<Checkout | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [waterReading, setWaterReading] = useState('')
  const [electricReading, setElectricReading] = useState('')

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
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [id])

  const stepIndex = ['inspection', 'confirming', 'settling', 'completed'].indexOf(checkout?.status || '')
  const currentStep = stepIndex === -1 ? 0 : stepIndex

  const saveChecklistAndAdvance = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/checklist`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, advance: true }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setCheckout(updated)
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const handleSettle = async () => {
    if (!waterReading || !electricReading) return alert('请填写水电读数')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/settle`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waterReading: Number(waterReading), electricReading: Number(electricReading) }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setCheckout(updated)
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const toggleItem = (itemId: string, status: string) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status } : it))
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
            <div key={label} className="flex items-center">
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
          <div className="space-y-2 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-gray-50">
                {item.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-[10px]">!</span>
                  </div>
                )}
                <span className="flex-1">{item.itemName}</span>
                <span className={`text-xs font-medium ${item.status === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {item.status === 'pass' ? '合格' : '不合格'}
                </span>
                {item.remark && <span className="text-gray-400 text-xs">({item.remark})</span>}
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
            确认检查结果后，将进入水电费结算环节
          </div>
          <button className="btn-primary" disabled={submitting} onClick={saveChecklistAndAdvance}>
            {submitting ? '处理中...' : '确认结果，进入结算'}
          </button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">水电费结算</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-4">
            请输入当前水电表读数，系统将根据上次读数自动计算费用并分摊
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-600 mb-1 flex items-center gap-1 font-medium">
                <Droplets className="w-4 h-4 text-blue-500" /> 水表读数（吨）
              </label>
              <input type="number" className="input-field text-lg" value={waterReading} onChange={e => setWaterReading(e.target.value)} placeholder="输入当前水表读数" />
              <p className="text-xs text-gray-400 mt-1">上次读数: {checkout.previousWaterReading || 100} 吨，水费单价: 5元/吨</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 flex items-center gap-1 font-medium">
                <Zap className="w-4 h-4 text-amber-500" /> 电表读数（度）
              </label>
              <input type="number" className="input-field text-lg" value={electricReading} onChange={e => setElectricReading(e.target.value)} placeholder="输入当前电表读数" />
              <p className="text-xs text-gray-400 mt-1">上次读数: {checkout.previousElectricReading || 200} 度，电费单价: 0.8元/度</p>
            </div>
          </div>
          {waterReading && electricReading && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-1">
              <p>水费: {(Number(waterReading) - (checkout.previousWaterReading || 100)) * 5} 元</p>
              <p>电费: {(Number(electricReading) - (checkout.previousElectricReading || 200)) * 0.8} 元</p>
              <p className="font-bold text-base border-t pt-1 mt-1">
                合计: {((Number(waterReading) - (checkout.previousWaterReading || 100)) * 5 + (Number(electricReading) - (checkout.previousElectricReading || 200)) * 0.8).toFixed(2)} 元
              </p>
            </div>
          )}
          <button className="btn-primary" disabled={submitting || !waterReading || !electricReading} onClick={handleSettle}>
            {submitting ? '处理中...' : '确认结算并完成退宿'}
          </button>
        </div>
      )}

      {currentStep === 3 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> 退宿已完成
          </h3>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <BedDouble className="w-4 h-4" />
              <span className="font-medium">床位已释放</span>
            </div>
            <p>水电费用已结算扣款，宿舍状态已更新</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">水费</span><span>¥{checkout.waterFee?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">电费</span><span>¥{checkout.electricFee?.toFixed(2) || '0.00'}</span></div>
            <div className="border-t pt-1 flex justify-between"><span className="text-gray-500 font-medium">总计</span><span className="font-bold text-base">¥{checkout.totalFee?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">人均分摊</span><span>¥{checkout.sharePerPerson?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between text-xs text-gray-400 pt-1">
              <span>完成时间</span>
              <span>{checkout.completedAt ? new Date(checkout.completedAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
