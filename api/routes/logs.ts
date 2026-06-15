import { Router, type Request, type Response } from 'express';
import * as XLSX from 'xlsx';
import db from '../db.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { employeeName, roomNumber, startDate, endDate, operationType, page = '1', pageSize = '10' } = req.query;
  let list = [...db.operationLogs];

  if (employeeName) {
    const kw = String(employeeName).toLowerCase();
    list = list.filter(l => l.employeeName.toLowerCase().includes(kw));
  }

  if (roomNumber) {
    list = list.filter(l => l.roomNumber === String(roomNumber));
  }

  if (startDate) {
    const s = new Date(String(startDate));
    list = list.filter(l => new Date(l.createdAt) >= s);
  }

  if (endDate) {
    const e = new Date(String(endDate));
    list = list.filter(l => new Date(l.createdAt) <= e);
  }

  if (operationType) {
    list = list.filter(l => l.operationType === String(operationType));
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const p = Number(page);
  const ps = Number(pageSize);
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);

  res.json({ total, list: items });
});

router.get('/export', (req: Request, res: Response) => {
  const { employeeName, roomNumber, startDate, endDate, operationType } = req.query;
  let list = [...db.operationLogs];

  if (employeeName) {
    const kw = String(employeeName).toLowerCase();
    list = list.filter(l => l.employeeName.toLowerCase().includes(kw));
  }

  if (roomNumber) {
    list = list.filter(l => l.roomNumber === String(roomNumber));
  }

  if (startDate) {
    const s = new Date(String(startDate));
    list = list.filter(l => new Date(l.createdAt) >= s);
  }

  if (endDate) {
    const e = new Date(String(endDate));
    list = list.filter(l => new Date(l.createdAt) <= e);
  }

  if (operationType) {
    list = list.filter(l => l.operationType === String(operationType));
  }

  const rows = list.map(l => ({
    EmployeeName: l.employeeName,
    OperationType: l.operationType,
    RoomNumber: l.roomNumber,
    Description: l.description,
    CreatedAt: l.createdAt,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'OperationLogs');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=operation_logs.xlsx');
  res.send(buffer);
});

export default router;
