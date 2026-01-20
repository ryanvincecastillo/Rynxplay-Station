import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { 
  Device, 
  Session, 
  Member, 
  DeviceCommand, 
  Rate, 
  Branch, 
  Transaction,
  Organization,
  StaffUser,
  DashboardStats,
  CommandType
} from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Heartbeat timeout - device is considered offline if no heartbeat for this duration
const HEARTBEAT_TIMEOUT_MS = 45000 // 45 seconds

let supabaseClient: SupabaseClient | null = null

export function initSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured')
  }
  
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  }
  return supabaseClient
}

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    return initSupabase()
  }
  return supabaseClient
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}

// Auth operations
export async function signIn(email: string, password: string) {
  const supabase = getSupabase()
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabase()
  return await supabase.auth.signUp({ email, password })
}

export async function signOut() {
  const supabase = getSupabase()
  return await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const supabase = getSupabase()
  return await supabase.auth.getUser()
}

export async function getStaffUser(authUserId: string): Promise<StaffUser | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('staff_users')
    .select('*, organizations(*), branches(*)')
    .eq('auth_user_id', authUserId)
    .single()
  
  if (error) {
    console.error('Error getting staff user:', error)
    return null
  }
  
  return data
}

// Organization operations
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()
  
  if (error) {
    console.error('Error getting organization:', error)
    return null
  }
  
  return data
}

// Branch operations
export async function getBranches(orgId: string): Promise<Branch[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*, organizations(*)')
    .eq('org_id', orgId)
    .order('name')
  
  if (error) {
    console.error('Error getting branches:', error)
    return []
  }
  
  return data || []
}

export async function createBranch(branch: Partial<Branch>): Promise<Branch | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('branches')
    .insert(branch)
    .select()
    .single()
  
  if (error) {
    console.error('Error creating branch:', error)
    return null
  }
  
  return data
}

export async function updateBranch(id: string, updates: Partial<Branch>): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id)
  
  if (error) {
    console.error('Error updating branch:', error)
    return false
  }
  
  return true
}

// Device operations
export async function getDevices(orgId: string): Promise<Device[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('devices')
    .select('*, rates(*), branches!inner(*, organizations(*))')
    .eq('branches.org_id', orgId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error getting devices:', error)
    return []
  }
  
  // Check heartbeat status and update effective status
  const devicesWithStatus = (data || []).map(device => ({
    ...device,
    effective_status: getEffectiveDeviceStatus(device)
  }))
  
  return devicesWithStatus
}

// Helper to determine effective device status based on heartbeat
export function getEffectiveDeviceStatus(device: Device): Device['status'] {
  if (!device.last_heartbeat) {
    return 'offline'
  }
  
  const lastHeartbeat = new Date(device.last_heartbeat).getTime()
  const now = Date.now()
  const timeSinceHeartbeat = now - lastHeartbeat
  
  // If heartbeat is stale, device is offline
  if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS) {
    return 'offline'
  }
  
  // Otherwise use the device's reported status
  return device.status
}

export async function getPendingDevices(): Promise<Device[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .is('branch_id', null)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error getting pending devices:', error)
    return []
  }
  
  return data || []
}

export async function getDeviceByCode(deviceCode: string): Promise<Device | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('devices')
    .select('*, rates(*), branches(*)')
    .eq('device_code', deviceCode)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error getting device:', error)
    return null
  }
  
  return data
}

export async function approveDevice(
  deviceId: string, 
  branchId: string, 
  rateId: string,
  name?: string
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .update({
      branch_id: branchId,
      rate_id: rateId,
      status: 'offline',
      name: name,
      updated_at: new Date().toISOString()
    })
    .eq('id', deviceId)
  
  if (error) {
    console.error('Error approving device:', error)
    return false
  }
  
  return true
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
  
  if (error) {
    console.error('Error updating device:', error)
    return false
  }
  
  return true
}

export async function deleteDevice(id: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting device:', error)
    return false
  }
  
  return true
}

export async function sendDeviceCommand(
  deviceId: string, 
  commandType: CommandType, 
  payload: Record<string, unknown> = {},
  createdBy?: string
): Promise<DeviceCommand | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('device_commands')
    .insert({
      device_id: deviceId,
      command_type: commandType,
      payload,
      created_by: createdBy
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error sending command:', error)
    return null
  }
  
  return data
}

