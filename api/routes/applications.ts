import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const router = Router();

function getDepartments(): string[] {
  const depts = new Set<string>();
  for (const emp of db.employees) depts.add(emp.department);
  return Array.from(depts);
}

function getEffectiveRules() {
  const now = new Date();
  const nowStr = now.toISOString().split('T')[0];

  const isEffective = (rule: { enabled: boolean; startDate: string | null; endDate: string | null }) => {
    if (!rule.enabled) return false;
    if (rule.startDate && rule.startDate > nowStr) return false;
    if (rule.endDate && rule.endDate < nowStr) return false;
    return true;
  };

  return {
    departmentPriorities: db.departmentPriorities.filter(isEffective),
    buildingPreferences: db.buildingPreferences.filter(isEffective),
    forbiddenRules: db.forbiddenRules.filter(isEffective),
  };
}

function getRuleStatus(rule: { enabled: boolean; startDate: string | null; endDate: string | null }): 'active' | 'inactive' | 'expired' | 'upcoming' {
  const nowStr = new Date().toISOString().split('T')[0];
  if (!rule.enabled) return 'inactive';
  if (rule.startDate && rule.startDate > nowStr) return 'upcoming';
  if (rule.endDate && rule.endDate < nowStr) return 'expired';
  return 'active';
}

function getRoomNumber(bedId: string): string {
  const bed = db.beds.find(b => b.id === bedId);
  if (!bed) return '';
  const room = db.rooms.find(r => r.id === bed.roomId);
  return room ? room.roomNumber : '';
}

function getBedWithInfo(bedId: string) {
  const bed = db.beds.find(b => b.id === bedId);
  if (!bed) return null;
  const room = db.rooms.find(r => r.id === bed.roomId);
  if (!room) return null;
  const building = db.buildings.find(b => b.id === room.buildingId);
  return { bed, room, building };
}

function enrichApplication(a: any) {
  const emp = db.employees.find(e => e.id === a.employeeId);
  const bed = a.bedId ? db.beds.find(b => b.id === a.bedId) : null;
  const room = bed ? db.rooms.find(r => r.id === bed.roomId) : null;
  const building = room ? db.buildings.find(b => b.id === room.buildingId) : null;
  return {
    ...a,
    employee: emp ? { id: emp.id, name: emp.name, gender: emp.gender, department: emp.department, position: emp.position, phone: emp.phone, createdAt: emp.createdAt } : null,
    bed: bed ? { ...bed, room: room ? { ...room, buildingName: building?.name } : undefined } : null,
  };
}

function buildMatchedBeds(app: any, includePriority: boolean = true) {
  const effectiveRules = getEffectiveRules();

  const forbiddenBuildings = effectiveRules.forbiddenRules
    .filter(r => r.department === app.department)
    .map(r => r.buildingId);

  const matchingBuildings = db.buildings.filter(b =>
    b.gender === app.gender && !forbiddenBuildings.includes(b.id)
  );

  const buildingPrefMap = new Map<string, number>();
  for (const pref of effectiveRules.buildingPreferences.filter(p => p.department === app.department)) {
    buildingPrefMap.set(pref.buildingId, pref.priority);
  }

  const matchingRooms = db.rooms.filter(r =>
    matchingBuildings.some(b => b.id === r.buildingId) && r.dormitoryType === app.dormitoryType,
  );

  const matchingBeds = db.beds.filter(b =>
    matchingRooms.some(r => r.id === b.roomId) && b.status === 'available',
  );

  const enrichedBeds = matchingBeds.map(bed => {
    const room = db.rooms.find(r => r.id === bed.roomId)!;
    const building = db.buildings.find(b => b.id === room.buildingId)!;

    const roomBeds = db.beds.filter(b => b.roomId === room.id);
    const occupiedBeds = roomBeds.filter(b => b.status === 'occupied' && b.currentOccupantId);
    const occupantDepartments: string[] = [];
    for (const ob of occupiedBeds) {
      const occupantApp = db.applications.find(a => a.employeeId === ob.currentOccupantId && a.status === 'assigned');
      if (occupantApp) occupantDepartments.push(occupantApp.department);
    }

    const sameDeptCount = occupantDepartments.filter(d => d === app.department).length;
    const diffDeptCount = occupantDepartments.filter(d => d !== app.department).length;
    const buildingPrefScore = buildingPrefMap.get(building.id) || 0;

    let priority: 'high' | 'medium' | 'low' = 'medium';
    let priorityReason = '';
    if (sameDeptCount > 0) {
      priority = 'high';
      priorityReason = `房间已有${sameDeptCount}位${app.department}同事`;
    } else if (buildingPrefScore >= 7) {
      priority = 'high';
      priorityReason = `${building.name}是${app.department}偏好楼栋`;
    } else if (diffDeptCount > 0) {
      priority = 'low';
      priorityReason = `房间已有${diffDeptCount}位其他部门同事`;
    } else {
      priority = 'medium';
      priorityReason = '空闲房间，无部门偏好';
    }

    return {
      ...bed,
      roomNumber: room.roomNumber,
      buildingName: building.name,
      buildingId: building.id,
      floor: room.floor,
      dormitoryType: room.dormitoryType,
      roomOccupants: occupiedBeds.length,
      roomCapacity: room.capacity,
      occupantDepartments: [...new Set(occupantDepartments)],
      sameDeptCount,
      buildingPrefScore,
      priority,
      priorityReason,
    };
  });

  if (includePriority) {
    enrichedBeds.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.sameDeptCount !== b.sameDeptCount) return b.sameDeptCount - a.sameDeptCount;
      if (a.buildingPrefScore !== b.buildingPrefScore) return b.buildingPrefScore - a.buildingPrefScore;
      return a.floor - b.floor;
    });
  }

  return enrichedBeds;
}

