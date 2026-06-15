export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('下载失败')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待审批',
    assigned: '已分配',
    rejected: '已拒绝',
    inspection: '待检查',
    confirming: '待确认',
    settling: '待结算',
    completed: '已完成',
    active: '入住中',
    expired: '已到期',
    expiring: '即将到期',
  }
  return map[status] || status
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'badge-pending',
    assigned: 'badge-success',
    rejected: 'badge-danger',
    inspection: 'badge-pending',
    confirming: 'badge-info',
    settling: 'badge-warning',
    completed: 'badge-success',
    active: 'badge-success',
    expired: 'badge-danger',
    expiring: 'badge-warning',
  }
  return map[status] || 'badge-info'
}
