import { IpcMain } from 'electron'
import { WindowHelper } from '../../WindowHelper'
import { AudioManager } from '../../audio/AudioManager'
import { Database } from '../../db/database'
import { MeetingSession } from '../../services/MeetingSession'
import { MeetingDetector } from '../../services/MeetingDetector'
import logger from '../../services/Logger'
import { planRecordingToggle, recordingOpGate } from './recordingOpGate'

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

    if (!recordingOpGate.tryBegin()) {
      logger.warn('MeetingDetection', 'Accept ignored — another recording operation is in flight')
      return audioManager.getIsRecording()
    }

    try {
      const overlayWindow = windowHelper.getOverlayWindow()
      const plan = planRecordingToggle({
        isRecording: audioManager.getIsRecording(),
        overlayAvailable: !!overlayWindow,
        activeMeetingId: meetingSession.id,
      })

      if (plan.action !== 'start') {
        return audioManager.getIsRecording()
      }

      const label = MeetingDetector.getAppLabel(appName)
      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const title = `${label} — ${date}`

      if (plan.endPreviousMeetingId != null) {
        logger.warn('MeetingDetection', `Closing still-active meeting ${plan.endPreviousMeetingId} before start`)
        try {
          database.endMeeting(plan.endPreviousMeetingId)
        } catch (err) {
          logger.error('MeetingDetection', 'Failed to end previous meeting', err)
        }
        if (meetingSession.id === plan.endPreviousMeetingId) {
          meetingSession.end()
        }
      }

      const meetingId = database.startMeeting(title)
      meetingSession.start(meetingId)

      audioManager.setTranscriptCallback((text) => {
        windowHelper.sendToOverlay('transcript-update', text)
        if (meetingSession.isActive && meetingSession.id != null) {
          try {
            database.addTranscript(meetingSession.id, text)
          } catch (err) {
            logger.error('MeetingDetection', 'Transcript save failed', err)
          }
        }
      })

      await audioManager.start(overlayWindow!)
      meetingDetector.setRecordingState(true)
      windowHelper.sendToOverlay('recording-status', true)

      logger.info('MeetingDetection', `Recording started from detection: ${title}`)
      return true
    } catch (err) {
      logger.error('MeetingDetection', 'Failed to start recording from detection', err)
      try {
        if (audioManager.getIsRecording()) {
          await audioManager.stop()
        }
      } catch (stopErr) {
        logger.error('MeetingDetection', 'Failed to stop capture after accept error', stopErr)
      }
      meetingDetector.setRecordingState(false)
      if (meetingSession.isActive && meetingSession.id != null) {
        try {
          database.endMeeting(meetingSession.id)
        } catch (endErr) {
          logger.error('MeetingDetection', 'Failed to roll back meeting after accept error', endErr)
        }
        meetingSession.end()
      }
      windowHelper.sendToOverlay('recording-status', false)
      return false
    } finally {
      recordingOpGate.end()
    }
  })

  // User dismissed the banner
  ipcMain.handle('meeting-detection:dismiss', async (_event, appName: string) => {
    meetingDetector.dismiss(appName)
    return true
  })
}
