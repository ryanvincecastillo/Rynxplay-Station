// Database types matching Supabase schema

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  org_id: string
  name: string
  address: string | null
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined
  organizations?: Organization
}

export interface Rate {
  id: string
  branch_id: string
  name: string
  description: string | null
  price_per_unit: number
  unit_minutes: number
  is_default: boolean
  is_active: boolean
  created_at: string
}

export interface Device {
  id: string
  branch_id: string
  rate_id: string | null
  name: string
  device_code: string
  device_type: 'pc' | 'mobile'
  status: 'online' | 'offline' | 'in_use' | 'pending'
  is_locked: boolean
  current_session_id: string | null
  last_heartbeat: string | null
  ip_address: string | null
  specs: SystemSpecs | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined data
  rates?: Rate
  branches?: Branch
}

export interface Member {
  id: string
  org_id: string
  username: string
  pin_code: string
  email: string | null
  phone: string | null
  full_name: string | null
  credits: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SessionType = 'guest' | 'member'
export type SessionStatus = 'active' | 'paused' | 'completed' | 'terminated'

export interface Session {
  id: string
  device_id: string
  member_id: string | null
  rate_id: string | null
  session_type: SessionType
  started_at: string
  ended_at: string | null
  paused_at: string | null
  time_remaining_seconds: number | null
  total_seconds_used: number
  total_amount: number
  status: SessionStatus
  created_at: string
  updated_at: string
  // Joined data
  members?: Member
  rates?: Rate
}

export type TransactionType = 'topup' | 'usage' | 'refund' | 'adjustment'

export interface Transaction {
  id: string
  member_id: string | null
  branch_id: string | null
  session_id: string | null
  type: TransactionType
  amount: number
  balance_before: number | null
  balance_after: number | null
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type CommandType = 'shutdown' | 'restart' | 'lock' | 'unlock' | 'message'
export type CommandStatus = 'pending' | 'sent' | 'executed' | 'failed'

export interface DeviceCommand {
  id: string
  device_id: string
  command_type: CommandType
  payload: Record<string, unknown>
  status: CommandStatus
  created_by: string | null
  created_at: string
  sent_at: string | null
  executed_at: string | null
  error_message: string | null
}

// System specifications
export interface SystemSpecs {
  cpu: {
    brand: string
    manufacturer: string
    speed: number
    cores: number
    physicalCores: number
  }
  memory: {
    total: number
    free: number
    used: number
  }
  graphics: {
    controllers: Array<{
      model: string
      vendor: string
      vram: number
    }>
  }
  disk: {
    total: number
    used: number
    free: number
  }
  os: {
    platform: string
    distro: string
    release: string
    arch: string
    hostname: string
  }
  network: {
    mac: string
    ip: string
  }
}

// App-specific types
export interface AppConfig {
  deviceId: string | null
  deviceCode: string | null
  deviceName: string
  branchId: string | null
  isRegistered: boolean
  isApproved: boolean
}

export interface SystemInfo {
  platform: string
  hostname: string
  arch: string
  version: string
}

export type AppScreen = 'setup' | 'pending' | 'lock' | 'member-login' | 'session' | 'message'

export interface AppState {
  screen: AppScreen
  isLocked: boolean
  isOnline: boolean
  device: Device | null
  session: Session | null
  member: Member | null
  config: AppConfig | null
  systemInfo: SystemInfo | null
  systemSpecs: SystemSpecs | null
  message: string | null
}

// Realtime payload types
export interface RealtimePayload<T> {
  commit_timestamp: string
  errors: null | string[]
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: Partial<T>
  schema: string
  table: string
}
