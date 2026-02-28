import { IpcMain } from 'electron'
import { ScreenshotHelper } from '../../ScreenshotHelper'
import logger from '../../services/Logger'

export function registerScreenshotHandlers(ipcMain: IpcMain, screenshotHelper: ScreenshotHelper) {
  ipcMain.handle('take-screenshot', async () => {
    try {
      return await screenshotHelper.captureScreen()
    } catch (err) {
      logger.error('Screenshot', 'Screenshot failed', err)
      return null
    }
  })
}
