import { Router, type Request, type Response } from 'express';
import * as XLSX from 'xlsx';
import db from '../db.js';

const router = Router();

const TYPE_LABELS: Record<string, string> = {
  checkin: '入住',
  checkout: '退宿',
  inspection: '检查',
  import: '导入',
  warning: '预警',
  other: '其他',
};

function filterLogs(query: Record<string, unknown>) {
  let list = [...db.operationLogs];

  if (query.employeeName) {
    const kw = String(query.employeeName).toLowerCase();
    list = list.filter(l => l.employeeName.toLowerCase().includes(kw));
  }

  if (query.roomNumber) {
    const rn = String(query.roomNumber);
    list = list.filter(l => l.roomNumber.includes(rn));
  }

  if (query.startDate) {
    const s = new Date(String(query.startDate));
    list = list.filter(l => new Date(l.createdAt) >= s);
  }

  if (query.endDate) {
    const e = new Date(String(query.endDate));
    e.setHours(23, 59, 59, 999);
    list = list.filter(l => new Date(l.createdAt) <= e);
  }

  if (query.operationType) {
    list = list.filter(l => l.operationType === String(query.operationType));
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return list;
}

router.get('/', (req: Request, res: Response) => {
  const { page = '1', pageSize = '10' } = req.query;
  const list = filterLogs(req.query as Record<string, unknown>);

  const p = Number(page);
  const ps = Number(pageSize);
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);

  res.json({ total, list: items });
});

router.get('/export', (req: Request, res: Response) => {
  const list = filterLogs(req.query as Record<string, unknown>);

  const rows = list.map(l => ({
    '时间': new Date(l.createdAt).toLocaleString('zh-CN'),
    '操作人': l.employeeName,
    '操作类型': TYPE_LABELS[l.operationType] || l.operationType,
    '房间编号': l.roomNumber,
    '描述': l.description,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, '操作日志');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=operation_logs.xlsx');
  res.send(buffer);
});

export default router;
