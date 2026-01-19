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
  
  return data || []
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

export async function createMember(orgId: string, member: Partial<Member>): Promise<Member | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('members')
    .insert({
      ...member,
      org_id: orgId,
      credits: 0,
      is_active: true
    })
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
  branchId?: string,
  paymentMethod: string = 'cash',
  createdBy?: string
): Promise<boolean> {
  const supabase = getSupabase()
  
  // Get current balance
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
  
  // Update member credits
  const { error: updateError } = await supabase
    .from('members')
    .update({ 
      credits: newBalance,
      updated_at: new Date().toISOString()
    })
    .eq('id', memberId)
  
  if (updateError) {
    console.error('Error updating credits:', updateError)
    return false
  }
  
  // Create transaction record if branch is provided
  if (branchId) {
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

// End session - updates session, device status, and sends lock command
export async function endSession(
  sessionId: string,
  totalSecondsUsed?: number,
  totalAmount?: number
): Promise<boolean> {
  const supabase = getSupabase()
  
  // First get the session to know the device ID
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, devices(*)')
    .eq('id', sessionId)
    .single()
  
  if (sessionError || !session) {
    console.error('Error getting session:', sessionError)
    return false
  }
  
  // Update session status
  const updateData: Record<string, unknown> = {
    status: 'terminated',
    ended_at: new Date().toISOString()
  }
  
  if (totalSecondsUsed !== undefined) {
    updateData.total_seconds_used = totalSecondsUsed
  }
  if (totalAmount !== undefined) {
    updateData.total_amount = totalAmount
  }
  
  const { error: updateError } = await supabase
    .from('sessions')
    .update(updateData)
    .eq('id', sessionId)
  
  if (updateError) {
    console.error('Error ending session:', updateError)
    return false
  }
  
  // Update device status to online and locked
  const { error: deviceError } = await supabase
    .from('devices')
    .update({
      status: 'online',
      is_locked: true,
      current_session_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.device_id)
  
  if (deviceError) {
    console.error('Error updating device status:', deviceError)
  }
  
  // Send lock command to device
  await supabase
    .from('device_commands')
    .insert({
      device_id: session.device_id,
      command_type: 'lock',
      payload: { reason: 'Session ended by admin' }
    })
  
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
    // Get device counts
    const { data: devices } = await supabase
      .from('devices')
      .select('status, branches!inner(org_id)')
      .eq('branches.org_id', orgId)
    
    // Get pending devices (no branch assigned)
    const { data: pendingDevices } = await supabase
      .from('devices')
      .select('id')
      .is('branch_id', null)
    
    // Get member counts
    const { data: members } = await supabase
      .from('members')
      .select('is_active')
      .eq('org_id', orgId)
    
    // Get session counts
    const { data: sessions } = await supabase
      .from('sessions')
      .select('status, devices!inner(branches!inner(org_id))')
      .eq('devices.branches.org_id', orgId)
    
    // Get today's revenue
    const { data: todayTransactions } = await supabase
      .from('transactions')
      .select('amount, type, branches!inner(org_id)')
      .eq('branches.org_id', orgId)
      .eq('type', 'topup')
      .gte('created_at', today.toISOString())
    
    const totalDevices = devices?.length || 0
    const activeDevices = devices?.filter(d => d.status === 'in_use' || d.status === 'online').length || 0
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

// Realtime subscriptions
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
        callback(payload as unknown as { eventType: string; new: Device; old: Device })
      }
    )
    .subscribe()
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
        callback(payload as unknown as { eventType: string; new: Session; old: Session })
      }
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabase()
  supabase.removeChannel(channel)
}