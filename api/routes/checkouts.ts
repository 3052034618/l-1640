import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { type DamageItem } from '../db.js';

const router = Router();

function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV${year}${month}${day}${random}`;
}

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
    facilityDamages: [] as DamageItem[],
    deposit: 500,
    depositDeducted: 0,
    finalFee: 0,
    paymentStatus: 'unpaid' as const,
    invoiceNumber: null,
    billedAt: null,
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
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  const { items, advance } = req.body as { items: { id: string; status: 'pending' | 'pass' | 'fail'; remark?: string }[]; advance?: boolean };
  for (const item of items) {
    const ci = db.checklistItems.find(c => c.id === item.id);
    if (ci) {
      ci.status = item.status;
      if (item.remark !== undefined) ci.remark = item.remark;
    }
  }

  if (advance) {
    const updatedItems = db.checklistItems.filter(ci => ci.checkoutId === req.params.id);
    const pendingItems = updatedItems.filter(ci => ci.status === 'pending');
    if (pendingItems.length > 0) {
      const names = pendingItems.map(i => i.itemName).join('、');
      res.status(400).json({ error: `尚有未处理检查项：${names}` });
      return;
    }

    if (checkout.status === 'inspection') {
      checkout.status = 'confirming';
    } else if (checkout.status === 'confirming') {
      checkout.status = 'settling';
    }

    const app = db.applications.find(a => a.id === checkout.applicationId);
    const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
    const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
    const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;

    db.operationLogs.push({
      id: uuidv4(),
      employeeId: app?.employeeId || '',
      employeeName: emp?.name || '',
      operationType: 'inspection',
      roomNumber: room?.roomNumber || '',
      description: `${emp?.name || ''}退宿检查${checkout.status === 'confirming' ? '完成，待确认' : '已确认，进入结算'}`,
      createdAt: new Date().toISOString(),
    });
  }

  res.json(checkout);
});

router.put('/:id/settle', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  const { waterReading, electricReading, facilityDamages } = req.body as {
    waterReading: number;
    electricReading: number;
    facilityDamages?: DamageItem[];
  };

  if (waterReading < checkout.previousWaterReading || electricReading < checkout.previousElectricReading) {
    res.status(400).json({ error: '读数小于上次读数' });
    return;
  }

  const updatedItems = db.checklistItems.filter(ci => ci.checkoutId === req.params.id);
  const pendingItems = updatedItems.filter(ci => ci.status === 'pending');
  if (pendingItems.length > 0) {
    const names = pendingItems.map(i => i.itemName).join('、');
    res.status(400).json({ error: `尚有未处理检查项：${names}` });
    return;
  }

  const damages = facilityDamages || checkout.facilityDamages || [];
  const waterFee = Math.round((waterReading - checkout.previousWaterReading) * 5 * 100) / 100;
  const electricFee = Math.round((electricReading - checkout.previousElectricReading) * 0.8 * 100) / 100;
  const damagesTotal = Math.round(damages.reduce((sum, d) => sum + d.amount, 0) * 100) / 100;
  const totalFee = Math.round((waterFee + electricFee + damagesTotal) * 100) / 100;
  const depositDeducted = Math.round(Math.min(totalFee, checkout.deposit) * 100) / 100;
  const finalFee = Math.round((totalFee - depositDeducted) * 100) / 100;

  if (finalFee < 0) {
    res.status(400).json({ error: '费用异常，请核对' });
    return;
  }

  const app = db.applications.find(a => a.id === checkout.applicationId);
  const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  const capacity = room?.capacity || 1;
  const sharePerPerson = Math.round(finalFee / capacity * 100) / 100;

  checkout.waterReading = waterReading;
  checkout.electricReading = electricReading;
  checkout.waterFee = waterFee;
  checkout.electricFee = electricFee;
  checkout.facilityDamages = damages;
  checkout.depositDeducted = depositDeducted;
  checkout.totalFee = totalFee;
  checkout.finalFee = finalFee;
  checkout.sharePerPerson = sharePerPerson;
  checkout.status = 'completed';
  checkout.completedAt = new Date().toISOString();
  checkout.paymentStatus = 'paid';
  checkout.billedAt = new Date().toISOString();
  checkout.invoiceNumber = generateInvoiceNumber();

  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;

  if (app?.bedId) {
    const bedToUpdate = db.beds.find(b => b.id === app.bedId);
    if (bedToUpdate) {
      bedToUpdate.status = 'available';
      bedToUpdate.currentOccupantId = null;
    }
  }

  const roomForLog = bed ? db.rooms.find(r => r.id === bed.roomId) : null;

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app?.employeeId || '',
    employeeName: emp?.name || '',
    operationType: 'checkout',
    roomNumber: roomForLog?.roomNumber || '',
    description: `${emp?.name || ''}退房结算完成: 水费${waterFee}元, 电费${electricFee}元, 赔偿${damagesTotal}元, 押金抵扣${depositDeducted}元, 实付${finalFee}元, 已释放床位`,
    createdAt: new Date().toISOString(),
  });

  res.json(checkout);
});

router.get('/:id/invoice', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  const app = db.applications.find(a => a.id === checkout.applicationId);
  const emp = app ? db.employees.find(e => e.id === app.employeeId) : null;
  const bed = app?.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  const building = room ? db.buildings.find(b => b.id === room.buildingId) : null;
  const checklist = db.checklistItems.filter(ci => ci.checkoutId === req.params.id);

  const passCount = checklist.filter(i => i.status === 'pass').length;
  const failCount = checklist.filter(i => i.status === 'fail').length;

  const invoice = {
    invoiceNumber: checkout.invoiceNumber || generateInvoiceNumber(),
    billedAt: checkout.billedAt || checkout.completedAt || new Date().toISOString(),
    employee: emp ? {
      id: emp.id,
      name: emp.name,
      gender: emp.gender,
      department: emp.department,
      position: emp.position,
      phone: emp.phone,
    } : null,
    room: room ? {
      buildingName: building?.name || '',
      roomNumber: room.roomNumber,
      floor: room.floor,
      dormitoryType: room.dormitoryType,
      bedNumber: bed?.bedNumber || null,
    } : null,
    dates: {
      checkinDate: app?.startDate || null,
      checkoutDate: app?.endDate || checkout.completedAt || new Date().toISOString(),
      applyDate: checkout.createdAt,
    },
    checklistSummary: {
      total: checklist.length,
      pass: passCount,
      fail: failCount,
      items: checklist.map(i => ({
        itemName: i.itemName,
        status: i.status,
        remark: i.remark,
      })),
    },
    utilities: {
      water: {
        previousReading: checkout.previousWaterReading,
        currentReading: checkout.waterReading,
        usage: checkout.waterReading - checkout.previousWaterReading,
        unitPrice: 5,
        fee: checkout.waterFee,
      },
      electric: {
        previousReading: checkout.previousElectricReading,
        currentReading: checkout.electricReading,
        usage: checkout.electricReading - checkout.previousElectricReading,
        unitPrice: 0.8,
        fee: checkout.electricFee,
      },
    },
    facilityDamages: checkout.facilityDamages || [],
    damagesTotal: (checkout.facilityDamages || []).reduce((sum, d) => sum + d.amount, 0),
    deposit: {
      original: checkout.deposit,
      deducted: checkout.depositDeducted,
      remaining: checkout.deposit - checkout.depositDeducted,
    },
    totalFee: checkout.totalFee,
    finalFee: checkout.finalFee,
    paymentStatus: checkout.paymentStatus,
  };

  res.json(invoice);
});

router.put('/:id/complete', (req: Request, res: Response) => {
  const checkout = db.checkouts.find(c => c.id === req.params.id);
  if (!checkout) {
    res.status(404).json({ error: 'Checkout not found' });
    return;
  }

  if (checkout.status === 'completed') {
    res.json(checkout);
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
