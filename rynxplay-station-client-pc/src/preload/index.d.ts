import { ElectronAPI } from '@electron-toolkit/preload'

interface SystemSpecs {
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

interface Api {
  // Configuration
  getConfig: () => Promise<Record<string, unknown>>
  saveConfig: (config: Record<string, unknown>) => Promise<boolean>

  // Device code & QR
  getDeviceCode: () => Promise<string>
  generateQRCode: (data: string) => Promise<string>

  // System specs
  getSystemSpecs: () => Promise<SystemSpecs>

  // Lock/Unlock
  lockScreen: () => Promise<boolean>
  unlockScreen: () => Promise<boolean>
  getLockStatus: () => Promise<boolean>

  // Floating timer
  updateFloatingTimer: (time: number, sessionType: 'guest' | 'member') => Promise<boolean>
  showFloatingTimer: () => Promise<boolean>
  hideFloatingTimer: () => Promise<boolean>

  // System commands
  executeCommand: (command: string) => Promise<boolean>
  showMessage: (message: string) => Promise<boolean>
  quitApp: (killCode?: string) => Promise<boolean>

  // System info (legacy)
  getSystemInfo: () => Promise<{
    platform: string
    hostname: string
    arch: string
    version: string
  }>

  // Event listeners
  onDisplayMessage: (callback: (message: string) => void) => void
  removeDisplayMessageListener: () => void
  onTimerUpdate: (callback: (data: { time: number, sessionType: string }) => void) => void
  onTimerEnded: (callback: () => void) => void
  removeTimerEndedListener: () => void
  stopFloatingTimer: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}