function buildAutoAssignReason(bed: any, app: any): string {
  const reasons: string[] = [];
  const effectiveRules = getEffectiveRules();

  const deptPriority = effectiveRules.departmentPriorities.find(dp => dp.department === app.department);
  if (deptPriority) {
    reasons.push(`部门优先级${deptPriority.priority}`);
  }

  const buildingPref = effectiveRules.buildingPreferences.find(
    bp => bp.department === app.department && bp.buildingId === bed.buildingId
  );
  if (buildingPref) {
    reasons.push(`${bed.buildingName}偏好权重${buildingPref.priority}`);
  }

  if (bed.sameDeptCount > 0) {
    reasons.push(`同部门比例${bed.sameDeptCount}/${bed.roomCapacity}`);
  } else {
    reasons.push(`房型${bed.dormitoryType === 'single' ? '单人间' : bed.dormitoryType === 'double' ? '双人间' : '四人间'}`);
  }

  reasons.push(`${bed.floor}楼低楼层`);

  return reasons.join(' → ');
}

function validateBedForApprove(bedId: string, app: any): { ok: boolean; statusCode?: number; error?: string; errorType?: string; details?: any } {
  const DORM_TYPE_MAP: Record<string, string> = { single: '单人间', double: '双人间', quad: '四人间' };
  const GENDER_MAP: Record<string, string> = { male: '男', female: '女' };

  const bed = db.beds.find(b => b.id === bedId);
  if (!bed) return { ok: false, statusCode: 404, error: '所选床位不存在', errorType: 'bed_not_found' };

  if (bed.status !== 'available') {
    return { ok: false, statusCode: 409, error: '床位已被占用，请重新选择', errorType: 'bed_occupied' };
  }

  const room = db.rooms.find(r => r.id === bed.roomId);
  if (!room) return { ok: false, statusCode: 404, error: '所选床位不存在', errorType: 'bed_not_found' };

  if (room.dormitoryType !== app.dormitoryType) {
    return {
      ok: false,
      statusCode: 409,
      error: '房型不匹配',
      errorType: 'type_mismatch',
      details: {
        applied: DORM_TYPE_MAP[app.dormitoryType] || app.dormitoryType,
        actual: DORM_TYPE_MAP[room.dormitoryType] || room.dormitoryType,
      },
    };
  }

  const building = db.buildings.find(b => b.id === room.buildingId);
  if (!building) return { ok: false, statusCode: 404, error: '所选床位不存在', errorType: 'bed_not_found' };

  if (building.gender !== app.gender) {
    return {
      ok: false,
      statusCode: 409,
      error: '性别不匹配',
      errorType: 'gender_mismatch',
      details: {
        applied: GENDER_MAP[app.gender] || app.gender,
        buildingGender: GENDER_MAP[building.gender] || building.gender,
        buildingName: building.name,
      },
    };
  }

  const effectiveRules = getEffectiveRules();
  const forbidden = effectiveRules.forbiddenRules.find(
    r => r.department === app.department && r.buildingId === building.id
  );
  if (forbidden) {
    return {
      ok: false,
      statusCode: 409,
      error: '违反禁住规则',
      errorType: 'forbidden_violation',
      details: {
        department: app.department,
        buildingName: building.name,
        reason: forbidden.reason,
      },
    };
  }

  const activeAssignments = db.applications.filter(
    a => a.employeeId === app.employeeId && a.status === 'assigned' && a.id !== app.id,
  );
  const activeAssignment = activeAssignments.find(activeApp => {
    const hasCompletedCheckout = db.checkouts.some(
      c => c.applicationId === activeApp.id && c.status === 'completed',
    );
    return !hasCompletedCheckout;
  });
  if (activeAssignment) {
    let currentRoom = '';
    let startDate = '';
    const activeBed = db.beds.find(b => b.id === activeAssignment.bedId);
    if (activeBed) {
      const activeRoom = db.rooms.find(r => r.id === activeBed.roomId);
      if (activeRoom) currentRoom = activeRoom.roomNumber;
    }
    startDate = activeAssignment.startDate ? new Date(activeAssignment.startDate).toLocaleDateString('zh-CN') : '';
    return {
      ok: false,
      statusCode: 409,
      error: '该员工已有生效入住',
      errorType: 'duplicate_checkin',
      details: { currentRoom, startDate },
    };
  }

  return { ok: true };
}

