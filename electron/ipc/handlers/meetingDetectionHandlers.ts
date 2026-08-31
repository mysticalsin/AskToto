import { IpcMain } from 'electron'
import { WindowHelper } from '../../WindowHelper'
import { AudioManager } from '../../audio/AudioManager'
import { Database } from '../../db/database'
import { MeetingSession } from '../../services/MeetingSession'
import { MeetingDetector } from '../../services/MeetingDetector'
import logger from '../../services/Logger'
import { persistableTranscriptSegment } from '../../audio/transcriptPersistence'

interface MeetingDetectionDependencies {
  windowHelper: WindowHelper
  audioManager: AudioManager
  database: Database
  meetingSession: MeetingSession
  meetingDetector: MeetingDetector
}

export function registerMeetingDetectionHandlers(
  ipcMain: IpcMain,
  deps: MeetingDetectionDependencies
) {
  const { windowHelper, audioManager, database, meetingSession, meetingDetector } = deps

  // Forward detection events to overlay renderer
  meetingDetector.on('meeting-detected', (data: { app: string; windowTitle: string }) => {
    if (!audioManager.getIsRecording()) {
      windowHelper.sendToOverlay('meeting-detected', data)
    }
  })

  meetingDetector.on('meeting-ended', (data: { app: string }) => {
    windowHelper.sendToOverlay('meeting-ended', data)
  })

  // User accepted: start recording with auto-generated meeting title
  ipcMain.handle('meeting-detection:accept', async (_event, appName: string) => {
    if (audioManager.getIsRecording()) return true // Already recording

    const overlayWindow = windowHelper.getOverlayWindow()
    if (!overlayWindow) return false

    try {
      const label = MeetingDetector.getAppLabel(appName)
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const title = `${label} — ${date}`

      const meetingId = database.startMeeting(title)
      meetingSession.start(meetingId)

      audioManager.setTranscriptCallback((fullText, newSegment) => {
        windowHelper.sendToOverlay('transcript-update', fullText)
        const segment = persistableTranscriptSegment(newSegment)
        if (meetingSession.isActive && segment) {
          try {
            database.addTranscript(meetingSession.id!, segment)
          } catch (err) {
            logger.error('MeetingDetection', 'Transcript save failed', err)
          }
        }
      })

      await audioManager.start(overlayWindow)
      meetingDetector.setRecordingState(true)
      windowHelper.sendToOverlay('recording-status', true)

      logger.info('MeetingDetection', `Recording started from detection: ${title}`)
      return true
    } catch (err) {
      logger.error('MeetingDetection', 'Failed to start recording from detection', err)
      return false
    }
  })

  // User dismissed the banner
  ipcMain.handle('meeting-detection:dismiss', async (_event, appName: string) => {
    meetingDetector.dismiss(appName)
    return true
  })
}
