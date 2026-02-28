import { BrowserWindow, Display } from 'electron'
import path from 'path'

export class WindowHelper {
  overlayWindow: BrowserWindow | null = null
  settingsWindow: BrowserWindow | null = null
  onboardingWindow: BrowserWindow | null = null
  private preloadPath: string
  private devUrl: string | undefined
  private distPath: string
  private display: Display
  private overlayVisible = true

  constructor(preloadPath: string, devUrl: string | undefined, distPath: string, display: Display) {
    this.preloadPath = preloadPath
    this.devUrl = devUrl
    this.distPath = distPath
    this.display = display
  }

  async createWindows(needsOnboarding: boolean) {
    if (needsOnboarding) {
      await this.createOnboardingWindow()
    } else {
      await this.createOverlayWindow()
    }
    await this.createSettingsWindow()
  }

  private async loadWindowURL(win: BrowserWindow, hash: string) {
    if (this.devUrl) {
      await win.loadURL(`${this.devUrl}#${hash}`)
    } else {
      await win.loadFile(path.join(this.distPath, 'index.html'), { hash })
    }
  }

  // ── Onboarding Window ──────────────────────────────────────────────
  private async createOnboardingWindow() {
    this.onboardingWindow = new BrowserWindow({
      width: 1100,
      height: 860,
      frame: false,
      show: false,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      minimizable: true,
      center: true,
      backgroundColor: '#0b0c10',
      hasShadow: true,
      roundedCorners: true,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      }
    })

    this.onboardingWindow.setContentProtection(true)
    await this.loadWindowURL(this.onboardingWindow, 'onboarding')
    this.onboardingWindow.show()
    this.onboardingWindow.focus()
  }

  async finishOnboarding() {
    if (this.onboardingWindow && !this.onboardingWindow.isDestroyed()) {
      this.onboardingWindow.close()
    }
    this.onboardingWindow = null
    await this.createOverlayWindow()
  }

  // ── Overlay Window ─────────────────────────────────────────────────
  private async createOverlayWindow() {
    const { width, height, x, y } = this.display.workArea

    this.overlayWindow = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      roundedCorners: false,
      fullscreenable: false,
      minimizable: false,
      resizable: false,
      focusable: false,
      show: false,
      ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      }
    })

    this.overlayWindow.setContentProtection(true)

    if (process.platform === 'win32') {
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      // MODERATE-10 fix: Initial opacity set via settings in main.ts
      this.overlayWindow.setOpacity(0.99)
    }

    this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })

    await this.loadWindowURL(this.overlayWindow, 'overlay')
    this.overlayWindow.showInactive()
    this.overlayVisible = true
  }

  // ── Settings / Dashboard Window ────────────────────────────────────
  private async createSettingsWindow() {
    this.settingsWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      frame: false,
      show: false,
      resizable: true,
      minimizable: true,
      maximizable: true,
      center: true,
      backgroundColor: '#0b0c10',
      hasShadow: true,
      roundedCorners: true,
      webPreferences: {
        preload: this.preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      }
    })

    this.settingsWindow.setContentProtection(true)
    await this.loadWindowURL(this.settingsWindow, 'dashboard')
  }

  // ── Mouse Passthrough ──────────────────────────────────────────────
  setMousePassthrough(passthrough: boolean) {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    if (passthrough) {
      this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })
      this.overlayWindow.setFocusable(false)
    } else {
      this.overlayWindow.setIgnoreMouseEvents(false)
      this.overlayWindow.setFocusable(true)
    }
  }

  // ── Overlay Visibility ─────────────────────────────────────────────
  toggleOverlay() {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    this.overlayVisible ? this.hideOverlay() : this.showOverlay()
  }

  showOverlay() {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    this.overlayWindow.showInactive()
    this.overlayVisible = true
  }

  hideOverlay() {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    this.overlayWindow.hide()
    this.overlayVisible = false
  }

  // ── Window Movement ──────────────────────────────────────────────
  moveActiveWindow(direction: 'up' | 'down' | 'left' | 'right', step = 50) {
    const win = this.getVisibleManagedWindow()
    if (win) {
      // Move the settings/onboarding BrowserWindow
      const [x, y] = win.getPosition()
      switch (direction) {
        case 'up':    win.setPosition(x, y - step); break
        case 'down':  win.setPosition(x, y + step); break
        case 'left':  win.setPosition(x - step, y); break
        case 'right': win.setPosition(x + step, y); break
      }
    } else {
      // No settings/onboarding visible — move the overlay panel instead
      this.sendToOverlay('move-overlay', direction, step)
    }
  }

  private getVisibleManagedWindow(): BrowserWindow | null {
    // Prefer settings window if visible, then onboarding
    if (this.settingsWindow && !this.settingsWindow.isDestroyed() && this.settingsWindow.isVisible()) {
      return this.settingsWindow
    }
    if (this.onboardingWindow && !this.onboardingWindow.isDestroyed() && this.onboardingWindow.isVisible()) {
      return this.onboardingWindow
    }
    return null
  }

  // ── Settings Visibility ────────────────────────────────────────────
  openSettings() {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) return
    this.settingsWindow.show()
    this.settingsWindow.focus()
  }

  openDashboard() {
    this.openSettings()
  }

  closeSettings() {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) return
    this.settingsWindow.hide()
  }

  // ── IPC Messaging ─────────────────────────────────────────────────
  sendToOverlay(channel: string, ...args: any[]) {
    if (!this.overlayWindow || this.overlayWindow.isDestroyed()) return
    this.overlayWindow.webContents.send(channel, ...args)
  }

  sendToSettings(channel: string, ...args: any[]) {
    if (!this.settingsWindow || this.settingsWindow.isDestroyed()) return
    this.settingsWindow.webContents.send(channel, ...args)
  }

  // ── Getters ────────────────────────────────────────────────────────
  getOverlayWindow(): BrowserWindow | null {
    return this.overlayWindow && !this.overlayWindow.isDestroyed() ? this.overlayWindow : null
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow && !this.settingsWindow.isDestroyed() ? this.settingsWindow : null
  }

  destroyAll() {
    for (const win of [this.overlayWindow, this.settingsWindow, this.onboardingWindow]) {
      if (win && !win.isDestroyed()) win.close()
    }
    this.overlayWindow = null
    this.settingsWindow = null
    this.onboardingWindow = null
  }
}
