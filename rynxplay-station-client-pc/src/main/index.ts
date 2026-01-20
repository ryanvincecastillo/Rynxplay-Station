import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { exec } from 'child_process'
import * as fs from 'fs'
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
let isAuthorizedExit = false
let floatingTimerVisible = true

// Session state for floating timer
let currentSessionTime = 0
let currentSessionType: 'guest' | 'member' | null = null

// ============================================
// WINDOWS SYSTEM LOCKDOWN
// ============================================

// Disable Windows key via registry (using reg.exe - more reliable)
function disableWindowsKeyViaRegistry(): void {
  if (process.platform !== 'win32') return

  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /t REG_DWORD /d 1 /f', (error) => {
    if (error) {
      console.error('Failed to disable Windows key:', error.message)
    } else {
      console.log('✅ Windows key disabled via registry')
    }
  })
}

function enableWindowsKeyViaRegistry(): void {
  if (process.platform !== 'win32') return

  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoWinKeys /f', (error) => {
    if (!error) console.log('✅ Windows key enabled via registry')
  })
}

// Disable Task Manager via registry
function disableTaskManager(): void {
  if (process.platform !== 'win32') return

  exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f', (error) => {
    if (!error) console.log('✅ Task Manager disabled')
  })
}

function enableTaskManager(): void {
  if (process.platform !== 'win32') return

  exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /f', (error) => {
    if (!error) console.log('✅ Task Manager enabled')
  })
}

// Hide/Show Taskbar using Windows API
let hideTaskbarScriptPath: string | null = null

function hideTaskbar(): void {
  if (process.platform !== 'win32') return

  // Create script file once
  if (!hideTaskbarScriptPath) {
    hideTaskbarScriptPath = join(app.getPath('temp'), 'rynx_hide_taskbar.ps1')
    const scriptContent = `
Add-Type -Name Win32 -Namespace Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
[DllImport("user32.dll")] public static extern int ShowWindow(IntPtr hwnd, int nCmdShow);
'@
$taskbar = [Native.Win32]::FindWindow("Shell_TrayWnd", $null)
[Native.Win32]::ShowWindow($taskbar, 0)
`
    fs.writeFileSync(hideTaskbarScriptPath, scriptContent)
  }
  
  exec(`powershell -ExecutionPolicy Bypass -File "${hideTaskbarScriptPath}"`, () => {})
}

function showTaskbar(): void {
  if (process.platform !== 'win32') return

  const tempScript = join(app.getPath('temp'), 'rynx_show_taskbar.ps1')
  const scriptContent = `
Add-Type -Name Win32 -Namespace Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
[DllImport("user32.dll")] public static extern int ShowWindow(IntPtr hwnd, int nCmdShow);
'@
$taskbar = [Native.Win32]::FindWindow("Shell_TrayWnd", $null)
[Native.Win32]::ShowWindow($taskbar, 5)
`
  
  fs.writeFileSync(tempScript, scriptContent)
  exec(`powershell -ExecutionPolicy Bypass -File "${tempScript}"`, (error) => {
    if (!error) console.log('✅ Taskbar shown')
  })
  
  // Cleanup the hide script
  if (hideTaskbarScriptPath) {
    try { fs.unlinkSync(hideTaskbarScriptPath) } catch {}
    hideTaskbarScriptPath = null
  }
}

// Register global shortcuts as additional protection
function registerGlobalShortcuts(): void {
  const shortcuts = [
    'Alt+Tab',
    'Alt+F4',
    'Alt+Escape',
    'Ctrl+Escape',
    'Ctrl+Shift+Escape',
    'Super',
    'Super+D',
    'Super+E', 
    'Super+R',
    'Super+Tab',
    'Super+L',
    'Super+M',
    'Super+S',
    'Super+I',
    'Super+A',
    'Super+X',
    'F11'
  ]

  shortcuts.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        console.log(`🚫 Blocked: ${shortcut}`)
        if (mainWindow && isLocked) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.moveTop()
        }
      })
    } catch (e) {
      // Some may fail
    }
  })
  console.log('✅ Global shortcuts registered')
}

