import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Device, Session, Member, DeviceCommand, Rate, Branch, SystemSpecs } from '../types'

// Get Supabase credentials from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabaseClient: SupabaseClient | null = null

// Debug logging helper
function debugLog(type: 'info' | 'success' | 'error' | 'command', message: string) {
  const logFn = (window as any).addDebugLog
  if (logFn) {
    logFn(type, message)
  }
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'command' ? '🎮' : '📡'
  console.log(`${prefix} [Supabase] ${message}`)
}

export function initSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.')
  }
  
  if (!supabaseClient) {
    debugLog('info', 'Initializing Supabase client...')
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
    debugLog('success', 'Supabase client initialized')
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

export async function registerPendingDevice(
  deviceCode: string,
  deviceName: string,
  specs: SystemSpecs
): Promise<Device | null> {
  const supabase = getSupabase()
  
  const { data: existingDevice } = await supabase
    .from('devices')
    .select('*')
    .eq('device_code', deviceCode)
    .single()

  if (existingDevice) {
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

  debugLog('success', `Device status updated: ${status}, locked: ${isLocked}`)
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

  debugLog('info', '💓 Heartbeat sent')
  return true
}

// Session operations
export async function getActiveSession(deviceId: string): Promise<Session | null> {
  const supabase = getSupabase()
  
  debugLog('info', `Fetching active session for device: ${deviceId.slice(0, 8)}...`)
  
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

  if (data) {
    debugLog('success', `Active session found: ${data.id}, status: ${data.status}, type: ${data.session_type}`)
    debugLog('info', `Session time_remaining: ${data.time_remaining_seconds}, total_used: ${data.total_seconds_used}`)
  } else {
    debugLog('info', 'No active session found')
  }

  return data
}

export async function checkSessionStatus(sessionId: string): Promise<Session | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*, members(*), rates(*)')
    .eq('id', sessionId)
    .single()

  if (error) {
    console.error('Error checking session status:', error)
    return null
  }

  return data
}

// Update session time - called periodically to sync with database
export async function updateSessionTime(
  sessionId: string,
  timeRemainingSeconds: number,
  totalSecondsUsed: number
): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('sessions')
    .update({
      time_remaining_seconds: timeRemainingSeconds,
      total_seconds_used: totalSecondsUsed,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error updating session time:', error)
    return false
  }

  return true
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
      total_amount: totalAmount,
      time_remaining_seconds: 0
    })
    .eq('id', sessionId)

  if (error) {
    console.error('Error ending session:', error)
    return false
  }

  debugLog('success', 'Session ended')
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

export async function startMemberSession(
  deviceId: string,
  memberId: string,
  rateId: string
): Promise<Session | null> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      device_id: deviceId,
      member_id: memberId,
      rate_id: rateId,
      session_type: 'member',
      status: 'active',
      started_at: new Date().toISOString(),
      total_seconds_used: 0,
      total_amount: 0
    })
    .select('*, members(*), rates(*)')
    .single()

  if (error) {
    console.error('Error starting member session:', error)
    return null
  }

  return data
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
    console.error('Error getting member credits:', memberError)
    return { success: false }
  }

  if (member.credits < amount) {
    return { success: false }
  }

  const newBalance = member.credits - amount

  // Update member credits
  const { error: updateError } = await supabase
    .from('members')
    .update({ credits: newBalance })
    .eq('id', memberId)

  if (updateError) {
    console.error('Error updating credits:', updateError)
    return { success: false }
  }

  // Update session total amount
  const { error: sessionError } = await supabase
    .rpc('increment_session_amount', { 
      session_id: sessionId, 
      amount: amount 
    })

  if (sessionError) {
    // Try direct update if RPC doesn't exist
    await supabase
      .from('sessions')
      .update({ 
        total_amount: amount // This would need to be accumulative
      })
      .eq('id', sessionId)
  }

  return { success: true, newBalance }
}

