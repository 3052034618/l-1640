import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type {
  PreviewData,
  PreviewBuildItem,
  PreviewRoomItem,
  RollbackIds,
  CreatedBuilding,
  CreatedRoom,
  CreatedBed,
  FailedRow,
  ImportHistory,
} from '../db.js';

const router = Router();

const capacityMap: Record<string, number> = { single: 1, double: 2, quad: 4, 单人间: 1, 双人间: 2, 四人间: 4 };
const typeMap: Record<string, 'single' | 'double' | 'quad'> = { single: 'single', double: 'double', quad: 'quad', 单人间: 'single', 双人间: 'double', 四人间: 'quad' };
const genderMap: Record<string, 'male' | 'female'> = { male: 'male', female: 'female', 男: 'male', 女: 'female' };

const getVal = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
  }
  return undefined;
};

interface ValidateResult {
  buildings: PreviewBuildItem[];
  rooms: PreviewRoomItem[];
  errors: { row: number; message: string }[];
  failedRows: FailedRow[];
  validData: Record<string, unknown>[];
}

const validateData = (data: Record<string, unknown>[]): ValidateResult => {
  const buildings: PreviewBuildItem[] = [];
  const rooms: PreviewRoomItem[] = [];
  const errors: { row: number; message: string }[] = [];
  const failedRows: FailedRow[] = [];
  const validData: Record<string, unknown>[] = [];
  const buildingNames = new Set<string>();
  const existingBuildingMap: Record<string, PreviewBuildItem> = {};
  const roomKeySet = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const buildingName = String(getVal(row, ['楼栋名称', '楼栋', 'buildingName', 'building']) || '').trim();
    const genderRaw = String(getVal(row, ['性别', 'gender']) || '').trim();
    const floorsRaw = getVal(row, ['楼层数', '楼层', 'floors']);
    const floorRaw = getVal(row, ['楼层号', '所在楼层', 'floor']);
    const roomNumber = String(getVal(row, ['房间号', '房号', 'roomNumber', 'room']) || '').trim();
    const typeRaw = String(getVal(row, ['房型', '宿舍类型', 'dormitoryType', 'type']) || '').trim();

    const rowErrors: string[] = [];

    if (!buildingName) rowErrors.push('楼栋名称不能为空');
    if (!genderRaw || !genderMap[genderRaw]) rowErrors.push(`性别"${genderRaw}"无效，应为男/女`);
    if (!floorRaw) rowErrors.push('楼层号不能为空');
    else if (Number(floorRaw) < 1) rowErrors.push('楼层号必须大于0');
    if (!roomNumber) rowErrors.push('房间号不能为空');
    if (!typeRaw || !typeMap[typeRaw]) rowErrors.push(`房型"${typeRaw}"无效，应为单人间/双人间/四人间`);

    if (rowErrors.length > 0) {
      const msg = rowErrors.join('；');
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      continue;
    }

    const gender = genderMap[genderRaw];
    const dormitoryType = typeMap[typeRaw];
    const capacity = capacityMap[typeRaw];
    const floor = Number(floorRaw);
    const floors = floorsRaw ? Number(floorsRaw) : floor;

    const existingBuilding = db.buildings.find(b => b.name === buildingName);
    if (existingBuilding) {
      if (existingBuilding.gender !== gender) {
        const msg = `楼栋"${buildingName}"性别为${existingBuilding.gender === 'male' ? '男' : '女'}生，与当前行${genderRaw}生不一致`;
        errors.push({ row: rowNum, message: msg });
        failedRows.push({ row: rowNum, data: { ...row }, message: msg });
        continue;
      }
      if (floor > existingBuilding.floors) {
        const msg = `楼层${floor}超出楼栋"${buildingName}"的总楼层数${existingBuilding.floors}`;
        errors.push({ row: rowNum, message: msg });
        failedRows.push({ row: rowNum, data: { ...row }, message: msg });
        continue;
      }
    } else {
      if (!buildingNames.has(buildingName)) {
        const prev = existingBuildingMap[buildingName];
        if (prev && prev.gender !== gender) {
          const msg = `楼栋"${buildingName}"性别不一致`;
          errors.push({ row: rowNum, message: msg });
          failedRows.push({ row: rowNum, data: { ...row }, message: msg });
          continue;
        }
        if (floor > prev.floors) {
          prev.floors = floor;
        }
      } else {
        buildingNames.add(buildingName);
        const newBuilding: PreviewBuildItem = { name: buildingName, gender, floors };
        buildings.push(newBuilding);
        existingBuildingMap[buildingName] = newBuilding;
      }
    }

    const existingRoom = db.rooms.find(r => {
      const b = db.buildings.find(bb => bb.id === r.buildingId)?.name === buildingName;
      return b && r.roomNumber === roomNumber;
    });
    if (existingRoom) {
      const msg = `房间号${roomNumber}在楼栋"${buildingName}"中已存在`;
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      continue;
    }

    const roomKey = `${buildingName}-${roomNumber}`;
    if (roomKeySet.has(roomKey)) {
      const msg = `房间号${roomNumber}在导入数据中重复`;
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      continue;
    }
    roomKeySet.add(roomKey);

    rooms.push({ buildingName, floor, roomNumber, dormitoryType, capacity });
    validData.push(row);
  }

  return { buildings, rooms, errors, failedRows, validData };
};

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
  const { data } = req.body as { data: Record<string, unknown>[] };

  if (!Array.isArray(data) || data.length === 0) {
    res.status(400).json({ success: 0, failed: 0, errors: [{ row: 0, message: '导入数据为空' }] });
    return;
  }

  let success = 0;
  let failed = 0;
  const errors: { row: number; message: string }[] = [];

  const buildingCache: Record<string, string> = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const buildingName = String(getVal(row, ['楼栋名称', '楼栋', 'buildingName', 'building']) || '').trim();
    const genderRaw = String(getVal(row, ['性别', 'gender']) || '').trim();
    const floorsRaw = getVal(row, ['楼层数', '楼层', 'floors']);
    const floorRaw = getVal(row, ['楼层号', '所在楼层', 'floor']);
    const roomNumber = String(getVal(row, ['房间号', '房号', 'roomNumber', 'room']) || '').trim();
    const typeRaw = String(getVal(row, ['房型', '宿舍类型', 'dormitoryType', 'type']) || '').trim();

    const rowErrors: string[] = [];

    if (!buildingName) rowErrors.push('楼栋名称不能为空');
    if (!genderRaw || !genderMap[genderRaw]) rowErrors.push(`性别"${genderRaw}"无效，应为男/女`);
    if (!floorRaw) rowErrors.push('楼层号不能为空');
    else if (Number(floorRaw) < 1) rowErrors.push('楼层号必须大于0');
    if (!roomNumber) rowErrors.push('房间号不能为空');
    if (!typeRaw || !typeMap[typeRaw]) rowErrors.push(`房型"${typeRaw}"无效，应为单人间/双人间/四人间`);

    if (rowErrors.length > 0) {
      failed++;
      errors.push({ row: rowNum, message: rowErrors.join('；') });
      continue;
    }

    const gender = genderMap[genderRaw];
    const dormitoryType = typeMap[typeRaw];
    const capacity = capacityMap[typeRaw];
    const floor = Number(floorRaw);
    const floors = floorsRaw ? Number(floorsRaw) : floor;

    let buildingId = buildingCache[buildingName];
    if (!buildingId) {
      const existing = db.buildings.find(b => b.name === buildingName);
      if (existing) {
        buildingId = existing.id;
        if (floor > existing.floors) {
          existing.floors = floor;
        }
      } else {
        buildingId = uuidv4();
        db.buildings.push({
          id: buildingId,
          name: buildingName,
          gender,
          floors,
          totalRooms: 0,
          createdAt: new Date().toISOString(),
        });
      }
      buildingCache[buildingName] = buildingId;
    }

    const building = db.buildings.find(b => b.id === buildingId)!;
    if (building.gender !== gender) {
      failed++;
      errors.push({ row: rowNum, message: `楼栋"${buildingName}"性别为${building.gender === 'male' ? '男' : '女'}生，与当前行${genderRaw}生不一致` });
      continue;
    }

    if (floor > building.floors) {
      failed++;
      errors.push({ row: rowNum, message: `楼层${floor}超出楼栋"${buildingName}"的总楼层数${building.floors}` });
      continue;
    }

    const existingRoom = db.rooms.find(r => r.buildingId === buildingId && r.roomNumber === roomNumber);
    if (existingRoom) {
      failed++;
      errors.push({ row: rowNum, message: `房间号${roomNumber}在楼栋"${buildingName}"中已存在` });
      continue;
    }

    const rId = uuidv4();
    db.rooms.push({
      id: rId,
      buildingId,
      floor,
      roomNumber,
      dormitoryType,
      capacity,
      createdAt: new Date().toISOString(),
    });

    for (let b = 1; b <= capacity; b++) {
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

  for (const bid of Object.values(buildingCache)) {
    const building = db.buildings.find(b => b.id === bid);
    if (building) {
      building.totalRooms = db.rooms.filter(r => r.buildingId === bid).length;
    }
  }

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: '',
    employeeName: '系统',
    operationType: 'import',
    roomNumber: '',
    description: `批量导入宿舍数据: 成功${success}, 失败${failed}`,
    createdAt: new Date().toISOString(),
  });

  res.json({ success, failed, errors });
});

