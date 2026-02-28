import { EventEmitter } from 'events'
import { execSync } from 'child_process'
import { SettingsManager } from './SettingsManager'
import logger from './Logger'

export interface DetectedMeeting {
  app: string        // 'zoom' | 'teams' | 'meet' | 'slack' | 'webex' | 'skype'
  windowTitle: string
  detectedAt: number
}

interface WindowTitlePattern {
  app: string
  regex: RegExp
}

// Patterns tuned for ACTIVE calls, not just open apps
const MEETING_PATTERNS: WindowTitlePattern[] = [
  { app: 'zoom',  regex: /Zoom Meeting|Zoom Webinar/i },
  { app: 'teams', regex: /\| Microsoft Teams$/i },
  { app: 'meet',  regex: /meet\.google\.com/i },
  { app: 'slack', regex: /Slack\s*\|.*Huddle|Slack Huddle/i },
  { app: 'webex', regex: /Webex Meeting|Cisco Webex/i },
  { app: 'skype', regex: /Skype.*Call|Skype.*\|/i },
]

const APP_LABELS: Record<string, string> = {
  zoom:  'Zoom Meeting',
  teams: 'Teams Call',
  meet:  'Google Meet',
  slack: 'Slack Huddle',
  webex: 'Webex Meeting',
  skype: 'Skype Call',
}

const POLL_INTERVAL = 8000          // 8 seconds between polls
const DISMISS_COOLDOWN = 120_000    // 2 minutes before re-prompting same app
const POWERSHELL_TIMEOUT = 3000     // 3 second timeout for PowerShell

/**
 * MeetingDetector — Polls visible window titles to detect active meeting calls.
 *
 * Events:
 * - 'meeting-detected': { app, windowTitle, detectedAt } — a new meeting was found
 * - 'meeting-ended': { app } — previously detected meeting window disappeared
 *
 * Uses PowerShell Get-Process on Windows to enumerate window titles.
 * No native module dependencies.
 */
export class MeetingDetector extends EventEmitter {
  private settings: SettingsManager
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private currentDetection: DetectedMeeting | null = null
  private dismissedApps = new Map<string, number>() // app → dismiss timestamp
  private isEnabled = true
  private isUserRecording = false
  private settingsUnsub: (() => void) | null = null

  constructor(settings: SettingsManager) {
    super()
    this.settings = settings
    this.isEnabled = settings.get('meetingDetectionEnabled', true)

    // React to settings changes immediately
    this.settingsUnsub = settings.onChange('meetingDetectionEnabled', (newVal) => {
      this.isEnabled = !!newVal
      if (!this.isEnabled && this.currentDetection) {
        const ended = this.currentDetection
        this.currentDetection = null
        this.emit('meeting-ended', { app: ended.app })
      }
      logger.info('MeetingDetector', `Meeting detection ${this.isEnabled ? 'enabled' : 'disabled'}`)
    })
  }

  /** Start polling for meeting windows */
  start(): void {
    if (this.pollTimer) return
    if (process.platform !== 'win32') {
      logger.info('MeetingDetector', 'Meeting detection only supported on Windows — skipping')
      return
    }

    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL)
    logger.info('MeetingDetector', `Started polling every ${POLL_INTERVAL / 1000}s`)

    // Run first poll immediately
    setTimeout(() => this.poll(), 1000)
  }

  /** Stop polling */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.settingsUnsub) {
      this.settingsUnsub()
      this.settingsUnsub = null
    }
    logger.info('MeetingDetector', 'Stopped')
  }

  /** Called by recording handlers when recording starts/stops */
  setRecordingState(isRecording: boolean): void {
    this.isUserRecording = isRecording
    if (isRecording && this.currentDetection) {
      // Clear current detection — user is already recording
      this.currentDetection = null
    }
  }

  /** Called when user dismisses the banner for an app */
  dismiss(app: string): void {
    this.dismissedApps.set(app, Date.now())
    if (this.currentDetection?.app === app) {
      this.currentDetection = null
    }
    logger.debug('MeetingDetector', `Dismissed ${app}, cooldown ${DISMISS_COOLDOWN / 1000}s`)
  }

  /** Get human-readable label for an app */
  static getAppLabel(app: string): string {
    return APP_LABELS[app] || app
  }

  /** Core polling logic */
  private poll(): void {
    if (!this.isEnabled || this.isUserRecording) return

    try {
      const titles = this.getWindowTitles()
      const match = this.findMeetingMatch(titles)

      if (match) {
        // Check cooldown for dismissed apps
        const dismissedAt = this.dismissedApps.get(match.app)
        if (dismissedAt && (Date.now() - dismissedAt) < DISMISS_COOLDOWN) {
          return // Still in cooldown
        }

        // Clear expired cooldowns
        for (const [app, ts] of this.dismissedApps) {
          if (Date.now() - ts >= DISMISS_COOLDOWN) {
            this.dismissedApps.delete(app)
          }
        }

        // Is this a new detection?
        if (!this.currentDetection || this.currentDetection.app !== match.app) {
          this.currentDetection = {
            app: match.app,
            windowTitle: match.windowTitle,
            detectedAt: Date.now(),
          }
          logger.info('MeetingDetector', `Detected: ${match.app} — "${match.windowTitle}"`)
          this.emit('meeting-detected', {
            app: match.app,
            windowTitle: match.windowTitle,
          })
        }
      } else if (this.currentDetection) {
        // Meeting window disappeared
        const ended = this.currentDetection
        this.currentDetection = null
        logger.info('MeetingDetector', `Meeting ended: ${ended.app}`)
        this.emit('meeting-ended', { app: ended.app })
      }
    } catch (err) {
      // PowerShell failure — log and skip this cycle, don't crash
      logger.debug('MeetingDetector', `Poll failed (non-critical)`, err)
    }
  }

  /** Get list of all visible window titles via PowerShell */
  private getWindowTitles(): string[] {
    const cmd = `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty MainWindowTitle"`

    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: POWERSHELL_TIMEOUT,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
  }

  /** Match window titles against known meeting patterns */
  private findMeetingMatch(titles: string[]): { app: string; windowTitle: string } | null {
    for (const title of titles) {
      for (const pattern of MEETING_PATTERNS) {
        if (pattern.regex.test(title)) {
          return { app: pattern.app, windowTitle: title }
        }
      }
    }
    return null
  }
}
