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

export interface FailedRow {
  row: number
  data: Record<string, any>
  message: string
}

export interface CreatedBuilding {
  id: string
  name: string
  gender: string
  floors: number
  totalRooms: number
  exists?: boolean
}

export interface CreatedRoom {
  id: string
  buildingName: string
  floor: number
  roomNumber: string
  dormitoryType: string
  capacity: number
  bedCount: number
  exists?: boolean
}

export interface CreatedBed {
  id: string
  roomNumber: string
  bedNumber: number
  buildingName: string
  exists?: boolean
  status?: string | null
}

export interface ImportHistory {
  id: string
  createdAt: string
  operator: string
  fileName: string
  successCount: number
  failedCount: number
  rollbackIds: RollbackIds
  errors: ImportError[]
  status: 'confirmed' | 'rolledback'
  canRollback?: boolean
  createdBuildings: CreatedBuilding[]
  createdRooms: CreatedRoom[]
  createdBeds: CreatedBed[]
  failedRows: FailedRow[]
}

export interface ImportHistoryDetail extends ImportHistory {
  buildings: CreatedBuilding[]
  rooms: CreatedRoom[]
  beds: CreatedBed[]
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
  failedRows: FailedRow[]
  totalNew: number
  totalBeds: number
}

export interface ConfirmResult {
  id: string
  successCount: number
  failedCount: number
  errors: ImportError[]
  rollbackIds: RollbackIds
  createdBuildings: CreatedBuilding[]
  createdRooms: CreatedRoom[]
  createdBeds: CreatedBed[]
  failedRows: FailedRow[]
}

export interface RollbackPreviewResult {
  canRollback: boolean
  reason: string | null
  occupiedCount: number
  occupiedBeds: Array<{
    id: string
    bedNumber: number
    roomNumber: string
    buildingName: string
  }>
  buildingCount: number
  roomCount: number
  bedCount: number
  buildingNames: string[]
  rooms: Array<{
    buildingName: string
    floor: number
    roomNumber: string
  }>
  beds: Array<{
    buildingName: string
    roomNumber: string
    bedNumber: number
  }>
  riskWarning: string | null
}

export interface DepartmentPriority {
  id: string
  department: string
  priority: number
  enabled: boolean
  startDate: string | null
  endDate: string | null
}

export interface BuildingPreference {
  id: string
  department: string
  buildingId: string
  priority: number
  enabled: boolean
  startDate: string | null
  endDate: string | null
  buildingName?: string
}

export interface ForbiddenRule {
  id: string
  department: string
  buildingId: string
  reason: string
  enabled: boolean
  startDate: string | null
  endDate: string | null
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

export interface ExportTask {
  id: string
  type: 'operation_log' | 'settlement' | 'dormitory_import'
  fileName: string
  scope: 'current' | 'all'
  filters: Record<string, any>
  filterDescription: string
  recordCount: number
  fileSize: number
  status: 'completed' | 'failed'
  operator: string
  createdAt: string
  expiresAt?: string
}

export interface WaterCalculation {
  previousReading: number
  currentReading: number
  usage: number
  unitPrice: number
  fee: number
}

export interface ElectricCalculation {
  previousReading: number
  currentReading: number
  usage: number
  unitPrice: number
  fee: number
}

export interface DamageCalculationItem {
  id: string
  name: string
  amount: number
  remark: string
}

export interface DepositCalculation {
  original: number
  deducted: number
  remaining: number
}

export interface CalculationBreakdown {
  water: WaterCalculation
  electric: ElectricCalculation
  damages: DamageCalculationItem[]
  damagesTotal: number
  deposit: DepositCalculation
  totalFee: number
  finalFee: number
}

export interface SettlePreviewResult {
  waterFee: number
  electricFee: number
  damagesTotal: number
  totalFee: number
  depositDeducted: number
  finalFee: number
  calculationBreakdown: CalculationBreakdown
  warnings: string[]
  status: string
}
