import { v4 as uuidv4 } from 'uuid';

export interface Building {
  id: string;
  name: string;
  gender: 'male' | 'female';
  floors: number;
  totalRooms: number;
  createdAt: string;
}

export interface Room {
  id: string;
  buildingId: string;
  floor: number;
  roomNumber: string;
  dormitoryType: 'single' | 'double' | 'quad';
  capacity: number;
  createdAt: string;
}

export interface Bed {
  id: string;
  roomId: string;
  bedNumber: number;
  status: 'available' | 'occupied' | 'maintenance';
  currentOccupantId: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  gender: 'male' | 'female';
  department: string;
  position: string;
  phone: string;
  createdAt: string;
}

export interface Application {
  id: string;
  employeeId: string;
  gender: 'male' | 'female';
  department: string;
  position: string;
  dormitoryType: 'single' | 'double' | 'quad';
  expectedDate: string;
  status: 'pending' | 'assigned' | 'rejected';
  bedId: string | null;
  assignedAt: string | null;
  rejectedReason: string | null;
  startDate: string | null;
  endDate: string | null;
  assignReason: string | null;
  createdAt: string;
}

export interface DamageItem {
  id: string;
  name: string;
  amount: number;
  remark: string;
}

export interface Checkout {
  id: string;
  applicationId: string;
  status: 'inspection' | 'confirming' | 'settling' | 'completed';
  reason: string;
  waterReading: number;
  electricReading: number;
  waterFee: number;
  electricFee: number;
  totalFee: number;
  sharePerPerson: number;
  completedAt: string | null;
  createdAt: string;
  previousWaterReading: number;
  previousElectricReading: number;
  facilityDamages: DamageItem[];
  deposit: number;
  depositDeducted: number;
  finalFee: number;
  paymentStatus: 'unpaid' | 'paid';
  invoiceNumber: string | null;
  billedAt: string | null;
}

export interface ChecklistItem {
  id: string;
  checkoutId: string;
  itemName: string;
  status: 'pending' | 'pass' | 'fail';
  remark: string;
}

export interface Warning {
  id: string;
  applicationId: string;
  level: 'expiring' | 'expired';
  status: 'pending' | 'handled';
  handleAction: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  employeeId: string;
  employeeName: string;
  operationType: 'checkin' | 'checkout' | 'inspection' | 'import' | 'warning' | 'other';
  roomNumber: string;
  description: string;
  createdAt: string;
}

export interface RollbackIds {
  buildingIds: string[];
  roomIds: string[];
  bedIds: string[];
}

export interface CreatedBuilding {
  id: string;
  name: string;
  gender: 'male' | 'female';
  floors: number;
  totalRooms: number;
}

export interface CreatedRoom {
  id: string;
  buildingName: string;
  floor: number;
  roomNumber: string;
  dormitoryType: 'single' | 'double' | 'quad';
  capacity: number;
  bedCount: number;
}

export interface CreatedBed {
  id: string;
  roomNumber: string;
  bedNumber: number;
  buildingName: string;
}

export interface FailedRow {
  row: number;
  data: Record<string, unknown>;
  message: string;
}

export interface ImportHistory {
  id: string;
  createdAt: string;
  operator: string;
  fileName: string;
  successCount: number;
  failedCount: number;
  rollbackIds: RollbackIds;
  errors: { row: number; message: string }[];
  status: 'confirmed' | 'rolledback';
  createdBuildings: CreatedBuilding[];
  createdRooms: CreatedRoom[];
  createdBeds: CreatedBed[];
  failedRows: FailedRow[];
}

export interface PreviewBuildItem {
  name: string;
  gender: 'male' | 'female';
  floors: number;
}

export interface PreviewRoomItem {
  buildingName: string;
  floor: number;
  roomNumber: string;
  dormitoryType: 'single' | 'double' | 'quad';
  capacity: number;
}

export interface PreviewData {
  previewId: string;
  buildings: PreviewBuildItem[];
  rooms: PreviewRoomItem[];
  errors: { row: number; message: string }[];
  failedRows: FailedRow[];
  validData: Record<string, unknown>[];
  rawData: Record<string, unknown>[];
  filename: string;
  createdAt: string;
}

