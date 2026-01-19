import { create } from 'zustand'
import type { AppConfig, Device, Session, Member, AppScreen, SystemInfo, SystemSpecs, DeviceCommand } from '../types'
import {
  initSupabase,
  isSupabaseConfigured,
  getDeviceByCode,
  registerPendingDevice as registerPendingDeviceApi,
  updateDeviceStatus,
  updateDeviceSpecs,
  sendHeartbeat,
  getActiveSession,
  endSession,
  loginMember,
  startMemberSession,
  chargeMemberCredits,
  getPendingCommands,
  markCommandExecuted,
  subscribeToDevice,
  subscribeToSession,
  subscribeToCommands,
  subscribeToMemberCredits,
  unsubscribe,
  startCommandPolling,
  stopCommandPolling,
  startSessionPolling,
  stopSessionPolling
} from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface AppStore {
  // State
  screen: AppScreen
  isLocked: boolean
  isOnline: boolean
  isInitialized: boolean
  isSupabaseConfigured: boolean
  device: Device | null
  session: Session | null
  member: Member | null
  config: AppConfig | null
  systemInfo: SystemInfo | null
  systemSpecs: SystemSpecs | null
  deviceCode: string | null
  qrCodeUrl: string | null
  message: string | null
  error: string | null
  
  // Admin unlock state
  isAdminUnlocked: boolean
  adminUnlockExpiresAt: number | null // timestamp, null = unlimited
  adminUnlockedBy: string | null
  
  // Timer state
  timeRemaining: number
  totalSecondsUsed: number
  
  // Realtime channels
  channels: RealtimeChannel[]
  
  // Actions
  initialize: () => Promise<void>
  setConfig: (config: Partial<AppConfig>) => Promise<void>
  setDeviceName: (name: string) => Promise<void>
  registerPendingDevice: () => Promise<boolean>
  
  // Lock/Unlock
  lock: () => Promise<void>
  unlock: () => Promise<void>
  adminUnlock: (durationMinutes: number, unlockedBy: string) => Promise<void>
  checkAdminUnlockExpiry: () => void
  
  // Session management
  startGuestSession: (timeSeconds: number) => void
  handleMemberLogin: (username: string, pin: string) => Promise<boolean>
  endCurrentSession: (terminatedByAdmin?: boolean) => Promise<void>
  
  // Timer
  decrementTimer: () => void
  chargeCredits: () => Promise<boolean>
  
  // Commands
  processCommand: (command: DeviceCommand) => Promise<void>
  
  // UI
  showMessage: (message: string) => void
  clearMessage: () => void
  setError: (error: string | null) => void
  setScreen: (screen: AppScreen) => void
  
  // Cleanup
  cleanup: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  screen: 'setup',
  isLocked: true,
  isOnline: false,
  isInitialized: false,
  isSupabaseConfigured: false,
  device: null,
  session: null,
  member: null,
  config: null,
  systemInfo: null,
  systemSpecs: null,
  deviceCode: null,
  qrCodeUrl: null,
  message: null,
  error: null,
  timeRemaining: 0,
  totalSecondsUsed: 0,
  channels: [],
  
  // Admin unlock state
  isAdminUnlocked: false,
  adminUnlockExpiresAt: null,
  adminUnlockedBy: null,

  initialize: async () => {
    try {
      // Get config from main process
      const config = await window.api.getConfig() as AppConfig
      const systemInfo = await window.api.getSystemInfo()
      
      set({ config, systemInfo })

      // Get or create device code
      const deviceCode = await window.api.getDeviceCode()
      set({ deviceCode })

      // Generate QR code
      const qrCodeUrl = await window.api.generateQRCode(deviceCode)
      set({ qrCodeUrl })

      // Get system specs
      const systemSpecs = await window.api.getSystemSpecs() as SystemSpecs
      set({ systemSpecs })

      // Check if Supabase is configured
      const supabaseConfigured = isSupabaseConfigured()
      set({ isSupabaseConfigured: supabaseConfigured })

      if (!supabaseConfigured) {
        set({ screen: 'setup', isInitialized: true })
        return
      }

      // Initialize Supabase
      try {
        initSupabase()
      } catch (err) {
        console.error('Failed to initialize Supabase:', err)
        set({ screen: 'setup', isInitialized: true })
        return
      }

      // Check if device exists in database
      const device = await getDeviceByCode(deviceCode)
      
      if (device) {
        set({ device, isOnline: true })

        // Update specs in database
        await updateDeviceSpecs(deviceCode, systemSpecs)

        // Check if device is approved (has branch_id assigned)
        if (device.branch_id) {
          // Device is approved
          await window.api.saveConfig({ 
            ...config, 
            isRegistered: true, 
            isApproved: true,
            deviceId: device.id,
            branchId: device.branch_id
          })

          // Update device status to online
          await updateDeviceStatus(device.id, 'online', device.is_locked)
          
          // Check for active session
          const activeSession = await getActiveSession(device.id)
          
          if (activeSession) {
            set({ 
              session: activeSession,
              member: activeSession.members || null,
              isLocked: false,
              screen: 'session',
              timeRemaining: activeSession.time_remaining_seconds || 0,
              totalSecondsUsed: activeSession.total_seconds_used
            })
            
            await window.api.unlockScreen()
            
            // Start session polling as backup
            startSessionPolling(activeSession.id, () => {
              get().endCurrentSession(true)
            })
          } else {
            set({ screen: 'lock', isLocked: true })
            await window.api.lockScreen()
          }
          
          // Set up realtime subscriptions
          setupSubscriptions(device.id, deviceCode, set, get)
          
          // Start heartbeat
          startHeartbeatInterval(device.id)
          
          // Process any pending commands
          const commands = await getPendingCommands(device.id)
          for (const cmd of commands) {
            await get().processCommand(cmd)
          }
        } else {
          // Device exists but not approved yet - show pending screen
          set({ screen: 'pending' })
          
          // Subscribe to device changes to detect approval
          const channel = subscribeToDevice(deviceCode, async (updatedDevice) => {
            if (updatedDevice.branch_id) {
              // Device has been approved!
              set({ device: updatedDevice })
              
              await window.api.saveConfig({ 
                ...get().config, 
                isRegistered: true, 
                isApproved: true,
                deviceId: updatedDevice.id,
                branchId: updatedDevice.branch_id
              })
              
              // Reinitialize to set up everything properly
              get().cleanup()
              await get().initialize()
            }
          })
          
          set({ channels: [channel] })
        }
      } else {
        // Device not registered yet - show setup screen
        set({ screen: 'setup', isLocked: true })
      }
      
      set({ isInitialized: true })
      
      // Listen for messages from main process
      window.api.onDisplayMessage((msg) => {
        get().showMessage(msg)
      })
    } catch (error) {
      console.error('Initialization error:', error)
      set({ error: 'Failed to initialize application', screen: 'setup', isInitialized: true })
    }
  },

  setConfig: async (newConfig) => {
    const currentConfig = get().config
    const updatedConfig = { ...currentConfig, ...newConfig } as AppConfig
    
    await window.api.saveConfig(updatedConfig)
    set({ config: updatedConfig })
  },

  setDeviceName: async (name: string) => {
    await get().setConfig({ deviceName: name })
  },

  registerPendingDevice: async () => {
    const { deviceCode, systemSpecs, config } = get()
    
    if (!deviceCode || !systemSpecs) {
      set({ error: 'Device code or specs not available' })
      return false
    }

    if (!isSupabaseConfigured()) {
      set({ error: 'Supabase is not configured' })
      return false
    }

    try {
      initSupabase()
      
      const device = await registerPendingDeviceApi(
        deviceCode,
        config?.deviceName || systemSpecs.os.hostname,
        systemSpecs
      )
      
      if (device) {
        set({ device })
        
        await get().setConfig({ 
          isRegistered: true, 
          deviceId: device.id 
        })
        
        // If device already has branch_id, it's approved
        if (device.branch_id) {
          set({ screen: 'lock' })
          await get().initialize() // Reinitialize with approved device
        } else {
          // Show pending screen
          set({ screen: 'pending' })
          
          // Subscribe to device changes to detect approval
          const channel = subscribeToDevice(deviceCode, async (updatedDevice) => {
            if (updatedDevice.branch_id) {
              set({ device: updatedDevice })
              get().cleanup()
              await get().initialize()
            }
          })
          
          set({ channels: [channel] })
        }
        
        return true
      }
      
      set({ error: 'Failed to register device' })
      return false
    } catch (err) {
      console.error('Registration error:', err)
      set({ error: 'Failed to register device' })
      return false
    }
  },

  lock: async () => {
    const { device, isAdminUnlocked } = get()
    
    // Don't lock if admin unlocked
    if (isAdminUnlocked) {
      console.log('Device is admin unlocked, not locking')
      return
    }
    
    set({ isLocked: true, screen: 'lock' })
    await window.api.lockScreen()
    
    if (device) {
      await updateDeviceStatus(device.id, 'online', true)
    }
  },

  unlock: async () => {
    const { device } = get()
    
    set({ isLocked: false })
    await window.api.unlockScreen()
    
    if (device) {
      await updateDeviceStatus(device.id, 'in_use', false)
    }
  },

  adminUnlock: async (durationMinutes: number, unlockedBy: string) => {
    const expiresAt = durationMinutes > 0 
      ? Date.now() + (durationMinutes * 60 * 1000) 
      : null
    
    set({
      isAdminUnlocked: true,
      adminUnlockExpiresAt: expiresAt,
      adminUnlockedBy: unlockedBy,
      isLocked: false,
      screen: 'session'
    })
    
    await window.api.unlockScreen()
    
    get().showMessage(
      durationMinutes > 0 
        ? `Admin unlocked for ${durationMinutes} minutes by ${unlockedBy}` 
        : `Admin unlocked (unlimited) by ${unlockedBy}`
    )
    
    // Start checking for expiry if there's a time limit
    if (expiresAt) {
      startAdminUnlockExpiryCheck(get)
    }
  },

  checkAdminUnlockExpiry: () => {
    const { isAdminUnlocked, adminUnlockExpiresAt, session } = get()
    
    if (!isAdminUnlocked || !adminUnlockExpiresAt) return
    
    if (Date.now() >= adminUnlockExpiresAt) {
      // Admin unlock expired
      set({
        isAdminUnlocked: false,
        adminUnlockExpiresAt: null,
        adminUnlockedBy: null
      })
      
      get().showMessage('Admin unlock expired')
      
      // If no active session, lock the device
      if (!session) {
        get().lock()
      }
    }
  },

  startGuestSession: (timeSeconds) => {
    set({
      session: {
        id: 'guest-local',
        device_id: get().device?.id || '',
        member_id: null,
        rate_id: null,
        session_type: 'guest',
        started_at: new Date().toISOString(),
        ended_at: null,
        paused_at: null,
        time_remaining_seconds: timeSeconds,
        total_seconds_used: 0,
        total_amount: 0,
        status: 'active',
        created_at: new Date().toISOString()
      },
      timeRemaining: timeSeconds,
      totalSecondsUsed: 0,
      screen: 'session',
      isLocked: false
    })
    
    window.api.unlockScreen()
  },

  handleMemberLogin: async (username, pin) => {
    const { device } = get()
    
    if (!device || !device.branch_id) {
      set({ error: 'Device not configured' })
      return false
    }

    // Get organization ID from device's branch
    const branch = device.branches
    if (!branch) {
      set({ error: 'Branch information not available' })
      return false
    }

    const orgId = (branch as any).org_id || (branch as any).organizations?.id
    if (!orgId) {
      set({ error: 'Organization not found' })
      return false
    }
    
    const member = await loginMember(orgId, username, pin)
    
    if (!member) {
      set({ error: 'Invalid username or PIN' })
      return false
    }
    
    if (member.credits <= 0) {
      set({ error: 'Insufficient credits' })
      return false
    }
    
    // Get rate
    const rateId = device.rate_id || device.rates?.id
    if (!rateId) {
      set({ error: 'No rate configured for this device' })
      return false
    }
    
    // Start member session
    const session = await startMemberSession(device.id, member.id, rateId)
    
    if (!session) {
      set({ error: 'Failed to start session' })
      return false
    }
    
    set({
      session,
      member,
      screen: 'session',
      isLocked: false,
      timeRemaining: 0,
      error: null
    })
    
    await window.api.unlockScreen()
    
    // Start session polling as backup
    startSessionPolling(session.id, () => {
      get().endCurrentSession(true)
    })
    
    // Subscribe to member credit changes
    const channel = subscribeToMemberCredits(member.id, (credits) => {
      set((state) => ({
        member: state.member ? { ...state.member, credits } : null
      }))
    })
    
    set((state) => ({ channels: [...state.channels, channel] }))
    
    return true
  },

  endCurrentSession: async (terminatedByAdmin = false) => {
    const { session, device, totalSecondsUsed } = get()
    
    // Stop session polling
    stopSessionPolling()
    
    // Only update session in DB if it wasn't terminated by admin
    // (Admin already updated it when they terminated)
    if (session && session.id !== 'guest-local' && !terminatedByAdmin) {
      await endSession(session.id, totalSecondsUsed, session.total_amount)
    }
    
    // Update device status
    if (device) {
      await updateDeviceStatus(device.id, 'online', true)
    }
    
    set({
      session: null,
      member: null,
      timeRemaining: 0,
      totalSecondsUsed: 0,
      screen: 'lock',
      isLocked: true
    })
    
    await window.api.lockScreen()
  },

  decrementTimer: () => {
    const { session, timeRemaining, totalSecondsUsed } = get()
    
    if (!session || session.status !== 'active') return
    
    const newTimeRemaining = Math.max(0, timeRemaining - 1)
    const newTotalSeconds = totalSecondsUsed + 1
    
    set({
      timeRemaining: newTimeRemaining,
      totalSecondsUsed: newTotalSeconds
    })
    
    // End session if time runs out (guest sessions)
    if (session.session_type === 'guest' && newTimeRemaining <= 0) {
      get().endCurrentSession()
    }
  },

  chargeCredits: async () => {
    const { session, member } = get()
    
    if (!session || !member || session.session_type !== 'member') {
      return true
    }
    
    const rate = session.rates
    if (!rate) return true
    
    // Calculate charge for the last minute
    const chargeAmount = (60 / rate.unit_minutes / 60) * rate.price_per_unit
    
    const result = await chargeMemberCredits(member.id, chargeAmount, session.id)
    
    if (!result.success) {
      // Insufficient credits - end session
      get().showMessage('Insufficient credits. Session ending...')
      setTimeout(() => get().endCurrentSession(), 3000)
      return false
    }
    
    // Update local member credits
    if (result.newBalance !== undefined) {
      set((state) => ({
        member: state.member ? { ...state.member, credits: result.newBalance! } : null
      }))
    }
    
    return true
  },

  processCommand: async (command) => {
    const { showMessage, lock, endCurrentSession, adminUnlock } = get()
    
    console.log('🎮 Processing command:', command.command_type, command.payload)
    
    try {
      switch (command.command_type) {
        case 'shutdown':
          showMessage('System will shutdown in 30 seconds...')
          await window.api.executeCommand('shutdown')
          await markCommandExecuted(command.id, true)
          break
          
        case 'restart':
          showMessage('System will restart in 30 seconds...')
          await window.api.executeCommand('restart')
          await markCommandExecuted(command.id, true)
          break
          
        case 'lock':
          // Session was terminated by admin
          await endCurrentSession(true)
          await lock()
          await markCommandExecuted(command.id, true)
          break
          
        case 'unlock':
          // Regular unlock - just mark as executed
          await markCommandExecuted(command.id, true)
          break
          
        case 'admin_unlock':
          // Admin superuser unlock
          const durationMinutes = (command.payload as any)?.duration_minutes || 0
          const unlockedBy = (command.payload as any)?.unlocked_by || 'Admin'
          await adminUnlock(durationMinutes, unlockedBy)
          await markCommandExecuted(command.id, true)
          break
          
        case 'message':
          const msg = (command.payload as any)?.message || 'Message from admin'
          showMessage(msg)
          await markCommandExecuted(command.id, true)
          break
          
        default:
          await markCommandExecuted(command.id, false, 'Unknown command type')
      }
    } catch (error) {
      console.error('Command execution error:', error)
      await markCommandExecuted(command.id, false, String(error))
    }
  },

  showMessage: (message) => {
    set({ message })
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      const { message: currentMessage, session, device } = get()
      if (currentMessage === message) {
        set({ 
          message: null,
          screen: session ? 'session' : (device?.branch_id ? 'lock' : 'setup')
        })
      }
    }, 5000)
  },

  clearMessage: () => {
    const { session, device } = get()
    set({ 
      message: null,
      screen: session ? 'session' : (device?.branch_id ? 'lock' : 'setup')
    })
  },

  setError: (error) => {
    set({ error })
    
    if (error) {
      setTimeout(() => {
        const { error: currentError } = get()
        if (currentError === error) {
          set({ error: null })
        }
      }, 5000)
    }
  },

  setScreen: (screen) => {
    set({ screen })
  },

  cleanup: () => {
    const { channels } = get()
    
    channels.forEach((channel) => {
      unsubscribe(channel)
    })
    
    // Stop command polling
    stopCommandPolling()
    
    // Stop session polling
    stopSessionPolling()
    
    set({ channels: [] })
    
    window.api.removeDisplayMessageListener()
  }
}))