function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
  console.log('✅ Global shortcuts unregistered')
}

// Combined lockdown functions
let taskbarHideInterval: NodeJS.Timeout | null = null

function enableLockdownMode(): void {
  console.log('🔒 Enabling lockdown mode...')
  disableWindowsKeyViaRegistry()
  disableTaskManager()
  hideTaskbar()
  registerGlobalShortcuts()
  
  // Periodically hide taskbar in case it reappears (e.g., when Windows key is pressed)
  if (taskbarHideInterval) clearInterval(taskbarHideInterval)
  taskbarHideInterval = setInterval(() => {
    if (isLocked) hideTaskbar()
  }, 1000)
}

function disableLockdownMode(): void {
  console.log('🔓 Disabling lockdown mode...')
  
  // Stop periodic taskbar hiding
  if (taskbarHideInterval) {
    clearInterval(taskbarHideInterval)
    taskbarHideInterval = null
  }
  
  enableWindowsKeyViaRegistry()
  enableTaskManager()
  showTaskbar()
  unregisterGlobalShortcuts()
}

// ============================================
// PROCESS PROTECTION
// ============================================

function checkCommandLineKillCode(): boolean {
  const args = process.argv.slice(2)
  for (const arg of args) {
    if (arg.startsWith('--kill-code=')) {
      const code = arg.split('=')[1]
      if (code === ADMIN_KILL_CODE) {
        return true
      }
    }
  }
  return false
}

function setupConsoleKillCode(): void {
  if (process.stdin.isTTY || is.dev) {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      })

      console.log('')
      console.log('═══════════════════════════════════════════════════════')
      console.log('  🎮 RYNXPLAY STATION Client PC')
      console.log('═══════════════════════════════════════════════════════')
      console.log('  To safely exit while locked:')
      console.log('  1. Type the admin kill code in this console')
      console.log('  2. Or run with: --kill-code=YOUR_CODE')
      console.log('  3. Or use tray icon → Admin Exit')
      console.log('═══════════════════════════════════════════════════════')
      console.log('')
      
      rl.on('line', (input) => {
        const trimmed = input.trim()
        if (trimmed === ADMIN_KILL_CODE) {
          console.log('✅ Kill code accepted. Exiting safely...')
          safeExit()
        } else if (trimmed.length > 0) {
          console.log('❌ Invalid kill code')
        }
      })
    } catch (e) {
      // stdin not available
    }
  }
}

function safeExit(): void {
  console.log('🛑 Safe exit initiated...')
  isAuthorizedExit = true
  isQuitting = true
  
  disableLockdownMode()
  
  setTimeout(() => {
    app.quit()
  }, 500)
}

function rebootSystem(): void {
  console.log('⚠️ Unauthorized termination! Rebooting...')
  
  if (process.platform === 'win32') {
    exec('shutdown /r /t 5 /c "RYNXPLAY: Security reboot - unauthorized termination"')
  } else {
    exec('shutdown -r +1')
  }
}

// ============================================
// MAIN WINDOW (Lock Screen)
// ============================================

function createWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.bounds
  
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
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
    thickFrame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (isLocked) {
      mainWindow?.show()
      mainWindow?.focus()
      mainWindow?.moveTop()
      enableLockdownMode()
    }
  })

  mainWindow.on('close', (event) => {
    if (isLocked && !isQuitting) {
      event.preventDefault()
    }
  })

  mainWindow.on('minimize', (event) => {
    if (isLocked) {
      event.preventDefault()
      mainWindow?.restore()
      mainWindow?.focus()
    }
  })

  // Aggressive refocus when locked
  mainWindow.on('blur', () => {
    if (isLocked && mainWindow && !isQuitting) {
      mainWindow.focus()
      mainWindow.moveTop()
      setTimeout(() => {
        if (isLocked && mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.moveTop()
        }
      }, 50)
    }
  })

  mainWindow.on('show', () => {
    if (isLocked && mainWindow) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
      mainWindow.moveTop()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'd') {
        mainWindow?.webContents.toggleDevTools()
        event.preventDefault()
      }
      if (input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Periodic focus enforcement when locked
  setInterval(() => {
    if (isLocked && mainWindow && !isQuitting) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.moveTop()
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 500)
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
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

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
          
          timerEl.className = 'timer';
          if (sessionType === 'guest') {
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
  
  tray.on('double-click', () => {
    if (isLocked) {
      mainWindow?.show()
      mainWindow?.focus()
    } else {
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
      label: `Status: ${config.isApproved ? (isLocked ? '🔒 Locked' : '🟢 Active') : '⏳ Pending'}`,
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
      click: hideFloatingTimer
    },
    { type: 'separator' },
    {
      label: '🔑 Admin Exit...',
      click: async () => {
        if (process.platform === 'win32') {
          const psScript = `[System.Reflection.Assembly]::LoadWithPartialName('Microsoft.VisualBasic') | Out-Null; [Microsoft.VisualBasic.Interaction]::InputBox('Enter Admin Kill Code:', 'RYNXPLAY Admin Exit', '')`
          exec(`powershell -Command "${psScript}"`, (error, stdout) => {
            const code = stdout.trim()
            if (code === ADMIN_KILL_CODE) {
              safeExit()
            } else if (code.length > 0) {
              dialog.showErrorBox('Invalid Code', 'The kill code is incorrect.')
            }
          })
        } else {
          dialog.showMessageBox({
            type: 'info',
            title: 'Admin Exit',
            message: `To exit, run with:\n--kill-code=${ADMIN_KILL_CODE}`,
            buttons: ['OK']
          })
        }
      }
    }
  ])
  
  tray?.setContextMenu(contextMenu)
}

// ============================================
// SYSTEM SPECS & UTILITIES
// ============================================

function getOrCreateDeviceCode(): string {
  let deviceCode = store.get('deviceCode') as string | null
  
  if (!deviceCode) {
    const uuid = uuidv4()
    deviceCode = `RYNX-${uuid.split('-')[0].toUpperCase()}`
    store.set('deviceCode', deviceCode)
  }
  
  return deviceCode
}

async function getSystemSpecs(): Promise<SystemSpecs> {
  try {
    const [cpu, mem, graphics, diskLayout, osInfo, networkInterfaces] = await Promise.all([
      si.cpu(), si.mem(), si.graphics(), si.fsSize(), si.osInfo(), si.networkInterfaces()
    ])

    const totalDisk = diskLayout.reduce((acc, disk) => acc + disk.size, 0)
    const usedDisk = diskLayout.reduce((acc, disk) => acc + disk.used, 0)

    const primaryNetwork = Array.isArray(networkInterfaces) 
      ? networkInterfaces.find(n => !n.internal && n.mac !== '00:00:00:00:00:00') || networkInterfaces[0]
      : networkInterfaces

    return {
      cpu: { brand: cpu.brand, manufacturer: cpu.manufacturer, speed: cpu.speed, cores: cpu.cores, physicalCores: cpu.physicalCores },
      memory: { total: mem.total, free: mem.free, used: mem.used },
      graphics: { controllers: graphics.controllers.map(g => ({ model: g.model, vendor: g.vendor, vram: g.vram || 0 })) },
      disk: { total: totalDisk, used: usedDisk, free: totalDisk - usedDisk },
      os: { platform: osInfo.platform, distro: osInfo.distro, release: osInfo.release, arch: osInfo.arch, hostname: os.hostname() },
      network: { mac: primaryNetwork?.mac || 'Unknown', ip: primaryNetwork?.ip4 || 'Unknown' }
    }
  } catch (error) {
    return {
      cpu: { brand: 'Unknown', manufacturer: 'Unknown', speed: 0, cores: os.cpus().length, physicalCores: os.cpus().length },
      memory: { total: os.totalmem(), free: os.freemem(), used: os.totalmem() - os.freemem() },
      graphics: { controllers: [{ model: 'Unknown', vendor: 'Unknown', vram: 0 }] },
      disk: { total: 0, used: 0, free: 0 },
      os: { platform: os.platform(), distro: os.type(), release: os.release(), arch: os.arch(), hostname: os.hostname() },
      network: { mac: 'Unknown', ip: 'Unknown' }
    }
  }
}

async function generateQRCode(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, { width: 256, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
  } catch (error) {
    return ''
  }
}

// ============================================
// IPC HANDLERS
// ============================================

function setupIpcHandlers(): void {
  ipcMain.handle('get-config', () => getConfig())
  ipcMain.handle('save-config', (_event, config: Record<string, unknown>) => {
    Object.entries(config).forEach(([key, value]) => store.set(key, value))
    updateTrayMenu()
    return true
  })
  ipcMain.handle('get-device-code', () => getOrCreateDeviceCode())
  ipcMain.handle('get-system-specs', async () => await getSystemSpecs())
  ipcMain.handle('generate-qr-code', async (_event, data: string) => await generateQRCode(data))

  ipcMain.handle('lock-screen', () => {
    isLocked = true
    enableLockdownMode()
    hideFloatingTimer()
    mainWindow?.setAlwaysOnTop(true, 'screen-saver')
    mainWindow?.setKiosk(true)
    mainWindow?.setSkipTaskbar(true)
    mainWindow?.setFullScreen(true)
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.moveTop()
    updateTrayMenu()
    return true
  })

  ipcMain.handle('unlock-screen', () => {
    isLocked = false
    disableLockdownMode()
    mainWindow?.setAlwaysOnTop(false)
    mainWindow?.setKiosk(false)
    mainWindow?.setSkipTaskbar(false)
    mainWindow?.setFullScreen(false)
    mainWindow?.hide()
    showFloatingTimer()
    updateTrayMenu()
    return true
  })

  ipcMain.handle('get-lock-status', () => isLocked)
  ipcMain.handle('update-floating-timer', (_event, time: number, sessionType: 'guest' | 'member') => {
    updateFloatingTimer(time, sessionType)
    return true
  })
  ipcMain.handle('show-floating-timer', () => { showFloatingTimer(); return true })
  ipcMain.handle('hide-floating-timer', () => { hideFloatingTimer(); return true })
  ipcMain.on('hide-floating-timer', () => hideFloatingTimer())

  ipcMain.handle('execute-command', (_event, command: string) => {
    return new Promise((resolve, reject) => {
      if (command === 'shutdown') {
        disableLockdownMode()
        exec(process.platform === 'win32' ? 'shutdown /s /t 30 /c "RYNXPLAY: Shutting down..."' : 'shutdown -h +1', (e) => e ? reject(e) : resolve(true))
      } else if (command === 'restart') {
        disableLockdownMode()
        exec(process.platform === 'win32' ? 'shutdown /r /t 30 /c "RYNXPLAY: Restarting..."' : 'shutdown -r +1', (e) => e ? reject(e) : resolve(true))
      } else if (command === 'cancel-shutdown') {
        exec(process.platform === 'win32' ? 'shutdown /a' : 'shutdown -c', (e) => e ? reject(e) : resolve(true))
      } else {
        reject(new Error(`Unknown command: ${command}`))
      }
    })
  })

  ipcMain.handle('show-message', (_event, message: string) => {
    mainWindow?.webContents.send('display-message', message)
    return true
  })

  ipcMain.handle('quit-app', (_event, killCode?: string) => {
    if (killCode === ADMIN_KILL_CODE) {
      safeExit()
      return true
    }
    return false
  })

  ipcMain.handle('get-system-info', () => ({
    platform: process.platform,
    hostname: os.hostname(),
    arch: process.arch,
    version: app.getVersion()
  }))
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

if (checkCommandLineKillCode()) {
  console.log('✅ Kill code provided. Safe exit enabled.')
  isAuthorizedExit = true
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (isLocked) { mainWindow.show(); mainWindow.focus() }
      else if (floatingWindow) showFloatingTimer()
    }
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.rynxplay.station.client')
    setupConsoleKillCode()
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
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
      if (!isAuthorizedExit && isLocked) rebootSystem()
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (isLocked && !isQuitting) { event.preventDefault(); return }
    if (!isAuthorizedExit && isLocked) { event.preventDefault(); rebootSystem() }
  })

  app.on('will-quit', () => disableLockdownMode())
}