import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface PaginationProps {
  current: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

function getPageNumbers(current: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < totalPages - 2) pages.push('...')
  pages.push(totalPages)
  return pages
}

export default function Pagination({
  current,
  pageSize,
  total,
  onChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between py-3 text-sm text-gray-500">
        <span>共 {total} 条</span>
      </div>
    )
  }

  const pages = getPageNumbers(current, totalPages)

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-gray-500">共 {total} 条</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={clsx(
                'min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors',
                p === current
                  ? 'bg-[#1E3A5F] text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(current + 1)}
          disabled={current >= totalPages}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
