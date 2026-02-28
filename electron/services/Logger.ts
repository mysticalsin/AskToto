import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

// ── Configure electron-log ─────────────────────────────────────────
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'asktoto.log')

log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB per file
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.format = '{h}:{i}:{s} [{level}] {text}'

// In production, only log info and above to console
if (!process.env.VITE_DEV_SERVER_URL) {
  log.transports.console.level = 'info'
}

// ── Logger Singleton ───────────────────────────────────────────────
class Logger {
  private static instance: Logger

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger()
    return Logger.instance
  }

  debug(module: string, message: string, ...args: any[]): void {
    log.debug(`[${module}] ${message}`, ...args)
  }

  info(module: string, message: string, ...args: any[]): void {
    log.info(`[${module}] ${message}`, ...args)
  }

  warn(module: string, message: string, ...args: any[]): void {
    log.warn(`[${module}] ${message}`, ...args)
  }

  error(module: string, message: string, error?: Error | unknown): void {
    if (error instanceof Error) {
      log.error(`[${module}] ${message}:`, error.message, error.stack)
    } else if (error !== undefined) {
      log.error(`[${module}] ${message}:`, error)
    } else {
      log.error(`[${module}] ${message}`)
    }
  }
}

export const logger = Logger.getInstance()
export default logger
