import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const list = db.buildings.map(b => {
    const bRooms = db.rooms.filter(r => r.buildingId === b.id);
    const bBeds = bRooms.flatMap(r => db.beds.filter(bed => bed.roomId === r.id));
    const occupied = bBeds.filter(bed => bed.status === 'occupied').length;
    const available = bBeds.filter(bed => bed.status === 'available').length;
    const maintenance = bBeds.filter(bed => bed.status === 'maintenance').length;
    return {
      ...b,
      totalBeds: bBeds.length,
      occupiedBeds: occupied,
      availableBeds: available,
      maintenanceBeds: maintenance,
      occupancyRate: bBeds.length > 0 ? Math.round(occupied / bBeds.length * 100) : 0,
    };
  });
  res.json(list);
});

router.get('/:id/rooms', (req: Request, res: Response) => {
  const building = db.buildings.find(b => b.id === req.params.id);
  if (!building) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const bRooms = db.rooms.filter(r => r.buildingId === req.params.id);
  const enriched = bRooms.map(r => {
    const rBeds = db.beds.filter(b => b.roomId === r.id);
    const bedsWithOccupant = rBeds.map(bed => {
      const occupant = bed.currentOccupantId ? db.employees.find(e => e.id === bed.currentOccupantId) : null;
      return { ...bed, occupantName: occupant?.name || null };
    });
    return { ...r, beds: bedsWithOccupant };
  });

  res.json({ building, rooms: enriched });
});

router.post('/import', (req: Request, res: Response) => {
  const { buildingId, rooms: roomDataList } = req.body as {
    buildingId: string;
    rooms: { floor: number; roomNumber: string; dormitoryType: 'single' | 'double' | 'quad' }[];
  };

  const building = db.buildings.find(b => b.id === buildingId);
  if (!building) {
    res.status(404).json({ error: 'Building not found' });
    return;
  }

  const capacityMap: Record<string, number> = { single: 1, double: 2, quad: 4 };
  let success = 0;
  let failed = 0;
  const errors: { roomNumber: string; reason: string }[] = [];

  for (const rd of roomDataList) {
    if (rd.floor < 1 || rd.floor > building.floors) {
      failed++;
      errors.push({ roomNumber: rd.roomNumber, reason: `楼层${rd.floor}不存在` });
      continue;
    }

    const expected = capacityMap[rd.dormitoryType];
    if (!expected) {
      failed++;
      errors.push({ roomNumber: rd.roomNumber, reason: `无效的房型${rd.dormitoryType}` });
      continue;
    }

    const existing = db.rooms.find(r => r.buildingId === buildingId && r.roomNumber === rd.roomNumber);
    if (existing) {
      failed++;
      errors.push({ roomNumber: rd.roomNumber, reason: '房间号已存在' });
      continue;
    }

    const rId = uuidv4();
    db.rooms.push({
      id: rId,
      buildingId,
      floor: rd.floor,
      roomNumber: rd.roomNumber,
      dormitoryType: rd.dormitoryType,
      capacity: expected,
      createdAt: new Date().toISOString(),
    });

    for (let b = 1; b <= expected; b++) {
      db.beds.push({
        id: uuidv4(),
        roomId: rId,
        bedNumber: b,
        status: 'available',
        currentOccupantId: null,
        createdAt: new Date().toISOString(),
      });
    }

    success++;
  }

  building.totalRooms = db.rooms.filter(r => r.buildingId === buildingId).length;

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: '',
    employeeName: '系统',
    operationType: 'import',
    roomNumber: '',
    description: `批量导入${building.name}房间: 成功${success}, 失败${failed}`,
    createdAt: new Date().toISOString(),
  });

  res.json({ success, failed, errors });
});

export default router;