router.post('/preview', (req: Request, res: Response) => {
  const { data, filename } = req.body as { data: Record<string, unknown>[]; filename: string };

  if (!Array.isArray(data) || data.length === 0) {
    res.status(400).json({ error: '导入数据为空' });
    return;
  }

  const result = validateData(data);
  const previewId = uuidv4();
  const previewData: PreviewData = {
    previewId,
    buildings: result.buildings,
    rooms: result.rooms,
    errors: result.errors,
    failedRows: result.failedRows,
    validData: result.validData,
    rawData: data,
    filename: filename || 'import.xlsx',
    createdAt: new Date().toISOString(),
  };

  db.previewCache[previewId] = previewData;

  setTimeout(() => {
    delete db.previewCache[previewId];
  }, 30 * 60 * 1000);

  const totalBeds = result.rooms.reduce((sum, r) => sum + r.capacity, 0);

  res.json({
    previewId,
    buildings: result.buildings,
    rooms: result.rooms,
    errors: result.errors,
    failedRows: result.failedRows,
    totalNew: result.rooms.length,
    totalBeds,
  });
});

router.post('/confirm', (req: Request, res: Response) => {
  const { previewId } = req.body as { previewId: string };

  const preview = db.previewCache[previewId];
  if (!preview) {
    res.status(404).json({ error: '预览数据不存在或已过期' });
    return;
  }

  const data = preview.validData;
  let successCount = 0;
  let failedCount = preview.errors.length;
  const errors = [...preview.errors];
  const failedRows = [...preview.failedRows];
  const rollbackIds: RollbackIds = { buildingIds: [], roomIds: [], bedIds: [] };
  const buildingCache: Record<string, string> = {};
  const createdBuildings: CreatedBuilding[] = [];
  const createdRooms: CreatedRoom[] = [];
  const createdBeds: CreatedBed[] = [];
  const createdBuildingSet = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;

    const buildingName = String(getVal(row, ['楼栋名称', '楼栋', 'buildingName', 'building']) || '').trim();
    const genderRaw = String(getVal(row, ['性别', 'gender']) || '').trim();
    const floorsRaw = getVal(row, ['楼层数', '楼层', 'floors']);
    const floorRaw = getVal(row, ['楼层号', '所在楼层', 'floor']);
    const roomNumber = String(getVal(row, ['房间号', 'roomNumber', 'room']) || '').trim();
    const typeRaw = String(getVal(row, ['房型', '宿舍类型', 'dormitoryType', 'type']) || '').trim();

    const gender = genderMap[genderRaw];
    const dormitoryType = typeMap[typeRaw];
    const capacity = capacityMap[typeRaw];
    const floor = Number(floorRaw);
    const floors = floorsRaw ? Number(floorsRaw) : floor;

    let buildingId = buildingCache[buildingName];
    if (!buildingId) {
      const existing = db.buildings.find(b => b.name === buildingName);
      if (existing) {
        buildingId = existing.id;
        if (floor > existing.floors) {
          existing.floors = floor;
        }
      } else {
        buildingId = uuidv4();
        const newBuilding = {
          id: buildingId,
          name: buildingName,
          gender,
          floors,
          totalRooms: 0,
          createdAt: new Date().toISOString(),
        };
        db.buildings.push(newBuilding);
        buildingCache[buildingName] = buildingId;
        createdBuildingSet.add(buildingId);
        rollbackIds.buildingIds.push(buildingId);
        createdBuildings.push({
          id: buildingId,
          name: buildingName,
          gender,
          floors,
          totalRooms: 0,
        });
      }
    }

    const building = db.buildings.find(b => b.id === buildingId)!;
    if (building.gender !== gender) {
      const msg = `楼栋"${buildingName}"性别不一致`;
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      failedCount++;
      continue;
    }

    if (floor > building.floors) {
      const msg = `楼层${floor}超出楼栋"${buildingName}"的总楼层数${building.floors}`;
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      continue;
    }

    const existingRoom = db.rooms.find(r => r.buildingId === buildingId && r.roomNumber === roomNumber);
    if (existingRoom) {
      const msg = `房间号${roomNumber}在楼栋"${buildingName}"中已存在`;
      errors.push({ row: rowNum, message: msg });
      failedRows.push({ row: rowNum, data: { ...row }, message: msg });
      failedCount++;
      continue;
    }

    const rId = uuidv4();
    db.rooms.push({
      id: rId,
      buildingId,
      floor,
      roomNumber,
      dormitoryType,
      capacity,
      createdAt: new Date().toISOString(),
    });
    rollbackIds.roomIds.push(rId);

    const bedIdsForRoom: string[] = [];
    for (let b = 1; b <= capacity; b++) {
      const bedId = uuidv4();
      db.beds.push({
        id: bedId,
        roomId: rId,
        bedNumber: b,
        status: 'available',
        currentOccupantId: null,
        createdAt: new Date().toISOString(),
      });
      rollbackIds.bedIds.push(bedId);
      bedIdsForRoom.push(bedId);
      createdBeds.push({
        id: bedId,
        roomNumber,
        bedNumber: b,
        buildingName,
      });
    }

    createdRooms.push({
      id: rId,
      buildingName,
      floor,
      roomNumber,
      dormitoryType,
      capacity,
      bedCount: capacity,
    });

    successCount++;
  }

  for (const bid of Object.values(buildingCache)) {
    const building = db.buildings.find(b => b.id === bid);
    if (building) {
      building.totalRooms = db.rooms.filter(r => r.buildingId === bid).length;
      const cb = createdBuildings.find(b => b.id === bid);
      if (cb) {
        cb.totalRooms = building.totalRooms;
      }
    }
  }

  const historyId = uuidv4();
  db.importHistories.unshift({
    id: historyId,
    createdAt: new Date().toISOString(),
    operator: '系统',
    fileName: preview.filename,
    successCount,
    failedCount,
    rollbackIds,
    errors,
    status: 'confirmed',
    createdBuildings,
    createdRooms,
    createdBeds,
    failedRows,
  });

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: '',
    employeeName: '系统',
    operationType: 'import',
    roomNumber: '',
    description: `批量导入宿舍数据: 成功${successCount}, 失败${failedCount}`,
    createdAt: new Date().toISOString(),
  });

  delete db.previewCache[previewId];

  res.json({
    id: historyId,
    successCount,
    failedCount,
    errors,
    rollbackIds,
    createdBuildings,
    createdRooms,
    createdBeds,
    failedRows,
  });
});