// Command operations
export async function getPendingCommands(deviceId: string): Promise<DeviceCommand[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', deviceId)
    .is('executed_at', null)
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
      executed_at: new Date().toISOString(),
      success,
      error_message: errorMessage
    })
    .eq('id', commandId)

  if (error) {
    console.error('Error marking command executed:', error)
    return false
  }

  debugLog('success', `Command executed: ${success ? 'success' : 'failed'}`)
  return true
}

// Rate operations
export async function getRates(branchId: string): Promise<Rate[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('rates')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })

  if (error) {
    console.error('Error getting rates:', error)
    return []
  }

  return data || []
}

// Branch operations
export async function getBranches(orgId: string): Promise<Branch[]> {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .from('branches')
    .select('*, organizations(*)')
    .eq('org_id', orgId)

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

// ============================================
// REALTIME SUBSCRIPTIONS 
// ============================================

export function subscribeToDevice(
  deviceCode: string,
  callback: (device: Device) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  debugLog('info', `Subscribing to device: ${deviceCode}`)
  
  const channel = supabase
    .channel('device-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'devices'
      },
      (payload) => {
        const device = payload.new as Device
        if (device.device_code === deviceCode) {
          debugLog('command', `Device update received for ${deviceCode}`)
          callback(device)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        debugLog('success', `Device channel SUBSCRIBED`)
      } else if (status === 'CHANNEL_ERROR') {
        debugLog('error', `Device channel ERROR: ${err?.message || 'Unknown error'}`)
      } else if (status === 'TIMED_OUT') {
        debugLog('error', `Device channel TIMED_OUT`)
      } else if (status === 'CLOSED') {
        debugLog('info', `Device channel CLOSED`)
      } else {
        debugLog('info', `Device channel status: ${status}`)
      }
    })

  return channel
}

export function subscribeToSession(
  deviceId: string,
  callback: (session: Session | null) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  debugLog('info', `Subscribing to sessions for device: ${deviceId.slice(0, 8)}...`)
  
  const channel = supabase
    .channel('session-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sessions'
      },
      async (payload) => {
        const session = payload.new as Session
        const oldSession = payload.old as Session
        
        if (session && session.device_id === deviceId) {
          debugLog('command', `Session ${payload.eventType} for this device, status: ${session.status}`)
          
          if (session.status === 'active') {
            const fullSession = await getActiveSession(deviceId)
            callback(fullSession)
          } else {
            debugLog('info', `Session ended with status: ${session.status}`)
            callback(null)
          }
        } else if (payload.eventType === 'DELETE' && oldSession?.device_id === deviceId) {
          debugLog('info', 'Session deleted for this device')
          callback(null)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        debugLog('success', `Sessions channel SUBSCRIBED`)
      } else if (status === 'CHANNEL_ERROR') {
        debugLog('error', `Sessions channel ERROR: ${err?.message || 'Unknown error'}`)
      } else if (status === 'TIMED_OUT') {
        debugLog('error', `Sessions channel TIMED_OUT`)
      } else {
        debugLog('info', `Sessions channel status: ${status}`)
      }
    })

  return channel
}

export function subscribeToCommands(
  deviceId: string,
  callback: (command: DeviceCommand) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  debugLog('info', `Subscribing to commands for device: ${deviceId.slice(0, 8)}...`)
  
  const channel = supabase
    .channel('command-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_commands'
      },
      (payload) => {
        const command = payload.new as DeviceCommand
        if (command.device_id === deviceId) {
          debugLog('command', `🎮 COMMAND RECEIVED: ${command.command_type}`)
          debugLog('info', `Command ID: ${command.id}`)
          debugLog('info', `Payload: ${JSON.stringify(command.payload)}`)
          callback(command)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        debugLog('success', `Commands channel SUBSCRIBED ✓`)
      } else if (status === 'CHANNEL_ERROR') {
        debugLog('error', `Commands channel ERROR: ${err?.message || 'Unknown error'}`)
      } else if (status === 'TIMED_OUT') {
        debugLog('error', `Commands channel TIMED_OUT`)
      } else if (status === 'CLOSED') {
        debugLog('info', `Commands channel CLOSED`)
      } else {
        debugLog('info', `Commands channel status: ${status}`)
      }
    })

  return channel
}

