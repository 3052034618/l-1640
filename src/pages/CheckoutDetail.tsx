import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, Droplets, Zap } from 'lucide-react'
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/checkouts/${id}`).then(r => r.json()) as Promise<Checkout>,
      fetch(`/api/checkouts/${id}/checklist`).then(r => r.json()) as Promise<{ items: ChecklistItem[] }>,
    ]).then(([coData, clData]) => {
      setCheckout(coData)
      setItems(clData.items)
      if (coData.waterReading != null) setWaterReading(String(coData.waterReading))
      if (coData.electricReading != null) setElectricReading(String(coData.electricReading))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const stepIndex = ['inspection', 'confirming', 'settling', 'completed'].indexOf(checkout?.status || '')
  const currentStep = stepIndex === -1 ? 0 : stepIndex

  const saveChecklist = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/checklist`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      const co = await fetch(`/api/checkouts/${id}`).then(r => r.json())
      setCheckout(co)
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
      setCheckout(await res.json())
    } catch { alert('操作失败') }
    finally { setSubmitting(false) }
  }

  const handleComplete = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/checkouts/${id}/complete`, { method: 'PUT' })
      if (!res.ok) throw new Error()
      setCheckout(await res.json())
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

        <div className="flex items-center justify-between mb-8">
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
          <h3 className="font-bold text-gray-900 mb-4">检查清单</h3>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                <div className="flex gap-2">
                  <button onClick={() => toggleItem(item.id, 'pass')}
                    className={`px-3 py-1 rounded text-xs font-medium ${item.status === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>合格</button>
                  <button onClick={() => toggleItem(item.id, 'fail')}
                    className={`px-3 py-1 rounded text-xs font-medium ${item.status === 'fail' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'}`}>不合格</button>
                </div>
                <span className="text-sm flex-1">{item.itemName}</span>
                <input className="input-field w-40 text-xs" placeholder="备注" value={item.remark}
                  onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, remark: e.target.value } : it))} />
              </div>
            ))}
          </div>
          <button className="btn-primary mt-4" disabled={submitting} onClick={saveChecklist}>确认检查</button>
        </div>
      )}

      {currentStep === 1 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">检查结果确认</h3>
          <div className="space-y-2 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                {item.status === 'pass' ? <Circle className="w-4 h-4 text-emerald-500 fill-emerald-500" /> : <Circle className="w-4 h-4 text-red-500 fill-red-500" />}
                <span>{item.itemName}</span>
                <span className={`text-xs ${item.status === 'pass' ? 'text-emerald-600' : 'text-red-600'}`}>{item.status === 'pass' ? '合格' : '不合格'}</span>
                {item.remark && <span className="text-gray-400 text-xs">({item.remark})</span>}
              </div>
            ))}
          </div>
          <button className="btn-primary" disabled={submitting} onClick={saveChecklist}>进入结算</button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">水电结算</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 flex items-center gap-1"><Droplets className="w-4 h-4 text-blue-500" /> 水表读数</label>
              <input type="number" className="input-field" value={waterReading} onChange={e => setWaterReading(e.target.value)} placeholder="输入水表读数" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 flex items-center gap-1"><Zap className="w-4 h-4 text-amber-500" /> 电表读数</label>
              <input type="number" className="input-field" value={electricReading} onChange={e => setElectricReading(e.target.value)} placeholder="输入电表读数" />
            </div>
          </div>
          <button className="btn-primary" disabled={submitting} onClick={handleSettle}>确认结算</button>
        </div>
      )}

      {currentStep === 3 && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">退宿完成</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">水费</span><span>¥{checkout.waterFee?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">电费</span><span>¥{checkout.electricFee?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">总计</span><span className="font-bold">¥{checkout.totalFee?.toFixed(2) || '0.00'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">人均分摊</span><span>¥{checkout.sharePerPerson?.toFixed(2) || '0.00'}</span></div>
          </div>
          {checkout.status !== 'completed' && (
            <button className="btn-success mt-4" disabled={submitting} onClick={handleComplete}>完成退宿</button>
          )}
        </div>
      )}
    </div>
  )
}
