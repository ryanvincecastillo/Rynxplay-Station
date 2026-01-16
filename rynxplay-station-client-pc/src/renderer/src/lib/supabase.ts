import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Device, Session, Member, DeviceCommand, Rate, Branch, SystemSpecs } from '../types'

// Get Supabase credentials from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient: SupabaseClient | null = null

export function initSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.')
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

// Device operations

// Register device as pending (called from client)
export async function registerPendingDevice(
  deviceCode: string,
  deviceName: string,
  specs: SystemSpecs
): Promise<Device | null> {
  const supabase = getSupabase()
  
  // First check if device already exists
  const { data: existingDevice } = await supabase
    .from('devices')
    .select('*')
    .eq('device_code', deviceCode)
    .single()

  if (existingDevice) {
    // Update existing device with new specs and name
    const { data, error } = await supabase
      .from('devices')
      .update({
        name: deviceName,
        specs: specs,
        last_heartbeat: new Date().toISOString()
      })
      .eq('device_code', deviceCode)
      .select('*, rates(*), branches(*)')
      .single()

    if (error) {
      console.error('Error updating device:', error)
      return existingDevice
    }
    return data
  }

  // Create new pending device
  const { data, error } = await supabase
    .from('devices')
    .insert({
      device_code: deviceCode,
      name: deviceName,
      device_type: 'pc',
      status: 'pending',
      is_locked: true,
      specs: specs,
      last_heartbeat: new Date().toISOString()
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error registering pending device:', error)
    return null
  }

  return data
}

export async function getDeviceByCode(deviceCode: string): Promise<Device | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('devices')
    .select('*, rates(*), branches(*, organizations(*))')
    .eq('device_code', deviceCode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No device found
      return null
    }
    console.error('Error getting device:', error)
    return null
  }

  return data
}

export async function updateDeviceStatus(
  deviceId: string,
  status: Device['status'],
  isLocked: boolean
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .update({
      status,
      is_locked: isLocked,
      last_heartbeat: new Date().toISOString()
    })
    .eq('id', deviceId)

  if (error) {
    console.error('Error updating device status:', error)
    return false
  }

  return true
}

export async function updateDeviceSpecs(
  deviceCode: string,
  specs: SystemSpecs
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .update({
      specs: specs,
      last_heartbeat: new Date().toISOString()
    })
    .eq('device_code', deviceCode)

  if (error) {
    console.error('Error updating device specs:', error)
    return false
  }

  return true
}

export async function sendHeartbeat(deviceId: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('devices')
    .update({
      last_heartbeat: new Date().toISOString()
    })
    .eq('id', deviceId)

  if (error) {
    console.error('Error sending heartbeat:', error)
    return false
  }

  return true
}

// Session operations
export async function getActiveSession(deviceId: string): Promise<Session | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*, members(*), rates(*)')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting active session:', error)
    return null
  }

  return data
}

export async function updateSessionTimeRemaining(
  sessionId: string,
  timeRemainingSeconds: number
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('sessions')
    .update({
      time_remaining_seconds: timeRemainingSeconds
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error updating session time:', error)
    return false
  }

  return true
}

export async function endSession(
  sessionId: string,
  totalSecondsUsed: number,
  totalAmount: number
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      total_seconds_used: totalSecondsUsed,
      total_amount: totalAmount
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error ending session:', error)
    return false
  }

  return true
}

// Member operations
export async function loginMember(
  orgId: string,
  username: string,
  pinCode: string
): Promise<Member | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', orgId)
    .eq('username', username)
    .eq('pin_code', pinCode)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error logging in member:', error)
    return null
  }

  return data
}

export async function getMemberById(memberId: string): Promise<Member | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single()

  if (error) {
    console.error('Error getting member:', error)
    return null
  }

  return data
}

