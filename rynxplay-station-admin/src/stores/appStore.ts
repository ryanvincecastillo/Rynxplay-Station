import { create } from 'zustand'
import type { 
  AuthUser, 
  StaffUser, 
  Organization, 
  Branch, 
  Device, 
  Member, 
  Session, 
  Rate, 
  Transaction,
  DashboardStats,
  Toast,
  ToastType
} from '@/types'
import {
  initSupabase,
  getSupabase,
  getCurrentUser,
  getStaffUser,
  getOrganization,
  getBranches,
  getDevices,
  getPendingDevices,
  getMembers,
  getSessions,
  getActiveSessions,
  getAllRates,
  getTransactions,
  getDashboardStats,
  subscribeToDevices,
  subscribeToSessions,
  unsubscribe,
  signOut as supabaseSignOut,
  startDeviceStatusPolling,
  stopDeviceStatusPolling,
  startActiveSessionsPolling,
  stopActiveSessionsPolling,
  getEffectiveDeviceStatus
} from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { generateId } from '@/lib/utils'

interface AppStore {
  // Auth state
  user: AuthUser | null
  staff: StaffUser | null
  organization: Organization | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Data state
  branches: Branch[]
  devices: Device[]
  pendingDevices: Device[]
  members: Member[]
  sessions: Session[]
  activeSessions: Session[]
  rates: Rate[]
  transactions: Transaction[]
  stats: DashboardStats | null
  
  // UI state
  sidebarOpen: boolean
  currentBranch: Branch | null
  toasts: Toast[]
  
  // Realtime channels
  channels: RealtimeChannel[]
  
  // Actions
  initialize: () => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  
  // Data fetching
  fetchBranches: () => Promise<void>
  fetchDevices: () => Promise<void>
  fetchPendingDevices: () => Promise<void>
  fetchMembers: () => Promise<void>
  fetchSessions: () => Promise<void>
  fetchActiveSessions: () => Promise<void>
  fetchRates: () => Promise<void>
  fetchTransactions: () => Promise<void>
  fetchStats: () => Promise<void>
  refreshAll: () => Promise<void>
  
  // UI actions
  toggleSidebar: () => void
  setCurrentBranch: (branch: Branch | null) => void
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
  
  // Realtime
  setupRealtimeSubscriptions: () => void
  cleanup: () => void
  
  // Device helpers
  getDeviceEffectiveStatus: (device: Device) => Device['status']
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  user: null,
  staff: null,
  organization: null,
  isAuthenticated: false,
  isLoading: true,
  
  branches: [],
  devices: [],
  pendingDevices: [],
  members: [],
  sessions: [],
  activeSessions: [],
  rates: [],
  transactions: [],
  stats: null,
  
  sidebarOpen: true,
  currentBranch: null,
  toasts: [],
  channels: [],
  
  initialize: async () => {
    set({ isLoading: true })
    
    try {
      initSupabase()
      const { data: { user } } = await getCurrentUser()
      
      if (user) {
        const staff = await getStaffUser(user.id)
        
        if (staff) {
          const organization = await getOrganization(staff.org_id)
          
          set({
            user: { id: user.id, email: user.email || '', staff },
            staff,
            organization,
            isAuthenticated: true
          })
          
          // Load initial data
          await get().refreshAll()
          
          // Setup realtime subscriptions
          get().setupRealtimeSubscriptions()
        } else {
          set({ isAuthenticated: false })
        }
      } else {
        set({ isAuthenticated: false })
      }
    } catch (error) {
      console.error('Initialization error:', error)
      set({ isAuthenticated: false })
    }
    
    set({ isLoading: false })
  },
  