router.get('/import-history', (_req: Request, res: Response) => {
  const list = db.importHistories.map(h => ({
    id: h.id,
    createdAt: h.createdAt,
    operator: h.operator,
    fileName: h.fileName,
    successCount: h.successCount,
    failedCount: h.failedCount,
    rollbackIds: h.rollbackIds,
    errors: h.errors,
    status: h.status,
    canRollback: h.status === 'confirmed',
  }));
  res.json(list);
});

router.get('/import-history/:id', (req: Request, res: Response) => {
  const history = db.importHistories.find(h => h.id === req.params.id);
  if (!history) {
    res.status(404).json({ error: '导入记录不存在' });
    return;
  }

  const buildingDetail = history.createdBuildings.map(b => {
    const realBuilding = db.buildings.find(bb => bb.id === b.id);
    return {
      ...b,
      exists: !!realBuilding,
    };
  });

  const roomDetail = history.createdRooms.map(r => {
    const realRoom = db.rooms.find(rr => rr.id === r.id);
    return {
      ...r,
      exists: !!realRoom,
    };
  });

  const bedDetail = history.createdBeds.map(b => {
    const realBed = db.beds.find(bb => bb.id === b.id);
    return {
      ...b,
      exists: !!realBed,
      status: realBed?.status || null,
    };
  });

  res.json({
    ...history,
    buildings: buildingDetail,
    rooms: roomDetail,
    beds: bedDetail,
  });
});

