import { Router, type Request, type Response } from 'express';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
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

interface LogFilters {
  employeeName?: string;
  roomNumber?: string;
  operationType?: string;
  startDate?: string;
  endDate?: string;
}

function parseFilters(query: Record<string, unknown>): LogFilters {
  const filters: LogFilters = {};

  if (query.filters) {
    try {
      const parsed = JSON.parse(decodeURIComponent(String(query.filters))) as LogFilters;
      Object.assign(filters, parsed);
    } catch {
      // ignore parse errors
    }
  }

  if (query.employeeName) filters.employeeName = String(query.employeeName);
  if (query.roomNumber) filters.roomNumber = String(query.roomNumber);
  if (query.operationType) filters.operationType = String(query.operationType);
  if (query.startDate) filters.startDate = String(query.startDate);
  if (query.endDate) filters.endDate = String(query.endDate);

  return filters;
}

function filterLogs(filters: LogFilters) {
  let list = [...db.operationLogs];

  if (filters.employeeName) {
    const kw = filters.employeeName.toLowerCase();
    list = list.filter(l => l.employeeName.toLowerCase().includes(kw));
  }

  if (filters.roomNumber) {
    const rn = filters.roomNumber;
    list = list.filter(l => l.roomNumber.includes(rn));
  }

  if (filters.startDate) {
    const s = new Date(filters.startDate);
    list = list.filter(l => new Date(l.createdAt) >= s);
  }

  if (filters.endDate) {
    const e = new Date(filters.endDate);
    e.setHours(23, 59, 59, 999);
    list = list.filter(l => new Date(l.createdAt) <= e);
  }

  if (filters.operationType) {
    list = list.filter(l => l.operationType === filters.operationType);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return list;
}

function applyScope(
  list: any[],
  scope: string,
  page: number,
  pageSize: number
): { total: number; list: any[] } {
  const total = list.length;
  if (scope === 'current') {
    const start = (page - 1) * pageSize;
    return { total, list: list.slice(start, start + pageSize) };
  }
  return { total, list };
}

function buildFilterDesc(filters: LogFilters): string {
  const parts: string[] = [];
  if (filters.employeeName) parts.push(`员工=${filters.employeeName}`);
  if (filters.roomNumber) parts.push(`房间=${filters.roomNumber}`);
  if (filters.operationType) parts.push(`类型=${TYPE_LABELS[filters.operationType] || filters.operationType}`);
  if (filters.startDate) parts.push(`开始=${filters.startDate}`);
  if (filters.endDate) parts.push(`结束=${filters.endDate}`);
  return parts.length > 0 ? parts.join(', ') : '无';
}

router.get('/', (req: Request, res: Response) => {
  const { page = '1', pageSize = '10', scope = 'all' } = req.query;
  const filters = parseFilters(req.query as Record<string, unknown>);
  const filtered = filterLogs(filters);
  const result = applyScope(filtered, String(scope), Number(page), Number(pageSize));

  res.json({ total: result.total, list: result.list });
});

router.get('/export', (req: Request, res: Response) => {
  const { page = '1', pageSize = '10', scope = 'all' } = req.query;
  const filters = parseFilters(req.query as Record<string, unknown>);
  const filtered = filterLogs(filters);
  const result = applyScope(filtered, String(scope), Number(page), Number(pageSize));

  const nowStr = new Date().toLocaleString('zh-CN');
  const scopeLabel = scope === 'current' ? '当前页' : '全部';
  const filterDesc = buildFilterDesc(filters);

  const dataRows = result.list.map(l => ({
    '时间': new Date(l.createdAt).toLocaleString('zh-CN'),
    '操作人': l.employeeName,
    '操作类型': TYPE_LABELS[l.operationType] || l.operationType,
    '房间编号': l.roomNumber,
    '描述': l.description,
  }));

  const headerRow = ['时间', '操作人', '操作类型', '房间编号', '描述'];
  const metaRow1 = ['操作日志导出报表', '', '', '', ''];
  const metaRow2 = [`导出时间：${nowStr} | 筛选条件：${filterDesc} | 范围=${scopeLabel}`, '', '', '', ''];
  const emptyRow = ['', '', '', '', ''];

  const aoa: (string | undefined)[][] = [
    metaRow1,
    metaRow2,
    emptyRow,
    headerRow,
    ...dataRows.map(r => Object.values(r)),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
  ];

  ws['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 50 },
  ];

  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let C = 0; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) {
      cell.s = { font: { bold: true, sz: 16 } };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, '操作日志');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `operation_logs_${new Date().toISOString().slice(0, 10)}_${uuidv4().slice(0, 8)}.xlsx`;
  const fileSize = buffer.length;
  const recordCount = result.list.length;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  db.exportTasks.unshift({
    id: uuidv4(),
    type: 'operation_log',
    fileName,
    scope: scope as 'current' | 'all',
    filters: { ...filters, page: Number(page), pageSize: Number(pageSize) },
    filterDescription: filterDesc,
    recordCount,
    fileSize,
    status: 'completed',
    operator: '系统管理员',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.send(buffer);
});

router.get('/export-tasks', (req: Request, res: Response) => {
  const { page = '1', pageSize = '10' } = req.query;
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);

  const tasks = db.exportTasks.filter(t => t.type === 'operation_log');
  const total = tasks.length;
  const start = (pageNum - 1) * pageSizeNum;
  const list = tasks.slice(start, start + pageSizeNum);

  res.json({ total, list });
});

export default router;
