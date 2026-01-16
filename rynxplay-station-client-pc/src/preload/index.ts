import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// System specs type
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

// Custom APIs for renderer
const api = {
  // Configuration
  getConfig: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('get-config'),
  saveConfig: (config: Record<string, unknown>): Promise<boolean> => 
    ipcRenderer.invoke('save-config', config),

  // Device code & QR
  getDeviceCode: (): Promise<string> => ipcRenderer.invoke('get-device-code'),
  generateQRCode: (data: string): Promise<string> => ipcRenderer.invoke('generate-qr-code', data),

  // System specs
  getSystemSpecs: (): Promise<SystemSpecs> => ipcRenderer.invoke('get-system-specs'),

  // Lock/Unlock
  lockScreen: (): Promise<boolean> => ipcRenderer.invoke('lock-screen'),
  unlockScreen: (): Promise<boolean> => ipcRenderer.invoke('unlock-screen'),
  getLockStatus: (): Promise<boolean> => ipcRenderer.invoke('get-lock-status'),

  // System commands
  executeCommand: (command: string): Promise<boolean> => 
    ipcRenderer.invoke('execute-command', command),
  showMessage: (message: string): Promise<boolean> => 
    ipcRenderer.invoke('show-message', message),
  quitApp: (): Promise<boolean> => ipcRenderer.invoke('quit-app'),

  // System info (legacy)
  getSystemInfo: (): Promise<{
    platform: string
    hostname: string
    arch: string
    version: string
  }> => ipcRenderer.invoke('get-system-info'),

  // Event listeners
  onDisplayMessage: (callback: (message: string) => void): void => {
    ipcRenderer.on('display-message', (_event, message) => callback(message))
  },

  removeDisplayMessageListener: (): void => {
    ipcRenderer.removeAllListeners('display-message')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
