import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { exec, spawn } from 'child_process'
import * as si from 'systeminformation'
import * as QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import * as os from 'os'
import * as readline from 'readline'

// ============================================
// ADMIN KILL CODE - Change this to your secret
// ============================================
const ADMIN_KILL_CODE = 'RYNX-ADMIN-EXIT-2024'

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
let floatingWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isLocked = true
let isQuitting = false
let isAuthorizedExit = false // Track if exit was authorized with kill code
let floatingTimerVisible = true

// Session state for floating timer
let currentSessionTime = 0
let currentSessionType: 'guest' | 'member' | null = null

// ============================================
// PROCESS PROTECTION
// ============================================

// Check for kill code in command line arguments
function checkCommandLineKillCode(): boolean {
  const args = process.argv.slice(2)
  return args.includes(`--kill-code=${ADMIN_KILL_CODE}`)
}

// Setup console input listener for kill code
function setupConsoleKillCode(): void {
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log('🔐 RYNXPLAY Client running. Enter admin kill code to exit safely.')
    
    rl.on('line', (input) => {
      if (input.trim() === ADMIN_KILL_CODE) {
        console.log('✅ Kill code accepted. Exiting safely...')
        isAuthorizedExit = true
        isQuitting = true
        app.quit()
      } else if (input.trim().length > 0) {
        console.log('❌ Invalid kill code.')
      }
    })
  }
}

// Reboot system (called when process is terminated without authorization)
function rebootSystem(): void {
  console.log('⚠️ Unauthorized termination detected! Rebooting system...')
  
  if (process.platform === 'win32') {
    exec('shutdown /r /t 5 /c "RYNXPLAY: Security reboot - unauthorized termination detected"')
  } else {
    exec('shutdown -r +1 "RYNXPLAY: Security reboot"')
  }
}

// ============================================
// WINDOWS KEY BLOCKING
// ============================================

function registerKeyboardBlocks(): void {
  // Block common Windows key combinations when locked
  const blockedShortcuts = [
    'Super',           // Windows key alone
    'Super+D',         // Show desktop
    'Super+E',         // File explorer
    'Super+R',         // Run dialog
    'Super+Tab',       // Task view
    'Super+L',         // Lock screen (Windows lock, not ours)
    'Super+A',         // Action center
    'Super+S',         // Search
    'Super+I',         // Settings
    'Super+X',         // Quick link menu
    'Super+M',         // Minimize all
    'Super+Shift+M',   // Restore minimized
    'Alt+Tab',         // Task switcher
    'Alt+F4',          // Close window
    'Alt+Escape',      // Cycle windows
    'Ctrl+Escape',     // Start menu
    'Ctrl+Shift+Escape', // Task manager
    'Ctrl+Alt+Delete', // Security options (can't fully block this)
  ]

  blockedShortcuts.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        // Do nothing - just capture and ignore
        console.log(`Blocked shortcut: ${shortcut}`)
      })
    } catch (e) {
      // Some shortcuts may not be registerable
      console.log(`Could not register shortcut: ${shortcut}`)
    }
  })

  console.log('🔒 Keyboard blocks registered')
}

function unregisterKeyboardBlocks(): void {
  globalShortcut.unregisterAll()
  console.log('🔓 Keyboard blocks unregistered')
}