// Rate operations
export async function getRates(branchId: string): Promise<Rate[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('rates')
    .select('*')
    .eq('branch_id', branchId)
    .order('name')
  
  if (error) {
    console.error('Error getting rates:', error)
    return []
  }
  
  return data || []
}

export async function getAllRates(orgId: string): Promise<Rate[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('rates')
    .select('*, branches!inner(*)')
    .eq('branches.org_id', orgId)
    .order('name')
  
  if (error) {
    console.error('Error getting rates:', error)
    return []
  }
  
  return data || []
}

export async function createRate(rate: Partial<Rate>): Promise<Rate | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('rates')
    .insert(rate)
    .select()
    .single()
  
  if (error) {
    console.error('Error creating rate:', error)
    return null
  }
  
  return data
}

export async function updateRate(id: string, updates: Partial<Rate>): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('rates')
    .update(updates)
    .eq('id', id)
  
  if (error) {
    console.error('Error updating rate:', error)
    return false
  }
  
  return true
}

// Member operations
export async function getMembers(orgId: string): Promise<Member[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error getting members:', error)
    return []
  }
  
  return data || []
}

export async function createMember(member: Partial<Member>): Promise<Member | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('members')
    .insert(member)
    .select()
    .single()
  
  if (error) {
    console.error('Error creating member:', error)
    return null
  }
  
  return data
}

export async function updateMember(id: string, updates: Partial<Member>): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('members')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
  
  if (error) {
    console.error('Error updating member:', error)
    return false
  }
  
  return true
}

export async function addMemberCredits(
  memberId: string,
  amount: number,
  branchId: string,
  paymentMethod: string,
  createdBy?: string
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('credits')
    .eq('id', memberId)
    .single()
  
  if (memberError || !member) {
    console.error('Error getting member:', memberError)
    return false
  }
  
  const newBalance = member.credits + amount
  
  const { error: updateError } = await supabase
    .from('members')
    .update({ credits: newBalance })
    .eq('id', memberId)
  
  if (updateError) {
    console.error('Error updating credits:', updateError)
    return false
  }
  
  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      member_id: memberId,
      branch_id: branchId,
      type: 'topup',
      amount: amount,
      balance_before: member.credits,
      balance_after: newBalance,
      payment_method: paymentMethod,
      created_by: createdBy
    })
  
  if (txError) {
    console.error('Error creating transaction:', txError)
  }
  
  return true
}

// Session operations
export async function getSessions(orgId: string, limit = 100): Promise<Session[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*, members(*), devices!inner(*, branches!inner(*)), rates(*)')
    .eq('devices.branches.org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error getting sessions:', error)
    return []
  }
  
  return data || []
}

export async function getActiveSessions(orgId: string): Promise<Session[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*, members(*), devices!inner(*, branches!inner(*)), rates(*)')
    .eq('devices.branches.org_id', orgId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
  
  if (error) {
    console.error('Error getting active sessions:', error)
    return []
  }
  
  return data || []
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*, members(*), devices(*), rates(*)')
    .eq('id', sessionId)
    .single()
  
  if (error) {
    console.error('Error getting session:', error)
    return null
  }
  
  return data
}

export async function endSession(sessionId: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'terminated',
      ended_at: new Date().toISOString()
    })
    .eq('id', sessionId)
  
  if (error) {
    console.error('Error ending session:', error)
    return false
  }
  
  return true
}

// Transaction operations
export async function getTransactions(orgId: string, limit = 100): Promise<Transaction[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*, members(*), branches!inner(*)')
    .eq('branches.org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error getting transactions:', error)
    return []
  }
  
  return data || []
}