const checkRollbackAvailability = (history: ImportHistory) => {
  if (history.status === 'rolledback') {
    return { canRollback: false, reason: '该导入记录已被撤回' };
  }

  const { roomIds, bedIds } = history.rollbackIds;
  const occupiedBeds = db.beds.filter(bed =>
    bedIds.includes(bed.id) && bed.status === 'occupied'
  );

  if (occupiedBeds.length > 0) {
    const occupiedBedList = occupiedBeds.map(bed => {
      const room = db.rooms.find(r => r.id === bed.roomId);
      const building = db.buildings.find(b => b.id === room?.buildingId);
      return {
        id: bed.id,
        bedNumber: bed.bedNumber,
        roomNumber: room?.roomNumber || '',
        buildingName: building?.name || '',
      };
    });
    return {
      canRollback: false,
      reason: `撤回失败：${occupiedBeds.length}个床位已被入住，无法撤回`,
      occupiedCount: occupiedBeds.length,
      occupiedBeds: occupiedBedList,
    };
  }

  return { canRollback: true };
};

router.get('/import-history/:id/rollback-preview', (req: Request, res: Response) => {
  const history = db.importHistories.find(h => h.id === req.params.id);
  if (!history) {
    res.status(404).json({ error: '导入记录不存在' });
    return;
  }

  const checkResult = checkRollbackAvailability(history);

  const buildingNames = history.createdBuildings.map(b => b.name);
  const roomList = history.createdRooms.map(r => ({
    buildingName: r.buildingName,
    floor: r.floor,
    roomNumber: r.roomNumber,
  }));
  const bedList = history.createdBeds.map(b => ({
    buildingName: b.buildingName,
    roomNumber: b.roomNumber,
    bedNumber: b.bedNumber,
  }));

  res.json({
    canRollback: checkResult.canRollback,
    reason: checkResult.reason || null,
    occupiedCount: (checkResult as any).occupiedCount || 0,
    occupiedBeds: (checkResult as any).occupiedBeds || [],
    buildingCount: history.createdBuildings.length,
    roomCount: history.createdRooms.length,
    bedCount: history.createdBeds.length,
    buildingNames,
    rooms: roomList,
    beds: bedList,
    riskWarning: checkResult.canRollback
      ? '撤回操作将删除上述所有楼栋、房间和床位，请确认是否继续？'
      : checkResult.reason,
  });
});

