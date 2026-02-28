import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import path from 'path'
import logger from './services/Logger'
import { WindowHelper } from './WindowHelper'
import { ScreenshotHelper } from './ScreenshotHelper'
import { LLMHelper } from './llm/LLMHelper'
import { Database } from './db/database'
import { SettingsManager } from './services/SettingsManager'
import { AudioManager } from './audio/AudioManager'
import { MeetingSession } from './services/MeetingSession'
import { MeetingDetector } from './services/MeetingDetector'

// IPC handler modules
import { registerWindowHandlers } from './ipc/handlers/windowHandlers'
import { registerAIHandlers } from './ipc/handlers/aiHandlers'
import { registerRecordingHandlers } from './ipc/handlers/recordingHandlers'
import { registerMeetingHandlers } from './ipc/handlers/meetingHandlers'
import { registerSettingsHandlers } from './ipc/handlers/settingsHandlers'
import { registerScreenshotHandlers } from './ipc/handlers/screenshotHandlers'
import { registerMeetingDetectionHandlers } from './ipc/handlers/meetingDetectionHandlers'

// ── Globals ──────────────────────────────────────────────────────────
let windowHelper: WindowHelper
let database: Database
let audioManager: AudioManager
let meetingDetector: MeetingDetector
let tray: Tray | null = null

const DIST = path.join(__dirname, '../dist')
const RENDERER_URL = process.env.VITE_DEV_SERVER_URL
const PRELOAD = path.join(__dirname, 'preload.js')

// ── Global Error Handling ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Main', 'Uncaught exception in main process', err)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Main', 'Unhandled promise rejection', reason as Error)
})

// ── Single Instance Lock ─────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowHelper?.openSettings()
  })
}