// Helper functions
function setupSubscriptions(
  deviceId: string,
  deviceCode: string,
  set: (state: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
  get: () => AppStore
): void {
  const channels: RealtimeChannel[] = []
  
  // Subscribe to device changes
  const deviceChannel = subscribeToDevice(deviceCode, (device) => {
    set({ device })
    
    // Handle lock state changes
    if (device.is_locked && !get().isLocked && !get().isAdminUnlocked) {
      get().lock()
    }
  })
  channels.push(deviceChannel)
  
  // Subscribe to session changes
  const sessionChannel = subscribeToSession(deviceId, async (session) => {
    console.log('Session subscription callback:', session?.status || 'null')
    
    if (session && session.status === 'active') {
      // New or updated active session
      const currentSession = get().session
      
      // Only start a new session if we don't have one
      if (!currentSession || currentSession.id !== session.id) {
        set({ 
          session,
          member: session.members || null,
          timeRemaining: session.time_remaining_seconds || 0,
          screen: 'session'
        })
        await get().unlock()
        
        // Start session polling for this session
        startSessionPolling(session.id, () => {
          get().endCurrentSession(true)
        })
      }
    } else {
      // No active session or session ended
      const currentSession = get().session
      if (currentSession && currentSession.id !== 'guest-local') {
        console.log('Session ended via realtime, terminating locally')
        await get().endCurrentSession(true)
      }
    }
  })
  channels.push(sessionChannel)
  
  // Subscribe to commands
  const commandChannel = subscribeToCommands(deviceId, (command) => {
    get().processCommand(command)
  })
  channels.push(commandChannel)
  
  set({ channels })
  
  // ALSO start polling as a backup in case realtime doesn't work
  // This polls every 3 seconds for new commands
  startCommandPolling(deviceId, (command) => {
    get().processCommand(command)
  }, 3000)
}

let heartbeatInterval: NodeJS.Timeout | null = null

function startHeartbeatInterval(deviceId: string): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
  
  // Send heartbeat every 30 seconds
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(deviceId)
  }, 30000)
}

let adminUnlockExpiryInterval: NodeJS.Timeout | null = null

function startAdminUnlockExpiryCheck(get: () => AppStore): void {
  if (adminUnlockExpiryInterval) {
    clearInterval(adminUnlockExpiryInterval)
  }
  
  // Check every 10 seconds if admin unlock has expired
  adminUnlockExpiryInterval = setInterval(() => {
    get().checkAdminUnlockExpiry()
  }, 10000)
}