// ============================================
// MAIN WINDOW (Lock Screen)
// ============================================

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
      registerKeyboardBlocks()
    }
  })

  // Prevent closing when locked
  mainWindow.on('close', (event) => {
    if (isLocked && !isQuitting) {
      event.preventDefault()
    }
  })

  // Prevent minimize
  mainWindow.on('minimize', (event) => {
    if (isLocked) {
      event.preventDefault()
      mainWindow?.restore()
      mainWindow?.focus()
    }
  })

  // Prevent losing focus when locked
  mainWindow.on('blur', () => {
    if (isLocked && mainWindow) {
      setTimeout(() => {
        mainWindow?.focus()
      }, 100)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Add keyboard shortcut to open DevTools (Ctrl+Shift+D)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'd') {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
    // Also allow F12 for DevTools
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ============================================
// FLOATING TIMER WINDOW
// ============================================

function createFloatingWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  floatingWindow = new BrowserWindow({
    width: 280,
    height: 100,
    x: screenWidth - 300,
    y: 20,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Load the floating timer HTML
  const floatingHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', system-ui, sans-serif;
          background: transparent;
          -webkit-app-region: drag;
          user-select: none;
        }
        .container {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 1px solid rgba(0, 212, 245, 0.3);
          border-radius: 16px;
          padding: 16px 20px;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .title {
          font-size: 11px;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.8);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .session-type {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(0, 212, 245, 0.2);
          color: #00d4f5;
        }
        .timer {
          font-size: 32px;
          font-weight: 700;
          font-family: 'Consolas', 'Monaco', monospace;
          color: #00d4f5;
          text-shadow: 0 0 20px rgba(0, 212, 245, 0.5);
          text-align: center;
        }
        .timer.warning { color: #f59e0b; text-shadow: 0 0 20px rgba(245, 158, 11, 0.5); }
        .timer.danger { color: #ef4444; text-shadow: 0 0 20px rgba(239, 68, 68, 0.5); animation: pulse 1s infinite; }
        .buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          -webkit-app-region: no-drag;
        }
        .btn {
          flex: 1;
          padding: 6px;
          border: none;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-hide {
          background: rgba(100, 116, 139, 0.3);
          color: #94a3b8;
        }
        .btn-hide:hover { background: rgba(100, 116, 139, 0.5); }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="title">RYNXPLAY</span>
          <span class="session-type" id="sessionType">GUEST</span>
        </div>
        <div class="timer" id="timer">00:00:00</div>
        <div class="buttons">
          <button class="btn btn-hide" onclick="hideTimer()">Hide</button>
        </div>
      </div>
      <script>
        const { ipcRenderer } = require('electron');
        
        function formatTime(seconds) {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = seconds % 60;
          return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
        }
        
        function hideTimer() {
          ipcRenderer.send('hide-floating-timer');
        }
        
        ipcRenderer.on('update-timer', (event, { time, sessionType }) => {
          const timerEl = document.getElementById('timer');
          const typeEl = document.getElementById('sessionType');
          
          timerEl.textContent = formatTime(time);
          typeEl.textContent = sessionType === 'member' ? 'MEMBER' : 'GUEST';
          
          // Color based on remaining time (for guest sessions)
          if (sessionType === 'guest') {
            timerEl.className = 'timer';
            if (time <= 60) timerEl.classList.add('danger');
            else if (time <= 300) timerEl.classList.add('warning');
          }
        });
      </script>
    </body>
    </html>
  `

  floatingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(floatingHTML)}`)

  floatingWindow.on('close', (event) => {
    event.preventDefault()
    floatingWindow?.hide()
    floatingTimerVisible = false
  })
}

function showFloatingTimer(): void {
  if (floatingWindow && !isLocked) {
    floatingWindow.show()
    floatingTimerVisible = true
  }
}

function hideFloatingTimer(): void {
  if (floatingWindow) {
    floatingWindow.hide()
    floatingTimerVisible = false
  }
}

function updateFloatingTimer(time: number, sessionType: 'guest' | 'member'): void {
  currentSessionTime = time
  currentSessionType = sessionType
  
  if (floatingWindow && !isLocked) {
    floatingWindow.webContents.send('update-timer', { time, sessionType })
  }
}

// ============================================
// SYSTEM TRAY
// ============================================

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABzElEQVR4nO2WzU7CQBSFP8RH0LhwYeKGR/ERXKhLN8YYF7hwYeLC+A5GXPgAJsYY3ZlYEvlRERdNXLhQo3FhwkKDwIAwBUopZQqoVWKS5iQ9nXtn7r13CoGAgICA/xKACzwCr8ArMA0MT0k8V3glBj4F8TzOE+ANeBc5j7K3e/FrAyxJGwWuiPoW5AMgAiyLiMKIvwlMA8MKYtYVGJZGwGdF3TfCYyE+A9jSAvpQVy2fQ8aJAueATynOA9OqQ+iBWFJgAjgQOSn6RhC+SWo5lMSsK7AlCGmL36g8hFMYEAYk+gT9DW0VElqMAvnCT0p8CkJ8VGBCqFQREsF3wj7wKD0bk+QWJHEi6nNFTwVfwqRk8pIAK8CeyO9Q1oDvFX0VfFf0FsibwFb0VRJeFWARaK6nQhPSZ0VvBd8VvRV8VfRV8F3RW8FHRV8F4RV9F0S7it4Kwh/9KvquCK8KelRU9F3RW0FoRd8VoU2+FX1XhFf0XRFeEegKelRU9F3RV0G4gu+KUFd4RVBS0XdFH36voq+CsIr+K0JdQY+Kir4r+igIt+i7IrSij4JwixCniH8UhFoKO1WQ6xV9FIRaBPxaUfBJjYqBgP8PX6eJrO3oJ7CKAAAAAElFTkSuQmCC'
  )
  
  tray = new Tray(icon)
  tray.setToolTip('RYNXPLAY STATION Client')
  
  // Double-click to show window
  tray.on('double-click', () => {
    if (isLocked) {
      mainWindow?.show()
      mainWindow?.focus()
    } else {
      // Toggle floating timer visibility
      if (floatingTimerVisible) {
        hideFloatingTimer()
      } else {
        showFloatingTimer()
      }
    }
  })
  
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
      label: `Status: ${config.isApproved ? (isLocked ? 'Locked' : 'Active Session') : 'Pending Approval'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: isLocked ? 'Show Lock Screen' : 'Show Timer',
      click: () => {
        if (isLocked) {
          mainWindow?.show()
          mainWindow?.focus()
        } else {
          showFloatingTimer()
        }
      }
    },
    {
      label: 'Hide Timer',
      enabled: !isLocked && floatingTimerVisible,
      click: () => {
        hideFloatingTimer()
      }
    },
    { type: 'separator' },
    {
      label: 'Exit (Requires Kill Code)',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'Admin Exit',
          message: 'To exit safely, run the app with:\n\n--kill-code=YOUR_ADMIN_CODE\n\nor enter the kill code in the console.',
          buttons: ['OK']
        })
      }
    }
  ])
  
  tray?.setContextMenu(contextMenu)
}

// ============================================
// SYSTEM SPECS & UTILITIES
// ============================================

// Generate or retrieve unique device code
function getOrCreateDeviceCode(): string {
  let deviceCode = store.get('deviceCode') as string | null
  
  if (!deviceCode) {
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

    const totalDisk = diskLayout.reduce((acc, disk) => acc + disk.size, 0)
    const usedDisk = diskLayout.reduce((acc, disk) => acc + disk.used, 0)
    const freeDisk = totalDisk - usedDisk

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

// ============================================
// IPC HANDLERS
// ============================================

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
    
    // Register keyboard blocks
    registerKeyboardBlocks()
    
    // Hide floating timer
    hideFloatingTimer()
    
    // Show and configure main window for lock mode
    mainWindow?.setAlwaysOnTop(true, 'screen-saver')
    mainWindow?.setKiosk(true)
    mainWindow?.setSkipTaskbar(true)
    mainWindow?.setFullScreen(true)
    mainWindow?.show()
    mainWindow?.focus()
    
    updateTrayMenu()
    return true
  })

  // Unlock the screen
  ipcMain.handle('unlock-screen', () => {
    isLocked = false
    
    // Unregister keyboard blocks
    unregisterKeyboardBlocks()
    
    // Hide main window
    mainWindow?.setAlwaysOnTop(false)
    mainWindow?.setKiosk(false)
    mainWindow?.setSkipTaskbar(false)
    mainWindow?.setFullScreen(false)
    mainWindow?.hide()
    
    // Show floating timer
    showFloatingTimer()
    
    updateTrayMenu()
    return true
  })

  // Get lock status
  ipcMain.handle('get-lock-status', () => {
    return isLocked
  })

  // Update floating timer
  ipcMain.handle('update-floating-timer', (_event, time: number, sessionType: 'guest' | 'member') => {
    updateFloatingTimer(time, sessionType)
    return true
  })

  // Show floating timer
  ipcMain.handle('show-floating-timer', () => {
    showFloatingTimer()
    return true
  })

  // Hide floating timer
  ipcMain.handle('hide-floating-timer', () => {
    hideFloatingTimer()
    return true
  })

  // Listen for hide request from floating timer window
  ipcMain.on('hide-floating-timer', () => {
    hideFloatingTimer()
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

  // Quit application (with kill code verification)
  ipcMain.handle('quit-app', (_event, killCode?: string) => {
    if (killCode === ADMIN_KILL_CODE) {
      isAuthorizedExit = true
      isQuitting = true
      app.quit()
      return true
    }
    return false
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

// ============================================
// APP LIFECYCLE
// ============================================

// Check for kill code on startup
if (checkCommandLineKillCode()) {
  console.log('✅ Kill code provided via command line. Safe exit enabled.')
  isAuthorizedExit = true
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (isLocked) {
        mainWindow.show()
        mainWindow.focus()
      } else if (floatingWindow) {
        showFloatingTimer()
      }
    }
  })

  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.rynxplay.station.client')

    // Setup console kill code listener
    setupConsoleKillCode()

    // Watch for shortcuts in development
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    setupIpcHandlers()
    createWindow()
    createFloatingWindow()
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        createFloatingWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (!isAuthorizedExit && isLocked) {
        // Unauthorized close while locked - REBOOT
        rebootSystem()
      }
      app.quit()
    }
  })

  // Handle app quit
  app.on('before-quit', (event) => {
    if (isLocked && !isQuitting) {
      event.preventDefault()
      return
    }
    
    // If not authorized exit and we're locked, trigger reboot
    if (!isAuthorizedExit && isLocked) {
      event.preventDefault()
      rebootSystem()
    }
  })

  app.on('will-quit', () => {
    // Unregister all shortcuts on quit
    globalShortcut.unregisterAll()
  })
}