export interface DepartmentPriority {
  id: string;
  department: string;
  priority: number;
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface BuildingPreference {
  id: string;
  department: string;
  buildingId: string;
  priority: number;
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface ForbiddenRule {
  id: string;
  department: string;
  buildingId: string;
  reason: string;
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface AssignmentRule {
  departmentPriorities: DepartmentPriority[];
  buildingPreferences: BuildingPreference[];
  forbiddenRules: ForbiddenRule[];
}

export interface ExportTask {
  id: string;
  type: 'operation_log' | 'settlement' | 'dormitory_import';
  fileName: string;
  scope: 'current' | 'all';
  filters: Record<string, any>;
  filterDescription: string;
  recordCount: number;
  fileSize: number;
  status: 'completed' | 'failed';
  operator: string;
  createdAt: string;
  expiresAt?: string;
}

const buildings: Building[] = [];
const rooms: Room[] = [];
const beds: Bed[] = [];
const employees: Employee[] = [];
const applications: Application[] = [];
const checkouts: Checkout[] = [];
const checklistItems: ChecklistItem[] = [];
const warnings: Warning[] = [];
const operationLogs: OperationLog[] = [];
const importHistories: ImportHistory[] = [];
const previewCache: Record<string, PreviewData> = {};
const departmentPriorities: DepartmentPriority[] = [];
const buildingPreferences: BuildingPreference[] = [];
const forbiddenRules: ForbiddenRule[] = [];
const exportTasks: ExportTask[] = [];

function now(): string {
  return new Date().toISOString();
}

function seedData() {
  const b1Id = uuidv4();
  const b2Id = uuidv4();

  buildings.push(
    { id: b1Id, name: '男生宿舍1号楼', gender: 'male', floors: 3, totalRooms: 12, createdAt: now() },
    { id: b2Id, name: '女生宿舍2号楼', gender: 'female', floors: 2, totalRooms: 8, createdAt: now() },
  );

  const typeMap: ('single' | 'double' | 'quad')[] = ['single', 'double', 'quad', 'double'];

  for (let floor = 1; floor <= 3; floor++) {
    for (let i = 0; i < 4; i++) {
      const rId = uuidv4();
      const rn = `${floor}0${i + 1}`;
      const dt = typeMap[i];
      const cap = dt === 'single' ? 1 : dt === 'double' ? 2 : 4;
      rooms.push({ id: rId, buildingId: b1Id, floor, roomNumber: rn, dormitoryType: dt, capacity: cap, createdAt: now() });
      for (let b = 1; b <= cap; b++) {
        beds.push({ id: uuidv4(), roomId: rId, bedNumber: b, status: 'available', currentOccupantId: null, createdAt: now() });
      }
    }
  }

  for (let floor = 1; floor <= 2; floor++) {
    for (let i = 0; i < 4; i++) {
      const rId = uuidv4();
      const rn = `${floor}0${i + 1}`;
      const dt = typeMap[i];
      const cap = dt === 'single' ? 1 : dt === 'double' ? 2 : 4;
      rooms.push({ id: rId, buildingId: b2Id, floor, roomNumber: rn, dormitoryType: dt, capacity: cap, createdAt: now() });
      for (let b = 1; b <= cap; b++) {
        beds.push({ id: uuidv4(), roomId: rId, bedNumber: b, status: 'available', currentOccupantId: null, createdAt: now() });
      }
    }
  }

  const empData: [string, 'male' | 'female', string, string, string][] = [
    ['张伟', 'male', '技术部', '工程师', '13800138001'],
    ['李明', 'male', '技术部', '高级工程师', '13800138002'],
    ['王强', 'male', '技术部', '架构师', '13800138003'],
    ['刘洋', 'male', '技术部', '测试工程师', '13800138004'],
    ['陈杰', 'male', '技术部', '运维工程师', '13800138005'],
    ['赵敏', 'female', '市场部', '市场经理', '13800138006'],
    ['孙丽', 'female', '市场部', '市场专员', '13800138007'],
    ['周涛', 'male', '市场部', '销售经理', '13800138008'],
    ['吴芳', 'female', '市场部', '销售专员', '13800138009'],
    ['郑华', 'male', '行政部', '行政主管', '13800138010'],
    ['钱静', 'female', '行政部', '行政专员', '13800138011'],
    ['冯磊', 'male', '行政部', '前台', '13800138012'],
    ['褚琳', 'female', '财务部', '财务经理', '13800138013'],
    ['卫东', 'male', '财务部', '会计', '13800138014'],
    ['蒋雪', 'female', '财务部', '出纳', '13800138015'],
  ];

  const empIds: string[] = [];
  for (const [name, gender, dept, pos, phone] of empData) {
    const eId = uuidv4();
    empIds.push(eId);
    employees.push({ id: eId, name, gender, department: dept, position: pos, phone, createdAt: now() });
  }

  function findBed(buildingId: string, roomNumber: string, bedNumber: number): Bed | undefined {
    const room = rooms.find(r => r.buildingId === buildingId && r.roomNumber === roomNumber);
    if (!room) return undefined;
    return beds.find(b => b.roomId === room.id && b.bedNumber === bedNumber);
  }

  function getRoomNumber(bedId: string): string {
    const bed = beds.find(b => b.id === bedId);
    if (!bed) return '';
    const room = rooms.find(r => r.id === bed.roomId);
    return room ? room.roomNumber : '';
  }

  function assignBed(bed: Bed, empId: string) {
    bed.status = 'occupied';
    bed.currentOccupantId = empId;
  }

  const bed1 = findBed(b1Id, '101', 1)!;
  const bed2 = findBed(b1Id, '102', 1)!;
  const bed3 = findBed(b1Id, '102', 2)!;
  const bed4 = findBed(b1Id, '103', 1)!;
  const bed5 = findBed(b2Id, '101', 1)!;
  const bed6 = findBed(b2Id, '102', 1)!;

  assignBed(bed1, empIds[0]);
  assignBed(bed2, empIds[1]);
  assignBed(bed3, empIds[2]);
  assignBed(bed4, empIds[3]);
  assignBed(bed5, empIds[5]);
  assignBed(bed6, empIds[6]);

  const appData: [number, 'male' | 'female', string, string, 'single' | 'double' | 'quad', string, 'assigned' | 'pending' | 'rejected', string | null, string | null, string | null, string | null, string | null][] = [
    [0, 'male', '技术部', '工程师', 'single', '2026-01-10', 'assigned', bed1.id, now(), '2026-01-15', '2026-07-15', null],
    [1, 'male', '技术部', '高级工程师', 'double', '2026-01-10', 'assigned', bed2.id, now(), '2026-01-15', '2026-06-18', null],
    [2, 'male', '技术部', '架构师', 'double', '2025-11-25', 'assigned', bed3.id, now(), '2025-12-01', '2026-06-10', null],
    [3, 'male', '技术部', '测试工程师', 'quad', '2026-02-25', 'assigned', bed4.id, now(), '2026-03-01', '2026-09-01', null],
    [5, 'female', '市场部', '市场经理', 'single', '2026-01-25', 'assigned', bed5.id, now(), '2026-02-01', '2026-08-01', null],
    [6, 'female', '市场部', '市场专员', 'double', '2026-03-25', 'assigned', bed6.id, now(), '2026-04-01', '2026-10-01', null],
    [4, 'male', '技术部', '运维工程师', 'single', '2026-06-01', 'pending', null, null, null, null, null],
    [8, 'female', '市场部', '销售专员', 'double', '2026-06-05', 'pending', null, null, null, null, null],
    [10, 'female', '行政部', '行政专员', 'single', '2026-05-20', 'rejected', null, null, null, null, '暂无空余床位'],
  ];

  const appIds: string[] = [];
  for (const [eIdx, gender, dept, pos, dt, expDate, status, bedId, assignedAt, startDate, endDate, rejectedReason] of appData) {
    const aId = uuidv4();
    appIds.push(aId);
    applications.push({
      id: aId,
      employeeId: empIds[eIdx],
      gender,
      department: dept,
      position: pos,
      dormitoryType: dt,
      expectedDate: expDate,
      status: status as 'assigned' | 'pending' | 'rejected',
      bedId,
      assignedAt,
      rejectedReason,
      startDate,
      endDate,
      assignReason: null,
      createdAt: now(),
    });
  }

  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const twoMonthsAgo = new Date(today);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  departmentPriorities.push(
    { id: uuidv4(), department: '技术部', priority: 10, enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '市场部', priority: 7, enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '财务部', priority: 5, enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '行政部', priority: 3, enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '行政部', priority: 8, enabled: true, startDate: today.toISOString().split('T')[0], endDate: nextMonth.toISOString().split('T')[0] },
    { id: uuidv4(), department: '运维部', priority: 6, enabled: false, startDate: null, endDate: null },
  );

  buildingPreferences.push(
    { id: uuidv4(), department: '技术部', buildingId: b1Id, priority: 9, enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '市场部', buildingId: b2Id, priority: 8, enabled: true, startDate: null, endDate: null },
  );

  forbiddenRules.push(
    { id: uuidv4(), department: '财务部', buildingId: b1Id, reason: '1号楼为技术部专属楼栋', enabled: true, startDate: null, endDate: null },
    { id: uuidv4(), department: '市场部', buildingId: b1Id, reason: '暑期临时禁住1号楼（男生宿舍）', enabled: true, startDate: twoMonthsAgo.toISOString().split('T')[0], endDate: lastMonth.toISOString().split('T')[0] },
  );

  const coId = uuidv4();
  checkouts.push({
    id: coId,
    applicationId: appIds[0],
    status: 'inspection',
    reason: '工作调动',
    waterReading: 0,
    electricReading: 0,
    waterFee: 0,
    electricFee: 0,
    totalFee: 0,
    sharePerPerson: 0,
    completedAt: null,
    createdAt: now(),
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
    checklistItems.push({
      id: uuidv4(),
      checkoutId: coId,
      itemName: name,
      status: 'pending',
      remark: '',
    });
  }

  warnings.push(
    {
      id: uuidv4(),
      applicationId: appIds[1],
      level: 'expiring',
      status: 'pending',
      handleAction: null,
      handledAt: null,
      createdAt: now(),
    },
    {
      id: uuidv4(),
      applicationId: appIds[2],
      level: 'expired',
      status: 'pending',
      handleAction: null,
      handledAt: null,
      createdAt: now(),
    },
  );

  for (let i = 0; i < 6; i++) {
    const emp = employees[i];
    const app = applications[i];
    const roomNum = app.bedId ? getRoomNumber(app.bedId) : '';
    operationLogs.push({
      id: uuidv4(),
      employeeId: emp.id,
      employeeName: emp.name,
      operationType: 'checkin',
      roomNumber: roomNum,
      description: `${emp.name}入住${roomNum}`,
      createdAt: app.startDate || now(),
    });
  }

  operationLogs.push({
    id: uuidv4(),
    employeeId: empIds[0],
    employeeName: employees[0].name,
    operationType: 'checkout',
    roomNumber: '101',
    description: `${employees[0].name}申请退房101`,
    createdAt: now(),
  });

  operationLogs.push({
    id: uuidv4(),
    employeeId: empIds[9],
    employeeName: employees[9].name,
    operationType: 'other',
    roomNumber: '',
    description: `${employees[9].name}提交入住申请`,
    createdAt: now(),
  });

  operationLogs.push({
    id: uuidv4(),
    employeeId: empIds[9],
    employeeName: employees[9].name,
    operationType: 'warning',
    roomNumber: '',
    description: '系统扫描到期预警',
    createdAt: now(),
  });
}

seedData();

const db = {
  buildings,
  rooms,
  beds,
  employees,
  applications,
  checkouts,
  checklistItems,
  warnings,
  operationLogs,
  importHistories,
  previewCache,
  departmentPriorities,
  buildingPreferences,
  forbiddenRules,
  exportTasks,
};

export default db;