router.post('/import-history/:id/rollback', (req: Request, res: Response) => {
  const history = db.importHistories.find(h => h.id === req.params.id);
  if (!history) {
    res.status(404).json({ error: '导入记录不存在' });
    return;
  }

  const checkResult = checkRollbackAvailability(history);
  if (!checkResult.canRollback) {
    res.status(400).json({
      error: checkResult.reason,
      occupiedCount: (checkResult as any).occupiedCount || 0,
      occupiedBeds: (checkResult as any).occupiedBeds || [],
    });
    return;
  }

  const { bedIds, roomIds, buildingIds } = history.rollbackIds;

  for (const bedId of bedIds) {
    const idx = db.beds.findIndex(b => b.id === bedId);
    if (idx > -1) db.beds.splice(idx, 1);
  }

  for (const roomId of roomIds) {
    const idx = db.rooms.findIndex(r => r.id === roomId);
    if (idx > -1) db.rooms.splice(idx, 1);
  }

  for (const buildingId of buildingIds) {
    const remainingRooms = db.rooms.filter(r => r.buildingId === buildingId);
    if (remainingRooms.length === 0) {
      const idx = db.buildings.findIndex(b => b.id === buildingId);
      if (idx > -1) db.buildings.splice(idx, 1);
    } else {
      const building = db.buildings.find(b => b.id === buildingId);
      if (building) {
        building.totalRooms = remainingRooms.length;
      }
    }
  }

  history.status = 'rolledback';

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: '',
    employeeName: '系统',
    operationType: 'import',
    roomNumber: '',
    description: `撤回导入记录: ${history.fileName}`,
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, message: '撤回成功' });
});

export default router;
