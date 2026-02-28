import { IpcMain } from 'electron'
import { SettingsManager } from '../../services/SettingsManager'
import logger from '../../services/Logger'

export function registerSettingsHandlers(ipcMain: IpcMain, settingsManager: SettingsManager) {
  ipcMain.handle('get-settings', () => {
    return settingsManager.getAll()
  })

  ipcMain.handle('save-settings', (_event, data: any) => {
    if (data && typeof data === 'object') {
      settingsManager.setAll(data)
      logger.info('Settings', 'Settings saved')
    }
    return true
  })

  ipcMain.handle('settings:get', (_event, key: string) => {
    if (typeof key !== 'string' || !key) return null
    return settingsManager.get(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: any) => {
    if (typeof key !== 'string' || !key) return false
    settingsManager.set(key, value)
    logger.debug('Settings', `Setting ${key} updated`)
    return true
  })
}
