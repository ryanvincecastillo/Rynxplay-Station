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

interface API {
  getConfig: () => Promise<Record<string, unknown>>
  saveConfig: (config: Record<string, unknown>) => Promise<boolean>
  getDeviceCode: () => Promise<string>
  generateQRCode: (data: string) => Promise<string>
  getSystemSpecs: () => Promise<SystemSpecs>
  lockScreen: () => Promise<boolean>
  unlockScreen: () => Promise<boolean>
  getLockStatus: () => Promise<boolean>
  executeCommand: (command: string) => Promise<boolean>
  showMessage: (message: string) => Promise<boolean>
  quitApp: () => Promise<boolean>
  getSystemInfo: () => Promise<{
    platform: string
    hostname: string
    arch: string
    version: string
  }>
  onDisplayMessage: (callback: (message: string) => void) => void
  removeDisplayMessageListener: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
