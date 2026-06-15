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
  createdAt: string
  employee?: Employee
  bed?: Bed
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
  application?: Application
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