// ── Tray ─────────────────────────────────────────────────────────────
function createTray() {
  try {
    // MAJOR-1 fix: Create a proper tray icon instead of empty image
    const iconSize = 16
    const icon = nativeImage.createFromBuffer(
      Buffer.alloc(iconSize * iconSize * 4, 0), // Fallback: transparent icon
      { width: iconSize, height: iconSize }
    )
    // Try loading proper icon from resources
    const iconPath = path.join(__dirname, '../resources/icon.png')
    let trayIcon: Electron.NativeImage
    try {
      trayIcon = nativeImage.createFromPath(iconPath)
      if (trayIcon.isEmpty()) trayIcon = icon
    } catch {
      trayIcon = icon
    }
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
    tray.setToolTip('AskToto')

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Overlay', click: () => windowHelper?.showOverlay() },
      { label: 'Hide Overlay', click: () => windowHelper?.hideOverlay() },
      { type: 'separator' },
      { label: 'Open Settings', click: () => windowHelper?.openSettings() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray.setContextMenu(contextMenu)
    tray.on('click', () => windowHelper?.toggleOverlay())
    logger.info('Main', 'System tray created')
  } catch (err) {
    logger.error('Main', 'Failed to create tray', err)
  }
}

// ── Global Shortcuts ─────────────────────────────────────────────────
function registerShortcuts() {
  const shortcuts: [string, () => void][] = [
    ['CommandOrControl+Return', () => windowHelper?.sendToOverlay('trigger-ai-shortcut')],
    ['CommandOrControl+\\', () => windowHelper?.toggleOverlay()],
    ['CommandOrControl+Shift+R', () => windowHelper?.sendToOverlay('toggle-recording-shortcut')],
    ['CommandOrControl+Shift+Up', () => windowHelper?.sendToOverlay('scroll-response', 'up')],
    ['CommandOrControl+Shift+Down', () => windowHelper?.sendToOverlay('scroll-response', 'down')],
    // Move dashboard/overlay with Ctrl+Arrow keys
    ['CommandOrControl+Up', () => windowHelper?.moveActiveWindow('up')],
    ['CommandOrControl+Down', () => windowHelper?.moveActiveWindow('down')],
    ['CommandOrControl+Left', () => windowHelper?.moveActiveWindow('left')],
    ['CommandOrControl+Right', () => windowHelper?.moveActiveWindow('right')],
  ]

  let registered = 0
  for (const [accel, handler] of shortcuts) {
    try {
      globalShortcut.register(accel, handler)
      registered++
    } catch (err) {
      logger.warn('Main', `Failed to register shortcut ${accel}`, err)
    }
  }
  logger.info('Main', `Registered ${registered}/${shortcuts.length} global shortcuts`)
}

// ── App Startup ──────────────────────────────────────────────────────
async function createApp() {
  logger.info('Main', 'Starting AskToto...')

  // 1. Foundation services
  const settingsManager = new SettingsManager()
  logger.info('Main', 'SettingsManager initialized')

  // MAJOR-12 fix: Use singleton pattern for database
  database = Database.getInstance()
  logger.info('Main', 'Database initialized')

  const meetingSession = new MeetingSession()

  // 2. Processing services
  const llmHelper = new LLMHelper(settingsManager)
  const screenshotHelper = new ScreenshotHelper()
  audioManager = new AudioManager(settingsManager)
  meetingDetector = new MeetingDetector(settingsManager)
  logger.info('Main', 'Processing services initialized')

  // 3. Check if user has API keys (determines onboarding vs overlay)
  const hasKeys = !!(
    settingsManager.get('openaiKey') ||
    settingsManager.get('anthropicKey') ||
    settingsManager.get('geminiKey') ||
    settingsManager.get('kimiKey')
  )

  // 4. Create windows
  const primaryDisplay = screen.getPrimaryDisplay()
  windowHelper = new WindowHelper(PRELOAD, RENDERER_URL, DIST, primaryDisplay)
  screenshotHelper.setWindows(windowHelper)

  // 5. Register all IPC handlers (decomposed into focused modules)
  registerWindowHandlers(ipcMain, windowHelper)
  registerAIHandlers(ipcMain, {
    windowHelper, llmHelper, screenshotHelper, database, settingsManager, audioManager, meetingSession,
  })
  registerRecordingHandlers(ipcMain, {
    windowHelper, audioManager, database, meetingSession, meetingDetector,
  })
  registerMeetingHandlers(ipcMain, database)
  registerSettingsHandlers(ipcMain, settingsManager)
  registerScreenshotHandlers(ipcMain, screenshotHelper)
  registerMeetingDetectionHandlers(ipcMain, {
    windowHelper, audioManager, database, meetingSession, meetingDetector,
  })

  // Onboarding handler
  ipcMain.handle('finish-onboarding', async () => {
    await windowHelper.finishOnboarding()
    return true
  })

  // MAJOR-2 fix: Content protection toggle from renderer
  ipcMain.on('set-content-protection', (_event, enabled: boolean) => {
    const overlay = windowHelper.getOverlayWindow()
    if (overlay) overlay.setContentProtection(enabled)
    const settings = windowHelper.getSettingsWindow()
    if (settings) settings.setContentProtection(enabled)
    logger.info('Main', `Content protection: ${enabled}`)
  })

  // MAJOR-4 fix: App quit handler
  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  // MINOR-10 fix: Apply auto-launch setting
  const autoLaunch = settingsManager.get('autoLaunch', false)
  app.setLoginItemSettings({ openAtLogin: autoLaunch })
  settingsManager.onChange('autoLaunch', (newVal) => {
    app.setLoginItemSettings({ openAtLogin: !!newVal })
    logger.info('Main', `Auto-launch: ${newVal}`)
  })

  // MODERATE-10 fix: Apply overlay opacity from settings to BrowserWindow
  settingsManager.onChange('overlayOpacity', (newVal) => {
    const overlay = windowHelper.getOverlayWindow()
    if (overlay) {
      overlay.setOpacity(Math.max(0.3, Math.min(1.0, (newVal as number) / 100)))
      logger.debug('Main', `Overlay opacity: ${newVal}%`)
    }
  })

  logger.info('Main', 'All IPC handlers registered')

  // 6. Create windows and UI
  await windowHelper.createWindows(!hasKeys)
  registerShortcuts()
  createTray()

  // Apply initial overlay opacity from settings
  const initOpacity = settingsManager.get('overlayOpacity', 88)
  const overlayWin = windowHelper.getOverlayWindow()
  if (overlayWin && initOpacity < 100) {
    overlayWin.setOpacity(Math.max(0.3, initOpacity / 100))
  }

  // Start meeting detection polling
  meetingDetector.start()

  logger.info('Main', 'AskToto started successfully')
}

// ── App Lifecycle ────────────────────────────────────────────────────
if (gotLock) {
  app.whenReady().then(createApp).catch((err) => {
    logger.error('Main', 'Failed to start app', err)
    app.quit()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createApp()
})

app.on('will-quit', () => {
  logger.info('Main', 'Shutting down...')
  globalShortcut.unregisterAll()
  meetingDetector?.stop()
  audioManager?.stop()
  database?.close()
  if (tray) { tray.destroy(); tray = null }
  logger.info('Main', 'Shutdown complete')
})