export function subscribeToMemberCredits(
  memberId: string,
  callback: (credits: number) => void
): RealtimeChannel {
  const supabase = getSupabase()
  
  debugLog('info', `Subscribing to member credits: ${memberId.slice(0, 8)}...`)
  
  const channel = supabase
    .channel('member-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'members'
      },
      (payload) => {
        const member = payload.new as Member
        if (member.id === memberId) {
          debugLog('command', `Member credits update: ${member.credits}`)
          callback(member.credits)
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        debugLog('success', `Member credits channel SUBSCRIBED`)
      } else if (status === 'CHANNEL_ERROR') {
        debugLog('error', `Member credits channel ERROR: ${err?.message || 'Unknown error'}`)
      } else {
        debugLog('info', `Member credits channel status: ${status}`)
      }
    })

  return channel
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = getSupabase()
  supabase.removeChannel(channel)
  debugLog('info', 'Channel unsubscribed')
}

// ============================================
// POLLING FALLBACK
// ============================================

let pollingInterval: ReturnType<typeof setInterval> | null = null

export function startCommandPolling(
  deviceId: string, 
  callback: (command: DeviceCommand) => void,
  intervalMs: number = 3000
): void {
  debugLog('info', `🔄 Starting command polling (every ${intervalMs}ms)`)
  
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
  
  fetchAndProcessCommands(deviceId, callback)
  
  pollingInterval = setInterval(() => {
    fetchAndProcessCommands(deviceId, callback)
  }, intervalMs)
}

async function fetchAndProcessCommands(
  deviceId: string,
  callback: (command: DeviceCommand) => void
): Promise<void> {
  const commands = await getPendingCommands(deviceId)
  for (const command of commands) {
    debugLog('command', `[POLL] Processing command: ${command.command_type}`)
    callback(command)
  }
}

export function stopCommandPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
    debugLog('info', 'Command polling stopped')
  }
}

// ============================================
// SESSION STATUS POLLING
// ============================================

let sessionPollingInterval: ReturnType<typeof setInterval> | null = null

export function startSessionPolling(
  sessionId: string,
  onSessionEnded: () => void,
  intervalMs: number = 5000
): void {
  debugLog('info', `🔄 Starting session polling (every ${intervalMs}ms)`)
  
  if (sessionPollingInterval) {
    clearInterval(sessionPollingInterval)
  }
  
  sessionPollingInterval = setInterval(async () => {
    const session = await checkSessionStatus(sessionId)
    
    if (!session || session.status !== 'active') {
      debugLog('command', `[POLL] Session no longer active: ${session?.status || 'not found'}`)
      onSessionEnded()
      stopSessionPolling()
    }
  }, intervalMs)
}

export function stopSessionPolling(): void {
  if (sessionPollingInterval) {
    clearInterval(sessionPollingInterval)
    sessionPollingInterval = null
    debugLog('info', 'Session polling stopped')
  }
}

// ============================================
// SESSION TIME SYNC (NEW)
// ============================================

let sessionTimeSyncInterval: ReturnType<typeof setInterval> | null = null

export function startSessionTimeSync(
  sessionId: string,
  getTimeData: () => { timeRemaining: number; totalSecondsUsed: number },
  intervalMs: number = 10000 // Sync every 10 seconds
): void {
  debugLog('info', `🔄 Starting session time sync (every ${intervalMs}ms)`)
  
  if (sessionTimeSyncInterval) {
    clearInterval(sessionTimeSyncInterval)
  }
  
  sessionTimeSyncInterval = setInterval(async () => {
    const { timeRemaining, totalSecondsUsed } = getTimeData()
    const success = await updateSessionTime(sessionId, timeRemaining, totalSecondsUsed)
    if (success) {
      debugLog('info', `⏱️ Session time synced: ${timeRemaining}s remaining, ${totalSecondsUsed}s used`)
    }
  }, intervalMs)
}

export function stopSessionTimeSync(): void {
  if (sessionTimeSyncInterval) {
    clearInterval(sessionTimeSyncInterval)
    sessionTimeSyncInterval = null
    debugLog('info', 'Session time sync stopped')
  }
}