  signOut: async () => {
    get().cleanup()
    await supabaseSignOut()
    set({
      user: null,
      staff: null,
      organization: null,
      isAuthenticated: false,
      branches: [],
      devices: [],
      pendingDevices: [],
      members: [],
      sessions: [],
      activeSessions: [],
      rates: [],
      transactions: [],
      stats: null
    })
  },
  
  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
  },
  
  fetchBranches: async () => {
    const { organization } = get()
    if (!organization) return
    
    const branches = await getBranches(organization.id)
    set({ branches })
  },
  
  fetchDevices: async () => {
    const { organization } = get()
    if (!organization) return
    
    const devices = await getDevices(organization.id)
    set({ devices })
  },
  
  fetchPendingDevices: async () => {
    const pendingDevices = await getPendingDevices()
    set({ pendingDevices })
  },
  
  fetchMembers: async () => {
    const { organization } = get()
    if (!organization) return
    
    const members = await getMembers(organization.id)
    set({ members })
  },
  
  fetchSessions: async () => {
    const { organization } = get()
    if (!organization) return
    
    const sessions = await getSessions(organization.id)
    set({ sessions })
  },
  
  fetchActiveSessions: async () => {
    const { organization } = get()
    if (!organization) return
    
    const activeSessions = await getActiveSessions(organization.id)
    set({ activeSessions })
  },
  
  fetchRates: async () => {
    const { organization } = get()
    if (!organization) return
    
    const rates = await getAllRates(organization.id)
    set({ rates })
  },
  
  fetchTransactions: async () => {
    const { organization } = get()
    if (!organization) return
    
    const transactions = await getTransactions(organization.id)
    set({ transactions })
  },
  
  fetchStats: async () => {
    const { organization } = get()
    if (!organization) return
    
    const stats = await getDashboardStats(organization.id)
    set({ stats })
  },
  
  refreshAll: async () => {
    await Promise.all([
      get().fetchBranches(),
      get().fetchDevices(),
      get().fetchPendingDevices(),
      get().fetchMembers(),
      get().fetchSessions(),
      get().fetchActiveSessions(),
      get().fetchRates(),
      get().fetchStats()
    ])
  },
  
  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }))
  },
  
  setCurrentBranch: (branch) => {
    set({ currentBranch: branch })
  },
  
  addToast: (type, message, duration = 5000) => {
    const id = generateId()
    const toast: Toast = { id, type, message, duration }
    
    set(state => ({ toasts: [...state.toasts, toast] }))
    
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },
  
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },
  
  setupRealtimeSubscriptions: () => {
    const { organization } = get()
    if (!organization) return
    
    const channels: RealtimeChannel[] = []
    
    // Subscribe to device changes (realtime)
    const deviceChannel = subscribeToDevices((payload) => {
      console.log('Device change:', payload.eventType)
      // Fetch fresh data on any change
      get().fetchDevices()
      get().fetchPendingDevices()
      get().fetchStats()
    })
    channels.push(deviceChannel)
    
    // Subscribe to session changes (realtime)
    const sessionChannel = subscribeToSessions((payload) => {
      console.log('Session change:', payload.eventType, payload.new?.status)
      // Fetch fresh data on any change
      get().fetchSessions()
      get().fetchActiveSessions()
      get().fetchStats()
      get().fetchDevices() // Device status may change with session
    })
    channels.push(sessionChannel)
    
    set({ channels })
    
    // Start polling for device status (heartbeat checks) - every 10 seconds
    startDeviceStatusPolling(organization.id, (devices) => {
      set({ devices })
    }, 10000)
    
    // Start polling for active sessions (timer updates) - every 5 seconds
    startActiveSessionsPolling(organization.id, (activeSessions) => {
      set({ activeSessions })
    }, 5000)
  },
  
  cleanup: () => {
    const { channels } = get()
    
    // Unsubscribe from all channels
    channels.forEach(channel => unsubscribe(channel))
    
    // Stop polling
    stopDeviceStatusPolling()
    stopActiveSessionsPolling()
    
    set({ channels: [] })
  },
  
  // Helper to get effective device status based on heartbeat
  getDeviceEffectiveStatus: (device) => {
    return getEffectiveDeviceStatus(device)
  }
}))