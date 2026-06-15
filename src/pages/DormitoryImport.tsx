import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; message: string }[]
}

interface RowWithMeta {
  _rowIndex: number
  _error: string | null
  [key: string]: unknown
}

export default function DormitoryImport() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [parsedData, setParsedData] = useState<RowWithMeta[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const TEMPLATE_COLUMNS = ['楼栋名称', '性别', '楼层数', '楼层号', '房间号', '房型']

  const parseFile = (file: File) => {
    setFileName(file.name)
    setResult(null)
    setParsedData([])
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (rawData.length > 0) {
        const cols = Object.keys(rawData[0])
        setColumns(cols)
        const withMeta: RowWithMeta[] = rawData.map((row, i) => ({
          ...row,
          _rowIndex: i + 2,
          _error: null,
        }))
        setParsedData(withMeta)
        doImport(rawData, withMeta, cols)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const doImport = async (rawData: Record<string, unknown>[], currentData: RowWithMeta[], cols: string[]) => {
    setImporting(true)
    try {
      const res = await fetch('/api/buildings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: rawData }),
      })
      if (!res.ok) throw new Error()
      const data: ImportResult = await res.json()
      setResult(data)

      if (data.errors.length > 0) {
        const errorMap = new Map<number, string>()
        for (const err of data.errors) {
          errorMap.set(err.row, err.message)
        }
        setParsedData(currentData.map(row => ({
          ...row,
          _error: errorMap.get(row._rowIndex) || null,
        })))
      }
    } catch {
      alert('导入请求失败')
    }
    finally {
      setImporting(false)
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

  const errorRowSet = new Set(result?.errors.map(e => e.row) || [])

  return (
    <div className="p-6 space-y-4">
      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> 返回
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">批量导入</h1>
        <button className="btn-outline flex items-center gap-2 text-sm" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4" /> 下载模板
        </button>
      </div>

      <div className={`card p-8 border-2 border-dashed transition-colors ${dragOver ? 'border-[#1E3A5F] bg-blue-50' : 'border-gray-300'} ${importing ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}>
        <div className="text-center">
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">拖拽文件到此处，或 <span className="text-[#1E3A5F] font-medium cursor-pointer">点击上传</span></p>
          <p className="text-xs text-gray-400 mt-1">支持 .xlsx / .csv 格式，选完文件自动校验并导入</p>
          {fileName && <p className="text-xs text-emerald-600 mt-2 flex items-center justify-center gap-1"><FileSpreadsheet className="w-3 h-3" /> {fileName}</p>}
          {importing && <p className="text-sm text-[#1E3A5F] mt-2 animate-pulse">正在校验并导入...</p>}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]) }} />
      </div>

      {result && (
        <div className="card p-4">
          <div className="flex items-center gap-6 mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">成功导入: <strong className="text-emerald-600">{result.success}</strong> 间</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm">校验失败: <strong className="text-red-600">{result.failed}</strong> 行</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">出错行已在下方表格中红色高亮标注，修正后可重新上传</p>
        </div>
      )}

      {parsedData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <h3 className="font-bold text-gray-900">
              {result ? '导入结果明细' : '数据预览'} ({parsedData.length} 条)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="table-header">
                  <th className="px-3 py-2 w-12">行号</th>
                  {columns.map(col => <th key={col} className="px-3 py-2">{col}</th>)}
                  {result && result.failed > 0 && <th className="px-3 py-2">校验结果</th>}
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row) => {
                  const hasError = row._error !== null
                  return (
                    <tr key={row._rowIndex} className={`border-b border-gray-50 ${hasError ? 'bg-red-50' : errorRowSet.has(row._rowIndex) ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className={`px-3 py-2 text-center text-xs ${hasError ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{row._rowIndex}</td>
                      {columns.map(col => (
                        <td key={col} className={`px-3 py-2 ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                      {result && result.failed > 0 && (
                        <td className="px-3 py-2">
                          {hasError ? (
                            <span className="text-xs text-red-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 flex-shrink-0" /> {row._error}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> 通过
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
