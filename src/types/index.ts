export interface Building {
  id: string
  name: string
  gender: string
  floors: number
  totalRooms: number
  createdAt: string
  occupiedBeds?: number
  totalBeds?: number
  occupancyRate?: number
}

export interface Room {
  id: string
  buildingId: string
  floor: number
  roomNumber: string
  dormitoryType: string
  capacity: number
  createdAt: string
  beds?: Bed[]
}

export interface Bed {
  id: string
  roomId: string
  bedNumber: string
  status: string
  currentOccupantId: string | null
  createdAt: string
  room?: Room
  occupant?: Employee
}

export interface Employee {
  id: string
  name: string
  gender: string
  department: string
  position: string
  phone: string
  createdAt: string
}

export interface Application {
  id: string
  employeeId: string
  gender: string
  department: string
  position: string
  dormitoryType: string
  expectedDate: string
  status: string
  bedId: string | null
  assignedAt: string | null
  rejectedReason: string | null
  startDate: string | null
  endDate: string | null
  assignReason: string | null
  createdAt: string
  employee?: Employee
  bed?: Bed
}

export interface DamageItem {
  id: string
  name: string
  amount: number
  remark: string
}

export interface Checkout {
  id: string
  applicationId: string
  status: string
  reason: string
  waterReading: number | null
  electricReading: number | null
  waterFee: number | null
  electricFee: number | null
  totalFee: number | null
  sharePerPerson: number | null
  completedAt: string | null
  createdAt: string
  previousWaterReading?: number
  previousElectricReading?: number
  facilityDamages?: DamageItem[]
  deposit?: number
  depositDeducted?: number
  finalFee?: number
  paymentStatus?: 'unpaid' | 'paid'
  invoiceNumber?: string | null
  billedAt?: string | null
  application?: Application
  employeeName?: string
  roomNumber?: string
}

export interface ChecklistItem {
  id: string
  checkoutId: string
  itemName: string
  status: string
  remark: string
}

export interface Warning {
  id: string
  applicationId: string
  level: string
  status: string
  handleAction: string | null
  handledAt: string | null
  createdAt: string
  application?: Application
}

export interface OperationLog {
  id: string
  employeeId: string
  employeeName: string
  operationType: string
  roomNumber: string
  description: string
  createdAt: string
}

export interface DashboardData {
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyRate: number
  pendingApplications: number
  pendingCheckouts: number
  expiringCount: number
  expiredCount: number
  recentActivities: RecentActivity[]
}

export interface RecentActivity {
  id: string
  operationType: string
  description: string
  createdAt: string
}

export interface PaginatedResult<T> {
  total: number
  list: T[]
}

export interface RollbackIds {
  buildingIds: string[]
  roomIds: string[]
  bedIds: string[]
}

export interface ImportError {
  row: number
  message: string
}

export interface ImportHistory {
  id: string
  createdAt: string
  operator: string
  filename: string
  successCount: number
  failedCount: number
  rollbackIds: RollbackIds
  errors: ImportError[]
  status: 'confirmed' | 'rolledback'
  canRollback?: boolean
}

export interface PreviewBuildItem {
  name: string
  gender: string
  floors: number
}

export interface PreviewRoomItem {
  buildingName: string
  floor: number
  roomNumber: string
  dormitoryType: string
  capacity: number
}

export interface PreviewResult {
  previewId: string
  buildings: PreviewBuildItem[]
  rooms: PreviewRoomItem[]
  errors: ImportError[]
  totalNew: number
}

export interface ConfirmResult {
  id: string
  successCount: number
  failedCount: number
  errors: ImportError[]
  rollbackIds: RollbackIds
}

export interface DepartmentPriority {
  id: string
  department: string
  priority: number
}

export interface BuildingPreference {
  id: string
  department: string
  buildingId: string
  priority: number
  buildingName?: string
}

export interface ForbiddenRule {
  id: string
  department: string
  buildingId: string
  reason: string
  buildingName?: string
}

export interface AssignmentRuleData {
  departmentPriorities: DepartmentPriority[]
  buildingPreferences: BuildingPreference[]
  forbiddenRules: ForbiddenRule[]
  departments: string[]
  buildings: Array<{ id: string; name: string; gender: string }>
}

export interface AutoAssignResult {
  bed: {
    id: string
    bedNumber: number
    roomNumber: string
    buildingName: string
    buildingId: string
    floor: number
    dormitoryType: string
  }
  assignReason: string
  matchedBedsCount: number
}

export interface ForbiddenBuildingInfo {
  buildingName: string
  reason: string
}

export interface MatchBedsResult {
  beds: any[]
  department: string
  forbiddenBuildings?: ForbiddenBuildingInfo[]
}
