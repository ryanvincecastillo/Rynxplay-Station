import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { exec } from 'child_process'
import * as si from 'systeminformation'
import * as QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'

// Types for system specs
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

// Persistent storage for device configuration
const store = new Store({
  name: 'rynxplay-config',
  defaults: {
    deviceId: null,
    deviceCode: null,
    deviceName: '',
    branchId: null,
    isRegistered: false,
    isApproved: false
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isLocked = true
let isQuitting = false

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (isLocked) {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })

  // Prevent closing when locked
  mainWindow.on('close', (event) => {
    if (isLocked && !isQuitting) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABzElEQVR4nO2WzU7CQBSFP8RH0LhwYeKGR/ERXKhLN8YYF7hwYeLC+A5GXPgAJsYY3ZlYEvlRERdNXLhQo3FhwkKDwIAwBUopZQqoVWKS5iQ9nXtn7r13CoGAgICA/xKACzwCr8ArMA0MT0k8V3glBj4F8TzOE+ANeBc5j7K3e/FrAyxJGwWuiPoW5AMgAiyLiMKIvwlMA8MKYtYVGJZGwGdF3TfCYyE+A9jSAvpQVy2fQ8aJAueATynOA9OqQ+iBWFJgAjgQOSn6RhC+SWo5lMSsK7AlCGmL36g8hFMYEAYk+gT9DW0VElqMAvnCT0p8CkJ8VGBCqFQREsF3wj7wKD0bk+QWJHEi6nNFTwVfwqRk8pIAK8CeyO9Q1oDvFX0VfFf0FsibwFb0VRJeFWARaK6nQhPSZ0VvBd8VvRV8VfRV8F3RW8FHRV8F4RV9F0S7it4Kwh/9KvquCK8KelRU9F3RW0FoRd8VoU2+FX1XhFf0XRFeEegKelRU9F3RV0G4gu+KUFd4RVBS0XdFH36voq+CsIr+K0JdQY+Kir4r+igIt+i7IrSij4JwixCniH8UhFoKO1WQ6xV9FIRaBPxaUfBJjYqBgP8PX6eJrO3oJ7CKAAAAAElFTkSuQmCC'
  )
  
  tray = new Tray(icon)
  tray.setToolTip('RYNXPLAY STATION Client')
  
  updateTrayMenu()
}

function updateTrayMenu(): void {
  const config = getConfig()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `RYNXPLAY STATION Client`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: `Device: ${config.deviceCode || 'Not Registered'}`,
      enabled: false
    },
    {
      label: `Status: ${config.isApproved ? (isLocked ? 'Locked' : 'Active') : 'Pending Approval'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Exit (Admin Only)',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray?.setContextMenu(contextMenu)
}

// Generate or retrieve unique device code
function getOrCreateDeviceCode(): string {
  let deviceCode = store.get('deviceCode') as string | null
  
  if (!deviceCode) {
    // Generate a unique code: RYNX-XXXXXXXX (8 char hex based on UUID)
    const uuid = uuidv4()
    deviceCode = `RYNX-${uuid.split('-')[0].toUpperCase()}`
    store.set('deviceCode', deviceCode)
  }
  
  return deviceCode
}

// Get comprehensive system specifications
async function getSystemSpecs(): Promise<SystemSpecs> {
  try {
    const [cpu, mem, graphics, diskLayout, osInfo, networkInterfaces] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics(),
      si.fsSize(),
      si.osInfo(),
      si.networkInterfaces()
    ])

    // Calculate total disk space
    const totalDisk = diskLayout.reduce((acc, disk) => acc + disk.size, 0)
    const usedDisk = diskLayout.reduce((acc, disk) => acc + disk.used, 0)
    const freeDisk = totalDisk - usedDisk

    // Get primary network interface
    const primaryNetwork = Array.isArray(networkInterfaces) 
      ? networkInterfaces.find(n => !n.internal && n.mac !== '00:00:00:00:00:00') || networkInterfaces[0]
      : networkInterfaces

    return {
      cpu: {
        brand: cpu.brand,
        manufacturer: cpu.manufacturer,
        speed: cpu.speed,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores
      },
      memory: {
        total: mem.total,
        free: mem.free,
        used: mem.used
      },
      graphics: {
        controllers: graphics.controllers.map(g => ({
          model: g.model,
          vendor: g.vendor,
          vram: g.vram || 0
        }))
      },
      disk: {
        total: totalDisk,
        used: usedDisk,
        free: freeDisk
      },
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        hostname: os.hostname()
      },
      network: {
        mac: primaryNetwork?.mac || 'Unknown',
        ip: primaryNetwork?.ip4 || 'Unknown'
      }
    }
  } catch (error) {
    console.error('Error getting system specs:', error)
    // Return basic info if detailed fetch fails
    return {
      cpu: {
        brand: 'Unknown',
        manufacturer: 'Unknown',
        speed: 0,
        cores: os.cpus().length,
        physicalCores: os.cpus().length
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      graphics: {
        controllers: [{ model: 'Unknown', vendor: 'Unknown', vram: 0 }]
      },
      disk: {
        total: 0,
        used: 0,
        free: 0
      },
      os: {
        platform: os.platform(),
        distro: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname()
      },
      network: {
        mac: 'Unknown',
        ip: 'Unknown'
      }
    }
  }
}

// Generate QR code as data URL
async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  } catch (error) {
    console.error('Error generating QR code:', error)
    return ''
  }
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Get stored configuration
  ipcMain.handle('get-config', () => {
    return getConfig()
  })

  // Save configuration
  ipcMain.handle('save-config', (_event, config: Record<string, unknown>) => {
    Object.entries(config).forEach(([key, value]) => {
      store.set(key, value)
    })
    updateTrayMenu()
    return true
  })

  // Get or create device code
  ipcMain.handle('get-device-code', () => {
    return getOrCreateDeviceCode()
  })

  // Get system specifications
  ipcMain.handle('get-system-specs', async () => {
    return await getSystemSpecs()
  })

  // Generate QR code
  ipcMain.handle('generate-qr-code', async (_event, data: string) => {
    return await generateQRCode(data)
  })

  // Lock the screen
  ipcMain.handle('lock-screen', () => {
    isLocked = true
    mainWindow?.setAlwaysOnTop(true)
    mainWindow?.setKiosk(true)
    mainWindow?.setSkipTaskbar(true)
    mainWindow?.show()
    mainWindow?.focus()
    updateTrayMenu()
    return true
  })

  // Unlock the screen
  ipcMain.handle('unlock-screen', () => {
    isLocked = false
    mainWindow?.setAlwaysOnTop(false)
    mainWindow?.setKiosk(false)
    mainWindow?.setSkipTaskbar(false)
    mainWindow?.hide()
    updateTrayMenu()
    return true
  })

  // Get lock status
  ipcMain.handle('get-lock-status', () => {
    return isLocked
  })

  // Execute system commands
  ipcMain.handle('execute-command', (_event, command: string) => {
    return new Promise((resolve, reject) => {
      switch (command) {
        case 'shutdown':
          if (process.platform === 'win32') {
            exec('shutdown /s /t 30 /c "RYNXPLAY: Session ended, shutting down..."', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          } else {
            exec('shutdown -h +1', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          }
          break
        case 'restart':
          if (process.platform === 'win32') {
            exec('shutdown /r /t 30 /c "RYNXPLAY: Restarting..."', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          } else {
            exec('shutdown -r +1', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          }
          break
        case 'cancel-shutdown':
          if (process.platform === 'win32') {
            exec('shutdown /a', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          } else {
            exec('shutdown -c', (error) => {
              if (error) reject(error)
              else resolve(true)
            })
          }
          break
        default:
          reject(new Error(`Unknown command: ${command}`))
      }
    })
  })

  // Show notification/message
  ipcMain.handle('show-message', (_event, message: string) => {
    mainWindow?.webContents.send('display-message', message)
    return true
  })

  // Quit application (admin only)
  ipcMain.handle('quit-app', () => {
    isQuitting = true
    app.quit()
    return true
  })

  // Get basic system info (legacy support)
  ipcMain.handle('get-system-info', () => {
    return {
      platform: process.platform,
      hostname: os.hostname(),
      arch: process.arch,
      version: app.getVersion()
    }
  })
}

function getConfig(): Record<string, unknown> {
  return {
    deviceId: store.get('deviceId'),
    deviceCode: store.get('deviceCode'),
    deviceName: store.get('deviceName'),
    branchId: store.get('branchId'),
    isRegistered: store.get('isRegistered'),
    isApproved: store.get('isApproved')
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.rynxplay.station.client')

    // Watch for shortcuts in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    createWindow()
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // Prevent app from closing completely
  app.on('before-quit', (event) => {
    if (isLocked && !isQuitting) {
      event.preventDefault()
    }
  })
}
