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
  stopSessionPolling,
  updateSessionTime,
  startSessionTimeSync,
  stopSessionTimeSync
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
  adminUnlockExpiresAt: number | null
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
  syncSessionTime: () => Promise<void>
  
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
      const config = await window.api.getConfig() as AppConfig
      const systemInfo = await window.api.getSystemInfo()
      
      set({ config, systemInfo })

      const deviceCode = await window.api.getDeviceCode()
      set({ deviceCode })

      const qrCodeUrl = await window.api.generateQRCode(deviceCode)
      set({ qrCodeUrl })

      const systemSpecs = await window.api.getSystemSpecs() as SystemSpecs
      set({ systemSpecs })

      const supabaseConfigured = isSupabaseConfigured()
      set({ isSupabaseConfigured: supabaseConfigured })

      if (!supabaseConfigured) {
        set({ screen: 'setup', isInitialized: true })
        return
      }

      try {
        initSupabase()
      } catch (err) {
        console.error('Failed to initialize Supabase:', err)
        set({ screen: 'setup', isInitialized: true })
        return
      }

      const device = await getDeviceByCode(deviceCode)
      
      if (device) {
        set({ device, isOnline: true })

        await updateDeviceSpecs(deviceCode, systemSpecs)

        if (device.branch_id) {
          await window.api.saveConfig({ 
            ...config, 
            isRegistered: true, 
            isApproved: true,
            deviceId: device.id,
            branchId: device.branch_id
          })

          await updateDeviceStatus(device.id, 'online', device.is_locked)
          
          const activeSession = await getActiveSession(device.id)
          
          if (activeSession) {
            const sessionTime = activeSession.time_remaining_seconds || 0
            const sessionUsed = activeSession.total_seconds_used || 0
            
            set({ 
              session: activeSession,
              member: activeSession.members || null,
              isLocked: false,
              screen: 'session',
              timeRemaining: sessionTime,
              totalSecondsUsed: sessionUsed
            })
            
            await window.api.unlockScreen()
            
            // Update device status to in_use
            await updateDeviceStatus(device.id, 'in_use', false)
            
            // START THE COUNTDOWN TIMER
            
            // Start session time sync
            startSessionTimeSync(activeSession.id, () => ({
              timeRemaining: get().timeRemaining,
              totalSecondsUsed: get().totalSecondsUsed
            }), 5000) // Sync every 5 seconds
            
            startSessionPolling(activeSession.id, () => {
              get().endCurrentSession(true)
            })
          } else {
            set({ screen: 'lock', isLocked: true })
            await window.api.lockScreen()
          }
          
          setupSubscriptions(device.id, deviceCode, set, get)
          
          // Start heartbeat - more frequently for better status tracking
          startHeartbeatInterval(device.id, 15000) // Every 15 seconds
          
          const commands = await getPendingCommands(device.id)
          for (const cmd of commands) {
            await get().processCommand(cmd)
          }
        } else {
          set({ screen: 'pending' })
          
          const channel = subscribeToDevice(deviceCode, async (updatedDevice) => {
            if (updatedDevice.branch_id) {
              set({ device: updatedDevice })
              
              await window.api.saveConfig({ 
                ...get().config, 
                isRegistered: true, 
                isApproved: true,
                deviceId: updatedDevice.id,
                branchId: updatedDevice.branch_id
              })
              
              get().cleanup()
              await get().initialize()
            }
          })
          
          set({ channels: [channel] })
        }
      } else {
        set({ screen: 'setup', isLocked: true })
      }
      
      set({ isInitialized: true })
      
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

  setDeviceName: async (name) => {
    const { config } = get()
    if (config) {
      await get().setConfig({ ...config, deviceName: name })
    }
  },

  registerPendingDevice: async () => {
    const { deviceCode, config, systemSpecs } = get()
    
    if (!deviceCode || !systemSpecs) return false
    
    const deviceName = config?.deviceName || `PC-${deviceCode.slice(0, 8)}`
    
    const device = await registerPendingDeviceApi(deviceCode, deviceName, systemSpecs)
    
    if (device) {
      set({ device, screen: 'pending' })
      
      const channel = subscribeToDevice(deviceCode, async (updatedDevice) => {
        if (updatedDevice.branch_id) {
          set({ device: updatedDevice })
          get().cleanup()
          await get().initialize()
        }
      })
      
      set({ channels: [channel] })
      
      return true
    }
    
    return false
  },

  lock: async () => {
    const { device } = get()
    
    // Stop all timers
    stopSessionTimeSync()
    stopSessionPolling()
    
    set({ 
      isLocked: true, 
      screen: 'lock',
      isAdminUnlocked: false,
      adminUnlockExpiresAt: null,
      adminUnlockedBy: null
    })
    
    await window.api.lockScreen()
    await window.api.hideFloatingTimer()
    
    if (device) {
      await updateDeviceStatus(device.id, 'online', true)
    }
  },

  unlock: async () => {
    const { device, session, timeRemaining, totalSecondsUsed } = get()
    
    set({ isLocked: false, screen: 'session' })
    
    await window.api.unlockScreen()
    
    // Show floating timer
    if (session) {
      const displayTime = session.session_type === 'guest' ? timeRemaining : totalSecondsUsed
      await window.api.updateFloatingTimer(displayTime, session.session_type)
      await window.api.showFloatingTimer()
      
      // START THE COUNTDOWN TIMER
      
      // Start session time sync
      startSessionTimeSync(session.id, () => ({
        timeRemaining: get().timeRemaining,
        totalSecondsUsed: get().totalSecondsUsed
      }), 5000)
    }
    
    if (device) {
      await updateDeviceStatus(device.id, 'in_use', false)
    }
  },

  adminUnlock: async (durationMinutes, unlockedBy) => {
    const { device } = get()
    
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
    
    if (device) {
      await updateDeviceStatus(device.id, 'in_use', false)
    }
    
    // Start expiry check if there's a duration
    if (expiresAt) {
      startAdminUnlockExpiryCheck(get)
    }
    
    get().showMessage(
      durationMinutes > 0 
        ? `Admin unlocked for ${durationMinutes} minutes by ${unlockedBy}`
        : `Admin unlocked (unlimited) by ${unlockedBy}`
    )
  },

  checkAdminUnlockExpiry: () => {
    const { isAdminUnlocked, adminUnlockExpiresAt } = get()
    
    if (isAdminUnlocked && adminUnlockExpiresAt && Date.now() >= adminUnlockExpiresAt) {
      get().showMessage('Admin unlock expired. Locking...')
      setTimeout(() => {
        get().lock()
      }, 2000)
    }
  },

  startGuestSession: (timeSeconds) => {
    set({
      session: {
        id: 'guest-local',
        device_id: get().device?.id || '',
        session_type: 'guest',
        status: 'active',
        time_remaining_seconds: timeSeconds,
        total_seconds_used: 0,
        total_amount: 0,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      timeRemaining: timeSeconds,
      totalSecondsUsed: 0,
      screen: 'session',
      isLocked: false
    })
  },

  handleMemberLogin: async (username, pin) => {
    const { device } = get()
    
    if (!device?.branches?.organizations) {
      get().setError('Device not properly configured')
      return false
    }
    
    const orgId = device.branches.organizations.id
    const member = await loginMember(orgId, username, pin)
    
    if (!member) {
      get().setError('Invalid username or PIN')
      return false
    }
    
    if (member.credits <= 0) {
      get().setError('Insufficient credits. Please top up.')
      return false
    }
    
    const session = await startMemberSession(device.id, member.id, device.rate_id!)
    
    if (!session) {
      get().setError('Failed to start session')
      return false
    }
    
    set({
      session,
      member,
      timeRemaining: 0,
      totalSecondsUsed: 0
    })
    
    await get().unlock()
    
    // Start session time sync
    startSessionTimeSync(session.id, () => ({
      timeRemaining: get().timeRemaining,
      totalSecondsUsed: get().totalSecondsUsed
    }), 5000)
    
    return true
  },

  endCurrentSession: async (terminatedByAdmin = false) => {
    const { session, device, totalSecondsUsed } = get()
    
    // Stop all timers
    stopSessionTimeSync()
    stopSessionPolling()
    
    // Hide floating timer
    await window.api.hideFloatingTimer()
    
    if (session && session.id !== 'guest-local') {
      // Final sync of session time before ending
      await updateSessionTime(session.id, 0, totalSecondsUsed)
      
      // End session in database
      await endSession(session.id, totalSecondsUsed, session.total_amount || 0)
    }
    
    // Update device status back to online (locked)
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
    // This function is now only called for manual triggers
    // The main timer is managed at the store module level
    const { session, timeRemaining, totalSecondsUsed } = get()
    
    if (!session || session.status !== 'active') return
    
    const newTimeRemaining = Math.max(0, timeRemaining - 1)
    const newTotalSeconds = totalSecondsUsed + 1
    
    set({
      timeRemaining: newTimeRemaining,
      totalSecondsUsed: newTotalSeconds
    })
    
    // Update floating timer window
    const displayTime = session.session_type === 'guest' ? newTimeRemaining : newTotalSeconds
    window.api.updateFloatingTimer(displayTime, session.session_type)
    
    // End session if time runs out (guest sessions)
    if (session.session_type === 'guest' && newTimeRemaining <= 0) {
      get().endCurrentSession()
    }
  },

  // Sync session time to database (called periodically)
  syncSessionTime: async () => {
    const { session, timeRemaining, totalSecondsUsed } = get()
    
    if (!session || session.id === 'guest-local') return
    
    await updateSessionTime(session.id, timeRemaining, totalSecondsUsed)
  },

  chargeCredits: async () => {
    const { session, member } = get()
    
    if (!session || !member || session.session_type !== 'member') {
      return true
    }
    
    const rate = session.rates
    if (!rate) return true
    
    const chargeAmount = (60 / rate.unit_minutes / 60) * rate.price_per_unit
    
    const result = await chargeMemberCredits(member.id, chargeAmount, session.id)
    
    if (!result.success) {
      get().showMessage('Insufficient credits. Session ending...')
      setTimeout(() => get().endCurrentSession(), 3000)
      return false
    }
    
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
          // Update device status to offline before shutdown
          const { device: shutdownDevice } = get()
          if (shutdownDevice) {
            await updateDeviceStatus(shutdownDevice.id, 'offline', true)
          }
          await window.api.executeCommand('shutdown')
          await markCommandExecuted(command.id, true)
          break
          
        case 'restart':
          showMessage('System will restart in 30 seconds...')
          const { device: restartDevice } = get()
          if (restartDevice) {
            await updateDeviceStatus(restartDevice.id, 'offline', true)
          }
          await window.api.executeCommand('restart')
          await markCommandExecuted(command.id, true)
          break
          
        case 'lock':
          await endCurrentSession(true)
          await lock()
          await markCommandExecuted(command.id, true)
          break
          
        case 'unlock':
          const payload = command.payload as any
          const sessionId = payload?.session_id
          const timeRemaining = payload?.time_remaining || 0
          const sessionType = payload?.session_type || 'guest'
          
          console.log('🔓 Processing unlock command:', { sessionId, timeRemaining, sessionType })
          console.log('🔓 Full payload:', JSON.stringify(payload))
          
          const { device: currentDevice } = get()
          if (currentDevice) {
            const activeSession = await getActiveSession(currentDevice.id)
            
            console.log('🔓 Active session from DB:', JSON.stringify(activeSession, null, 2))
            
            if (activeSession) {
              console.log('✅ Found active session:', activeSession.id)
              console.log('📋 Session details:', {
                id: activeSession.id,
                status: activeSession.status,
                session_type: activeSession.session_type,
                time_remaining_seconds: activeSession.time_remaining_seconds,
                total_seconds_used: activeSession.total_seconds_used
              })
              
              // Use time from session, fallback to command payload, fallback to 0
              const sessionTime = activeSession.time_remaining_seconds ?? timeRemaining ?? 0
              
              console.log('⏱️ Time sources:')
              console.log('  - activeSession.time_remaining_seconds:', activeSession.time_remaining_seconds)
              console.log('  - payload.time_remaining:', timeRemaining)
              console.log('  - Final sessionTime:', sessionTime)
              
              set({
                session: activeSession,
                member: activeSession.members || null,
                timeRemaining: sessionTime,
                totalSecondsUsed: activeSession.total_seconds_used || 0,
                screen: 'session',
                isLocked: false
              })
              
              // Verify state was set correctly
              const newState = get()
              console.log('✅ State after set:', {
                hasSession: !!newState.session,
                sessionStatus: newState.session?.status,
                timeRemaining: newState.timeRemaining,
                totalSecondsUsed: newState.totalSecondsUsed,
                screen: newState.screen
              })
              
              await window.api.unlockScreen()
              
              const displayTime = activeSession.session_type === 'guest' ? sessionTime : (activeSession.total_seconds_used || 0)
              await window.api.updateFloatingTimer(displayTime, activeSession.session_type)
              await window.api.showFloatingTimer()
              
              await updateDeviceStatus(currentDevice.id, 'in_use', false)
              
              // START THE COUNTDOWN TIMER
              
              // Start session time sync
              startSessionTimeSync(activeSession.id, () => ({
                timeRemaining: get().timeRemaining,
                totalSecondsUsed: get().totalSecondsUsed
              }), 5000)
              
              startSessionPolling(activeSession.id, () => {
                get().endCurrentSession(true)
              })
              
              showMessage(`Session started! ${activeSession.session_type === 'guest' ? 'Time remaining: ' + Math.floor(sessionTime / 60) + ' minutes' : ''}`)
            } else {
              console.log('⚠️ No active session found, but unlock command received')
            }
          }
          
          await markCommandExecuted(command.id, true)
          break
          
        case 'admin_unlock':
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
    const { channels, device } = get()
    
    // Stop all intervals including countdown timer
    stopSessionTimeSync()
    stopSessionPolling()
    stopCommandPolling()
    stopHeartbeatInterval()
    stopAdminUnlockExpiryCheck()
    
    // Unsubscribe from all channels
    channels.forEach((channel) => {
      unsubscribe(channel)
    })
    
    set({ channels: [] })
    
    // Mark device as offline on cleanup
    if (device) {
      updateDeviceStatus(device.id, 'offline', true)
    }
    
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
  
  const deviceChannel = subscribeToDevice(deviceCode, (device) => {
    set({ device })
    
    if (device.is_locked && !get().isLocked && !get().isAdminUnlocked) {
      get().lock()
    }
  })
  channels.push(deviceChannel)
  
  const sessionChannel = subscribeToSession(deviceId, async (session) => {
    console.log('Session subscription callback:', session?.status || 'null')
    
    if (session && session.status === 'active') {
      const currentSession = get().session
      
      if (!currentSession || currentSession.id !== session.id) {
        set({ 
          session,
          member: session.members || null,
          timeRemaining: session.time_remaining_seconds || 0,
          totalSecondsUsed: session.total_seconds_used || 0,
          screen: 'session'
        })
        await get().unlock()
        
        startSessionTimeSync(session.id, () => ({
          timeRemaining: get().timeRemaining,
          totalSecondsUsed: get().totalSecondsUsed
        }), 5000)
        
        startSessionPolling(session.id, () => {
          get().endCurrentSession(true)
        })
      }
    } else {
      const currentSession = get().session
      if (currentSession && currentSession.id !== 'guest-local') {
        console.log('Session ended via realtime, terminating locally')
        await get().endCurrentSession(true)
      }
    }
  })
  channels.push(sessionChannel)
  
  const commandChannel = subscribeToCommands(deviceId, (command) => {
    get().processCommand(command)
  })
  channels.push(commandChannel)
  
  set({ channels })
  
  startCommandPolling(deviceId, (command) => {
    get().processCommand(command)
  }, 3000)
}

let heartbeatInterval: NodeJS.Timeout | null = null

function startHeartbeatInterval(deviceId: string, intervalMs: number = 15000): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
  
  // Send initial heartbeat
  sendHeartbeat(deviceId)
  
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(deviceId)
  }, intervalMs)
}

function stopHeartbeatInterval(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
}

let adminUnlockExpiryInterval: NodeJS.Timeout | null = null

function startAdminUnlockExpiryCheck(get: () => AppStore): void {
  if (adminUnlockExpiryInterval) {
    clearInterval(adminUnlockExpiryInterval)
  }
  
  adminUnlockExpiryInterval = setInterval(() => {
    get().checkAdminUnlockExpiry()
  }, 10000)
}

function stopAdminUnlockExpiryCheck(): void {
  if (adminUnlockExpiryInterval) {
    clearInterval(adminUnlockExpiryInterval)
    adminUnlockExpiryInterval = null
  }
}

// Handle window/app closing - update device status
window.addEventListener('beforeunload', () => {
  const { device } = useAppStore.getState()
  if (device) {
    // Use sendBeacon for reliable delivery on page unload
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/devices?id=eq.${device.id}`
    const data = JSON.stringify({ status: 'offline', is_locked: true })
    
    navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }))
  }
})