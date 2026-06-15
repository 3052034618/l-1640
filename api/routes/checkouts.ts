import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, keyword, page = '1', pageSize = '10' } = req.query;
  let list = [...db.checkouts];

  if (status) {
    list = list.filter(c => c.status === status);
  }

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(c => {
      const app = db.applications.find(a => a.id === c.applicationId);
      const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
      return emp?.name.toLowerCase().includes(kw) || c.reason.toLowerCase().includes(kw);
    });
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const p = Number(page);
  const ps = Number(pageSize);
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);

  const enrichedList = items.map(c => {
    const app = db.applications.find(a => a.id === c.applicationId);
    const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
    const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
    const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
    return {
      ...c,
      employeeName: emp?.name || '',
      roomNumber: room?.roomNumber || '',
    };
  });

  res.json({ total, list: enrichedList });
});

router.post('/', (req: Request, res: Response) => {
  const { applicationId, reason } = req.body;
  const app = db.applications.find(a => a.id === applicationId);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const emp = db.employees.find(e => e.id === app.employeeId);
  const bed = app.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;

  const coId = uuidv4();
  const checkout = {
    id: coId,
    applicationId,
    status: 'inspection' as const,
    reason: reason || '',
    waterReading: 0,
    electricReading: 0,
    waterFee: 0,
    electricFee: 0,
    totalFee: 0,
    sharePerPerson: 0,
    completedAt: null,
    createdAt: new Date().toISOString(),
    previousWaterReading: 100,
    previousElectricReading: 200,
  };
  db.checkouts.push(checkout);

  const checklistNames = ['家具完好', '电器正常', '墙面整洁', '门窗完好', '卫生间设施', '空调设备', '热水器', '网络设施'];
  for (const name of checklistNames) {
    db.checklistItems.push({
      id: uuidv4(),
      checkoutId: coId,
      itemName: name,
      status: 'pending' as const,
      remark: '',
    });
  }

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app.employeeId,
    employeeName: emp?.name || '',
    operationType: 'checkout',
    roomNumber: room?.roomNumber || '',
    description: `${emp?.name || ''}申请退房${room?.roomNumber || ''}`,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(checkout);
});

router.get('/:id/checklist', (req: Request, res: Response) => {
  const items = db.checklistItems.filter(ci => ci.checkoutId === req.params.id);
  res.json({ items });
});

router.get('/:id', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }
  const app = db.applications.find(a => a.id === checkout.applicationId);
  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
  const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  res.json({
    ...checkout,
    employeeName: emp?.name || '',
    roomNumber: room?.roomNumber || '',
  });
});

router.put('/:id/checklist', (req: Request, res: Response) => {
  const { items } = req.body as { items: { id: string; status: 'pending' | 'pass' | 'fail'; remark?: string }[] };
  for (const item of items) {
    const ci = db.checklistItems.find(c => c.id === item.id);
    if (ci) {
      ci.status = item.status;
      if (item.remark !== undefined) ci.remark = item.remark;
    }
  }
  res.json({ success: true });
});

router.put('/:id/settle', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  const { waterReading, electricReading } = req.body;
  checkout.waterReading = waterReading;
  checkout.electricReading = electricReading;

  const waterFee = (waterReading - checkout.previousWaterReading) * 5;
  const electricFee = (electricReading - checkout.previousElectricReading) * 0.8;
  const totalFee = waterFee + electricFee;

  const app = db.applications.find(a => a.id === checkout.applicationId);
  const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  const capacity = room?.capacity || 1;
  const sharePerPerson = Math.round(totalFee / capacity * 100) / 100;

  checkout.waterFee = Math.round(waterFee * 100) / 100;
  checkout.electricFee = Math.round(electricFee * 100) / 100;
  checkout.totalFee = Math.round(totalFee * 100) / 100;
  checkout.sharePerPerson = sharePerPerson;
  checkout.status = 'settling';

  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app?.employeeId || '',
    employeeName: emp?.name || '',
    operationType: 'checkout',
    roomNumber: room?.roomNumber || '',
    description: `${emp?.name || ''}退房结算: 水费${checkout.waterFee}元, 电费${checkout.electricFee}元`,
    createdAt: new Date().toISOString(),
  });

  res.json(checkout);
});

router.put('/:id/complete', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  checkout.status = 'completed';
  checkout.completedAt = new Date().toISOString();

  const app = db.applications.find(a => a.id === checkout.applicationId);
  if (app?.bedId) {
    const bed = db.beds.find(b => b.id === app.bedId);
    if (bed) {
      bed.status = 'available';
      bed.currentOccupantId = null;
    }
  }

  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
  const bed2 = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed2 ? db.rooms.find(r => r.id === bed2.roomId) : null;

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app?.employeeId || '',
    employeeName: emp?.name || '',
    operationType: 'checkout',
    roomNumber: room?.roomNumber || '',
    description: `${emp?.name || ''}完成退房${room?.roomNumber || ''}`,
    createdAt: new Date().toISOString(),
  });

  res.json(checkout);
});

export default router;