router.get('/rules', (_req: Request, res: Response) => {
  const departments = getDepartments();
  const buildings = db.buildings.map(b => ({ id: b.id, name: b.name, gender: b.gender }));
  const effectiveRules = getEffectiveRules();
  const serverTime = new Date().toISOString();

  const allDepartmentPriorities = db.departmentPriorities.map(dp => ({
    ...dp,
    status: getRuleStatus(dp),
  }));

  const allBuildingPreferences = db.buildingPreferences.map(bp => {
    const b = db.buildings.find(x => x.id === bp.buildingId);
    return { ...bp, buildingName: b?.name || '', status: getRuleStatus(bp) };
  });

  const allForbiddenRules = db.forbiddenRules.map(fr => {
    const b = db.buildings.find(x => x.id === fr.buildingId);
    return { ...fr, buildingName: b?.name || '', status: getRuleStatus(fr) };
  });

  const effectiveDepartmentPriorities = effectiveRules.departmentPriorities;
  const effectiveBuildingPreferences = effectiveRules.buildingPreferences.map(bp => {
    const b = db.buildings.find(x => x.id === bp.buildingId);
    return { ...bp, buildingName: b?.name || '' };
  });
  const effectiveForbiddenRules = effectiveRules.forbiddenRules.map(fr => {
    const b = db.buildings.find(x => x.id === fr.buildingId);
    return { ...fr, buildingName: b?.name || '' };
  });

  res.json({
    effectiveRules: {
      departmentPriorities: effectiveDepartmentPriorities,
      buildingPreferences: effectiveBuildingPreferences,
      forbiddenRules: effectiveForbiddenRules,
    },
    allRules: {
      departmentPriorities: allDepartmentPriorities,
      buildingPreferences: allBuildingPreferences,
      forbiddenRules: allForbiddenRules,
    },
    departmentPriorities: allDepartmentPriorities,
    buildingPreferences: allBuildingPreferences,
    forbiddenRules: allForbiddenRules,
    departments,
    buildings,
    serverTime,
    effectiveCounts: {
      departmentPriorities: effectiveDepartmentPriorities.length,
      buildingPreferences: effectiveBuildingPreferences.length,
      forbiddenRules: effectiveForbiddenRules.length,
    },
  });
});

