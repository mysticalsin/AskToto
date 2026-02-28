import { IpcMain, BrowserWindow } from 'electron'
import { WindowHelper } from '../../WindowHelper'

export function registerWindowHandlers(ipcMain: IpcMain, windowHelper: WindowHelper) {
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.isMaximized() ? win.unmaximize() : win.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      // Settings window: hide instead of destroy
      if (win === windowHelper.getSettingsWindow()) {
        win.hide()
      } else {
        win.close()
      }
    }
  })

  ipcMain.on('set-mouse-passthrough', (_event, passthrough: boolean) => {
    windowHelper.setMousePassthrough(passthrough)
  })

  ipcMain.on('open-settings', () => windowHelper.openSettings())
  ipcMain.on('open-dashboard', () => windowHelper.openDashboard())
  ipcMain.on('close-settings', () => windowHelper.closeSettings())
}
