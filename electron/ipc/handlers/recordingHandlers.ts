import { IpcMain, ipcMain as ipcMainModule } from 'electron'
import { WindowHelper } from '../../WindowHelper'
import { AudioManager } from '../../audio/AudioManager'
import { Database } from '../../db/database'
import { MeetingSession } from '../../services/MeetingSession'
import { MeetingDetector } from '../../services/MeetingDetector'
import logger from '../../services/Logger'
import { planResumeMeeting } from './resumeMeetingPlan'

interface RecordingDependencies {
  windowHelper: WindowHelper
  audioManager: AudioManager
  database: Database
  meetingSession: MeetingSession
  meetingDetector: MeetingDetector
}

export function registerRecordingHandlers(ipcMain: IpcMain, deps: RecordingDependencies) {
  const { windowHelper, audioManager, database, meetingSession, meetingDetector } = deps

  // CRITICAL-1 fix: Receive audio chunks from renderer (PCM Int16 data)
  ipcMainModule.on('audio-chunk', (_event, data: number[]) => {
    if (!audioManager.getIsRecording()) return
    const buffer = Buffer.from(new Int16Array(data).buffer)
    audioManager.addAudioChunk(buffer)
  })

  ipcMain.handle('toggle-recording', async () => {
    const overlayWindow = windowHelper.getOverlayWindow()
    if (!overlayWindow) return false

    try {
      if (audioManager.getIsRecording()) {
        // Stop recording
        logger.info('Recording', 'Stopping recording')
        await audioManager.stop()
        meetingDetector.setRecordingState(false)

        if (meetingSession.isActive) {
          try {
            database.endMeeting(meetingSession.id!)
          } catch (err) {
            logger.error('Recording', 'Failed to end meeting in DB', err)
          }
          meetingSession.end()
        }

        windowHelper.sendToOverlay('recording-status', false)
        return false
      } else {
        // Start recording
        logger.info('Recording', 'Starting recording')
        const meetingId = database.startMeeting()
        meetingSession.start(meetingId)

        audioManager.setTranscriptCallback((text) => {
          windowHelper.sendToOverlay('transcript-update', text)
          if (meetingSession.isActive) {
            try {
              database.addTranscript(meetingSession.id!, text)
            } catch (err) {
              logger.error('Recording', 'Failed to save transcript', err)
            }
          }
        })

        await audioManager.start(overlayWindow)
        meetingDetector.setRecordingState(true)
        windowHelper.sendToOverlay('recording-status', true)
        return true
      }
    } catch (err: any) {
      logger.error('Recording', 'Recording toggle failed', err)
      windowHelper.sendToOverlay('recording-status', false)
      return false
    }
  })

  ipcMain.handle('resume-meeting', async (_event, meetingId: unknown) => {
    const overlayWindow = windowHelper.getOverlayWindow()
    const parsedId = typeof meetingId === 'number' ? meetingId : Number(meetingId)
    const existing = Number.isInteger(parsedId) && parsedId > 0
      ? database.getMeeting(parsedId)
      : undefined

    const plan = planResumeMeeting({
      meetingId,
      isRecording: audioManager.getIsRecording(),
      overlayAvailable: !!overlayWindow,
      meetingExists: !!existing,
    })

    if (plan.action === 'noop') {
      logger.warn('Recording', `Resume ignored — ${plan.reason} (meeting ${meetingId})`)
      return { ok: false, reason: plan.reason }
    }

    try {
      database.reopenMeeting(plan.meetingId)
      meetingSession.start(plan.meetingId)

      audioManager.setTranscriptCallback((text) => {
        windowHelper.sendToOverlay('transcript-update', text)
        if (meetingSession.isActive) {
          try {
            database.addTranscript(meetingSession.id!, text)
          } catch (err) {
            logger.error('Recording', 'Failed to save transcript', err)
          }
        }
      })

      await audioManager.start(overlayWindow!)
      meetingDetector.setRecordingState(true)
      windowHelper.sendToOverlay('recording-status', true)
      logger.info('Recording', `Resumed meeting ${plan.meetingId}`)
      return { ok: true, meetingId: plan.meetingId }
    } catch (err) {
      logger.error('Recording', 'Failed to resume meeting', err)
      try {
        if (meetingSession.id === plan.meetingId) {
          database.endMeeting(plan.meetingId)
          meetingSession.end()
        }
      } catch (endErr) {
        logger.error('Recording', 'Failed to roll back resumed meeting', endErr)
      }
      windowHelper.sendToOverlay('recording-status', false)
      return { ok: false, reason: 'start-failed' }
    }
  })

  ipcMain.handle('start-meeting', async (_event, title?: string) => {
    const meetingId = database.startMeeting(title)
    meetingSession.start(meetingId)
    return meetingId
  })

  ipcMain.handle('end-meeting', async () => {
    if (meetingSession.isActive) {
      try {
        database.endMeeting(meetingSession.id!)
      } catch (err) {
        logger.error('Recording', 'Failed to end meeting', err)
      }
      meetingSession.end()
    }
    return true
  })

  // MAJOR-9 fix: get-audio-devices handler (avoids hanging promise)
  ipcMain.handle('get-audio-devices', async () => {
    return []
  })
}