export async function startMemberSession(
  deviceId: string,
  memberId: string,
  rateId: string
): Promise<Session | null> {
  const supabase = getSupabase()
  
  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      device_id: deviceId,
      member_id: memberId,
      rate_id: rateId,
      session_type: 'member',
      status: 'active'
    })
    .select('*, members(*), rates(*)')
    .single()

  if (sessionError) {
    console.error('Error creating member session:', sessionError)
    return null
  }

  // Update device
  const { error: deviceError } = await supabase
    .from('devices')
    .update({
      status: 'in_use',
      is_locked: false,
      current_session_id: session.id
    })
    .eq('id', deviceId)

  if (deviceError) {
    console.error('Error updating device for session:', deviceError)
  }

  return session
}

export async function chargeMemberCredits(
  memberId: string,
  amount: number,
  sessionId: string
): Promise<{ success: boolean; newBalance?: number }> {
  const supabase = getSupabase()
  
  // Get current balance
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('credits')
    .eq('id', memberId)
    .single()

  if (memberError || !member) {
    console.error('Error getting member balance:', memberError)
    return { success: false }
  }

  const currentBalance = member.credits
  const newBalance = currentBalance - amount

  if (newBalance < 0) {
    return { success: false }
  }

  // Update member credits
  const { error: updateError } = await supabase
    .from('members')
    .update({ credits: newBalance })
    .eq('id', memberId)

  if (updateError) {
    console.error('Error updating member credits:', updateError)
    return { success: false }
  }

  // Create transaction record
  await supabase.from('transactions').insert({
    member_id: memberId,
    session_id: sessionId,
    type: 'usage',
    amount: -amount,
    balance_before: currentBalance,
    balance_after: newBalance
  })

  return { success: true, newBalance }
}

// Command operations
export async function getPendingCommands(deviceId: string): Promise<DeviceCommand[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error getting pending commands:', error)
    return []
  }

  return data || []
}

export async function markCommandExecuted(
  commandId: string,
  success: boolean,
  errorMessage?: string
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('device_commands')
    .update({
      status: success ? 'executed' : 'failed',
      executed_at: new Date().toISOString(),
      error_message: errorMessage
    })
    .eq('id', commandId)

  if (error) {
    console.error('Error marking command as executed:', error)
    return false
  }

  return true
}

// Rate operations
export async function getDefaultRate(branchId: string): Promise<Rate | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('rates')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_default', true)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error getting default rate:', error)
    return null
  }

  return data
}

// Branch operations
export async function getBranches(orgId: string): Promise<Branch[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error getting branches:', error)
    return []
  }

  return data || []
}

export async function getBranchById(branchId: string): Promise<Branch | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*, organizations(*)')
    .eq('id', branchId)
    .single()

  if (error) {
    console.error('Error getting branch:', error)
    return null
  }

  return data
}

// Realtime subscriptions
export function subscribeToDevice(
  deviceCode: string,
  callback: (device: Device) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel(`device-${deviceCode}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'devices',
        filter: `device_code=eq.${deviceCode}`
      },
      (payload) => {
        callback(payload.new as Device)
      }
    )
    .subscribe()
}

export function subscribeToSession(
  deviceId: string,
  callback: (session: Session | null) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel(`sessions-${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `device_id=eq.${deviceId}`
      },
      async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const session = payload.new as Session
          if (session.status === 'active') {
            const fullSession = await getActiveSession(deviceId)
            callback(fullSession)
          } else {
            callback(null)
          }
        } else if (payload.eventType === 'DELETE') {
          callback(null)
        }
      }
    )
    .subscribe()
}

export function subscribeToCommands(
  deviceId: string,
  callback: (command: DeviceCommand) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel(`commands-${deviceId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_commands',
        filter: `device_id=eq.${deviceId}`
      },
      (payload) => {
        callback(payload.new as DeviceCommand)
      }
    )
    .subscribe()
}

export function subscribeToMemberCredits(
  memberId: string,
  callback: (credits: number) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  return supabase
    .channel(`member-${memberId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'members',
        filter: `id=eq.${memberId}`
      },
      (payload) => {
        const member = payload.new as Member
        callback(member.credits)
      }
    )
    .subscribe()
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabase()
  supabase.removeChannel(channel)
}
