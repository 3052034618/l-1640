import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { status, keyword, page = '1', pageSize = '10' } = req.query;
  let list = [...db.applications];

  if (status) {
    list = list.filter(a => a.status === status);
  }

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    list = list.filter(a => {
      const emp = db.employees.find(e => e.id === a.employeeId);
      return emp?.name.toLowerCase().includes(kw) || a.department.toLowerCase().includes(kw);
    });
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const p = Number(page);
  const ps = Number(pageSize);
  const total = list.length;
  const start = (p - 1) * ps;
  const items = list.slice(start, start + ps);

  const enrichedList = items.map(a => {
    const emp = db.employees.find(e => e.id === a.employeeId);
    const bed = a.bedId ? db.beds.find(b => b.id === a.bedId) : null;
    const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
    const building = room ? db.buildings.find(b => b.id === room.buildingId) : null;
    return {
      ...a,
      employee: emp ? { id: emp.id, name: emp.name, gender: emp.gender, department: emp.department, position: emp.position, phone: emp.phone, createdAt: emp.createdAt } : null,
      bed: bed ? { ...bed, room: room ? { ...room, buildingName: building?.name } : undefined } : null,
    };
  });

  res.json({ total, list: enrichedList });
});

router.post('/', (req: Request, res: Response) => {
  const { employeeId, gender, department, position, dormitoryType, expectedDate } = req.body;
  const app = {
    id: uuidv4(),
    employeeId,
    gender,
    department,
    position,
    dormitoryType,
    expectedDate,
    status: 'pending' as const,
    bedId: null,
    assignedAt: null,
    rejectedReason: null,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
  };
  db.applications.push(app);
  res.status(201).json(app);
});

router.get('/:id/match-beds', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const matchingBuildings = db.buildings.filter(b => b.gender === app.gender);
  const matchingRooms = db.rooms.filter(r =>
    matchingBuildings.some(b => b.id === r.buildingId) && r.dormitoryType === app.dormitoryType,
  );
  const matchingBeds = db.beds.filter(b =>
    matchingRooms.some(r => r.id === b.roomId) && b.status === 'available',
  );

  const enrichedBeds = matchingBeds.map(bed => {
    const room = db.rooms.find(r => r.id === bed.roomId)!;
    const building = db.buildings.find(b => b.id === room.buildingId)!;
    return { ...bed, roomNumber: room.roomNumber, buildingName: building.name, floor: room.floor, dormitoryType: room.dormitoryType };
  });

  res.json({ beds: enrichedBeds });
});

router.get('/:id', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  const emp = db.employees.find(e => e.id === app.employeeId);
  const bed = app.bedId ? db.beds.find(b => b.id === app.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  const building = room ? db.buildings.find(b => b.id === room.buildingId) : null;
  res.json({
    ...app,
    employee: emp || null,
    bed: bed ? { ...bed, room: room ? { ...room, buildingName: building?.name } : undefined } : null,
  });
});

router.put('/:id/approve', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const { bedId } = req.body;
  const bed = db.beds.find(b => b.id === bedId);
  if (!bed) {
    res.status(400).json({ error: 'Bed not found' });
    return;
  }

  bed.status = 'occupied';
  bed.currentOccupantId = app.employeeId;

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 6);

  app.status = 'assigned';
  app.bedId = bedId;
  app.startDate = now.toISOString();
  app.endDate = end.toISOString();
  app.assignedAt = now.toISOString();

  const emp = db.employees.find(e => e.id === app.employeeId);
  const room = db.rooms.find(r => r.id === bed.roomId);

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app.employeeId,
    employeeName: emp?.name || '',
    operationType: 'checkin',
    roomNumber: room?.roomNumber || '',
    description: `${emp?.name || ''}入住${room?.roomNumber || ''}-${bed.bedNumber}`,
    createdAt: now.toISOString(),
  });

  res.json(app);
});

router.put('/:id/reject', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const { rejectedReason } = req.body;
  app.status = 'rejected';
  app.rejectedReason = rejectedReason || '';

  const emp = db.employees.find(e => e.id === app.employeeId);

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app.employeeId,
    employeeName: emp?.name || '',
    operationType: 'other',
    roomNumber: '',
    description: `${emp?.name || ''}的入住申请被拒绝: ${app.rejectedReason}`,
    createdAt: new Date().toISOString(),
  });

  res.json(app);
});

export default router;
