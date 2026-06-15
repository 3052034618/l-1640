import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; message: string }[]
}

export default function DormitoryImport() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const parseFile = (file: File) => {
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      setParsedData(data)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  const handleImport = async () => {
    if (parsedData.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/buildings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: parsedData }),
      })
      if (!res.ok) throw new Error()
      const data: ImportResult = await res.json()
      setResult(data)
    } catch { alert('导入失败') }
    finally { setImporting(false) }
  }

  const columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : []

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <h1 className="text-xl font-bold text-gray-900">批量导入</h1>

      <div className={`card p-8 border-2 border-dashed transition-colors ${dragOver ? 'border-[#1E3A5F] bg-blue-50' : 'border-gray-300'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}>
        <div className="text-center">
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">拖拽文件到此处，或 <span className="text-[#1E3A5F] font-medium cursor-pointer">点击上传</span></p>
          <p className="text-xs text-gray-400 mt-1">支持 .xlsx / .csv 格式</p>
          {fileName && <p className="text-xs text-emerald-600 mt-2 flex items-center justify-center gap-1"><FileSpreadsheet className="w-3 h-3" /> {fileName}</p>}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]) }} />
      </div>

      {parsedData.length > 0 && !result && (
        <div className="card overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">预览数据 ({parsedData.length} 条)</h3>
            <button className="btn-primary" disabled={importing} onClick={handleImport}>
              {importing ? '导入中...' : '校验并导入'}
            </button>
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-header">
                  {columns.map(col => <th key={col} className="px-4 py-2">{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map(col => <td key={col} className="table-cell">{String(row[col] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.length > 20 && <p className="text-xs text-gray-400 text-center py-2">仅显示前20条...</p>}
          </div>
        </div>
      )}

      {result && (
        <div className="card p-6">
          <h3 className="font-bold text-gray-900 mb-4">导入结果</h3>
          <div className="flex gap-6 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">成功: <strong className="text-emerald-600">{result.success}</strong></span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm">失败: <strong className="text-red-600">{result.failed}</strong></span>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-2">
              {result.errors.map((err, i) => (
                <div key={i} className="p-2 rounded bg-red-50 text-sm text-red-700">
                  第 {err.row} 行: {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
