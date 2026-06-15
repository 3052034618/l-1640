import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { level, handled, page = '1', pageSize = '10' } = req.query;
  let list = [...db.warnings];

  if (level) {
    list = list.filter(w => w.level === level);
  }

  if (handled !== undefined) {
    const isHandled = handled === 'true';
    list = list.filter(w => w.status === (isHandled ? 'handled' : 'pending'));
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const p = Number(page);
  const ps = Number(pageSize);
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);

  const enrichedList = items.map(w => {
    const app = db.applications.find(a => a.id === w.applicationId);
    const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
    const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
    const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
    return {
      ...w,
      employeeName: emp?.name || '',
      roomNumber: room?.roomNumber || '',
      endDate: app?.endDate || '',
    };
  });

  res.json({ total, list: enrichedList });
});

router.post('/scan', (_req: Request, res: Response) => {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const assignedApps = db.applications.filter(a => a.status === 'assigned' && a.endDate);
  let newWarnings = 0;

  for (const app of assignedApps) {
    const endDate = new Date(app.endDate!);
    const existingWarning = db.warnings.find(w => w.applicationId === app.id && w.status === 'pending');
    if (existingWarning) continue;

    if (endDate < now) {
      db.warnings.push({
        id: uuidv4(),
        applicationId: app.id,
        level: 'expired',
        status: 'pending',
        handleAction: null,
        handledAt: null,
        createdAt: now.toISOString(),
      });
      newWarnings++;
    } else if (endDate <= sevenDaysLater) {
      db.warnings.push({
        id: uuidv4(),
        applicationId: app.id,
        level: 'expiring',
        status: 'pending',
        handleAction: null,
        handledAt: null,
        createdAt: now.toISOString(),
      });
      newWarnings++;
    }
  }

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: '',
    employeeName: '系统',
    operationType: 'warning',
    roomNumber: '',
    description: `手动扫描到期预警: 新增${newWarnings}条预警`,
    createdAt: now.toISOString(),
  });

  res.json({ newWarnings });
});

router.put('/:id/handle', (req: Request, res: Response) => {
  const warning = db.warnings.find(w => w.id === req.params.id);
  if (!warning) {
    res.status(404).json({ error: 'Warning not found' });
    return;
  }

  const { action } = req.body;
  const app = db.applications.find(a => a.id === warning.applicationId);
  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
  const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;

  const now = new Date();

  if (action === 'renew') {
    if (app && app.endDate) {
      const newEnd = new Date(app.endDate);
      newEnd.setMonth(newEnd.getMonth() + 6);
      app.endDate = newEnd.toISOString();
    }
  } else if (action === 'extend') {
    if (app && app.endDate) {
      const newEnd = new Date(app.endDate);
      newEnd.setDate(newEnd.getDate() + 30);
      app.endDate = newEnd.toISOString();
    }
  } else if (action === 'checkout') {
    if (app) {
      const coId = uuidv4();
      db.checkouts.push({
        id: coId,
        applicationId: app.id,
        status: 'inspection',
        reason: '到期退房',
        waterReading: 0,
        electricReading: 0,
        waterFee: 0,
        electricFee: 0,
        totalFee: 0,
        sharePerPerson: 0,
        completedAt: null,
        createdAt: now.toISOString(),
        previousWaterReading: 100,
        previousElectricReading: 200,
        facilityDamages: [],
        deposit: 500,
        depositDeducted: 0,
        finalFee: 0,
        paymentStatus: 'unpaid',
        invoiceNumber: null,
        billedAt: null,
      });

      const checklistNames = ['家具完好', '电器正常', '墙面整洁', '门窗完好', '卫生间设施', '空调设备', '热水器', '网络设施'];
      for (const name of checklistNames) {
        db.checklistItems.push({
          id: uuidv4(),
          checkoutId: coId,
          itemName: name,
          status: 'pending',
          remark: '',
        });
      }
    }
  }

  warning.status = 'handled';
  warning.handleAction = action;
  warning.handledAt = now.toISOString();

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app?.employeeId || '',
    employeeName: emp?.name || '',
    operationType: 'warning',
    roomNumber: room?.roomNumber || '',
    description: `处理预警: ${emp?.name || ''} - ${action}`,
    createdAt: now.toISOString(),
  });

  res.json(warning);
});

export default router;