// Dashboard stats
export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = getSupabase()
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  try {
    const { data: devices } = await supabase
      .from('devices')
      .select('status, last_heartbeat, branches!inner(org_id)')
      .eq('branches.org_id', orgId)
    
    const { data: pendingDevices } = await supabase
      .from('devices')
      .select('id')
      .is('branch_id', null)
    
    const { data: members } = await supabase
      .from('members')
      .select('is_active')
      .eq('org_id', orgId)
    
    const { data: sessions } = await supabase
      .from('sessions')
      .select('status, devices!inner(branches!inner(org_id))')
      .eq('devices.branches.org_id', orgId)
    
    const { data: todayTransactions } = await supabase
      .from('transactions')
      .select('amount, type, branches!inner(org_id)')
      .eq('branches.org_id', orgId)
      .eq('type', 'topup')
      .gte('created_at', today.toISOString())
    
    const totalDevices = devices?.length || 0
    
    // Count active devices based on heartbeat
    const activeDevices = devices?.filter(d => {
      if (!d.last_heartbeat) return false
      const timeSinceHeartbeat = Date.now() - new Date(d.last_heartbeat).getTime()
      return timeSinceHeartbeat <= HEARTBEAT_TIMEOUT_MS && (d.status === 'in_use' || d.status === 'online')
    }).length || 0
    
    const totalMembers = members?.length || 0
    const activeMembers = members?.filter(m => m.is_active).length || 0
    const totalSessions = sessions?.length || 0
    const activeSessions = sessions?.filter(s => s.status === 'active').length || 0
    const todayRevenue = todayTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0
    const pendingCount = pendingDevices?.length || 0
    
    return {
      totalDevices,
      activeDevices,
      totalMembers,
      activeMembers,
      totalSessions,
      activeSessions,
      todayRevenue,
      pendingDevices: pendingCount
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return {
      totalDevices: 0,
      activeDevices: 0,
      totalMembers: 0,
      activeMembers: 0,
      totalSessions: 0,
      activeSessions: 0,
      todayRevenue: 0,
      pendingDevices: 0
    }
  }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export function subscribeToDevices(
  callback: (payload: { eventType: string; new: Device; old: Device }) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel('devices-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'devices'
      },
      (payload) => {
        console.log('📡 Device realtime update:', payload.eventType)
        callback(payload as unknown as { eventType: string; new: Device; old: Device })
      }
    )
    .subscribe((status) => {
      console.log('Devices subscription status:', status)
    })
}

export function subscribeToSessions(
  callback: (payload: { eventType: string; new: Session; old: Session }) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel('sessions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions'
      },
      (payload) => {
        console.log('📡 Session realtime update:', payload.eventType, (payload.new as Session)?.status)
        callback(payload as unknown as { eventType: string; new: Session; old: Session })
      }
    )
    .subscribe((status) => {
      console.log('Sessions subscription status:', status)
    })
}

// Subscribe to a specific session for time updates
export function subscribeToSessionTime(
  sessionId: string,
  callback: (session: Session) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel(`session-time-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`
      },
      async (payload) => {
        const session = payload.new as Session
        console.log('⏱️ Session time update:', session.time_remaining_seconds, session.total_seconds_used)
        callback(session)
      }
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabase()
  supabase.removeChannel(channel)
}

// ============================================
// DEVICE STATUS POLLING (for heartbeat checking)
// ============================================

let deviceStatusInterval: ReturnType<typeof setInterval> | null = null

export function startDeviceStatusPolling(
  orgId: string,
  onDevicesUpdate: (devices: Device[]) => void,
  intervalMs: number = 10000 // Check every 10 seconds
): void {
  console.log('🔄 Starting device status polling...')
  
  if (deviceStatusInterval) {
    clearInterval(deviceStatusInterval)
  }
  
  // Initial fetch
  getDevices(orgId).then(onDevicesUpdate)
  
  deviceStatusInterval = setInterval(async () => {
    const devices = await getDevices(orgId)
    onDevicesUpdate(devices)
  }, intervalMs)
}

export function stopDeviceStatusPolling(): void {
  if (deviceStatusInterval) {
    clearInterval(deviceStatusInterval)
    deviceStatusInterval = null
    console.log('Device status polling stopped')
  }
}

// ============================================
// ACTIVE SESSIONS POLLING (for time updates)
// ============================================

let activeSessionsInterval: ReturnType<typeof setInterval> | null = null

export function startActiveSessionsPolling(
  orgId: string,
  onSessionsUpdate: (sessions: Session[]) => void,
  intervalMs: number = 5000 // Check every 5 seconds
): void {
  console.log('🔄 Starting active sessions polling...')
  
  if (activeSessionsInterval) {
    clearInterval(activeSessionsInterval)
  }
  
  // Initial fetch
  getActiveSessions(orgId).then(onSessionsUpdate)
  
  activeSessionsInterval = setInterval(async () => {
    const sessions = await getActiveSessions(orgId)
    onSessionsUpdate(sessions)
  }, intervalMs)
}

export function stopActiveSessionsPolling(): void {
  if (activeSessionsInterval) {
    clearInterval(activeSessionsInterval)
    activeSessionsInterval = null
    console.log('Active sessions polling stopped')
  }
}