router.put('/rules', (req: Request, res: Response) => {
  const { departmentPriorities, buildingPreferences, forbiddenRules } = req.body;

  if (Array.isArray(departmentPriorities)) {
    db.departmentPriorities.length = 0;
    for (const dp of departmentPriorities) {
      db.departmentPriorities.push({
        id: dp.id || uuidv4(),
        department: dp.department,
        priority: Math.max(1, Math.min(10, Number(dp.priority) || 5)),
        enabled: dp.enabled !== undefined ? Boolean(dp.enabled) : true,
        startDate: dp.startDate || null,
        endDate: dp.endDate || null,
      });
    }
  }

  if (Array.isArray(buildingPreferences)) {
    db.buildingPreferences.length = 0;
    for (const bp of buildingPreferences) {
      db.buildingPreferences.push({
        id: bp.id || uuidv4(),
        department: bp.department,
        buildingId: bp.buildingId,
        priority: Math.max(1, Math.min(10, Number(bp.priority) || 5)),
        enabled: bp.enabled !== undefined ? Boolean(bp.enabled) : true,
        startDate: bp.startDate || null,
        endDate: bp.endDate || null,
      });
    }
  }

  if (Array.isArray(forbiddenRules)) {
    db.forbiddenRules.length = 0;
    for (const fr of forbiddenRules) {
      db.forbiddenRules.push({
        id: fr.id || uuidv4(),
        department: fr.department,
        buildingId: fr.buildingId,
        reason: fr.reason || '',
        enabled: fr.enabled !== undefined ? Boolean(fr.enabled) : true,
        startDate: fr.startDate || null,
        endDate: fr.endDate || null,
      });
    }
  }

  res.json({
    departmentPriorities: [...db.departmentPriorities],
    buildingPreferences: [...db.buildingPreferences],
    forbiddenRules: [...db.forbiddenRules],
  });
});

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

  const enrichedList = items.map(a => enrichApplication(a));

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
    assignReason: null,
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

  const sorted = buildMatchedBeds(app);
  const effectiveRules = getEffectiveRules();

  const forbiddenBuildings = effectiveRules.forbiddenRules
    .filter(r => r.department === app.department)
    .map(r => {
      const b = db.buildings.find(x => x.id === r.buildingId);
      return { buildingName: b?.name || '', reason: r.reason };
    });

  res.json({
    beds: sorted.map(({ sameDeptCount, buildingPrefScore, ...rest }) => rest),
    department: app.department,
    forbiddenBuildings,
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json(enrichApplication(app));
});

router.put('/:id/auto-assign', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  if (app.status !== 'pending') {
    res.status(400).json({ error: '仅待审批状态可自动分配' });
    return;
  }

  const enrichedBeds = buildMatchedBeds(app);

  if (enrichedBeds.length === 0) {
    res.status(404).json({ error: '未找到可用床位', reason: '无符合条件的空余床位，请检查禁住规则或楼栋容量' });
    return;
  }

  const bestBed = enrichedBeds[0];
  const assignReason = buildAutoAssignReason(bestBed, app);

  const resultBed = {
    id: bestBed.id,
    bedNumber: bestBed.bedNumber,
    roomNumber: bestBed.roomNumber,
    buildingName: bestBed.buildingName,
    buildingId: bestBed.buildingId,
    floor: bestBed.floor,
    dormitoryType: bestBed.dormitoryType,
  };

  res.json({
    bed: resultBed,
    assignReason,
    matchedBedsCount: enrichedBeds.length,
  });
});

router.put('/:id/approve', (req: Request, res: Response) => {
  const app = db.applications.find(a => a.id === req.params.id);
  if (!app) {
    res.status(404).json({ error: '申请不存在' });
    return;
  }

  const { bedId, assignReason: customReason } = req.body;

  const validation = validateBedForApprove(bedId, app);
  if (!validation.ok) {
    const response: any = { error: validation.error || '校验失败', errorType: validation.errorType };
    if (validation.details) {
      response.details = validation.details;
    }
    res.status(validation.statusCode || 409).json(response);
    return;
  }

  const bed = db.beds.find(b => b.id === bedId)!;
  bed.status = 'occupied';
  bed.currentOccupantId = app.employeeId;

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 6);

  let finalReason = customReason;
  if (!finalReason) {
    const enrichedList = buildMatchedBeds(app, false);
    const matched = enrichedList.find(b => b.id === bedId);
    if (matched) {
      finalReason = buildAutoAssignReason(matched, app);
    }
  }

  app.status = 'assigned';
  app.bedId = bedId;
  app.startDate = now.toISOString();
  app.endDate = end.toISOString();
  app.assignedAt = now.toISOString();
  app.assignReason = finalReason;

  const emp = db.employees.find(e => e.id === app.employeeId);
  const room = db.rooms.find(r => r.id === bed.roomId);

  db.operationLogs.push({
    id: uuidv4(),
    employeeId: app.employeeId,
    employeeName: emp?.name || '',
    operationType: 'checkin',
    roomNumber: room?.roomNumber || '',
    description: `${emp?.name || ''}入住${room?.roomNumber || ''}-${bed.bedNumber}${finalReason ? `（${finalReason}）` : ''}`,
    createdAt: now.toISOString(),
  });

  res.json(enrichApplication(app));
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

  res.json(enrichApplication(app));
});

export default router;
