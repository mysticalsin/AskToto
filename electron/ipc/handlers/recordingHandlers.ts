import { IpcMain, ipcMain as ipcMainModule } from 'electron'
import { WindowHelper } from '../../WindowHelper'
import { AudioManager } from '../../audio/AudioManager'
import { Database } from '../../db/database'
import { MeetingSession } from '../../services/MeetingSession'
import { MeetingDetector } from '../../services/MeetingDetector'
import logger from '../../services/Logger'
import { planRecordingToggle, recordingOpGate } from './recordingOpGate'

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

  const closeActiveMeeting = () => {
    if (!meetingSession.isActive || meetingSession.id == null) return
    try {
      database.endMeeting(meetingSession.id)
    } catch (err) {
      logger.error('Recording', 'Failed to end meeting in DB', err)
    }
    meetingSession.end()
  }

  const attachTranscriptCallback = () => {
    audioManager.setTranscriptCallback((text) => {
      windowHelper.sendToOverlay('transcript-update', text)
      if (meetingSession.isActive && meetingSession.id != null) {
        try {
          database.addTranscript(meetingSession.id, text)
        } catch (err) {
          logger.error('Recording', 'Failed to save transcript', err)
        }
      }
    })
  }

  ipcMain.handle('toggle-recording', async () => {
    if (!recordingOpGate.tryBegin()) {
      logger.warn('Recording', 'Toggle ignored — another recording operation is in flight')
      return audioManager.getIsRecording()
    }

    try {
      const overlayWindow = windowHelper.getOverlayWindow()
      const plan = planRecordingToggle({
        isRecording: audioManager.getIsRecording(),
        overlayAvailable: !!overlayWindow,
        activeMeetingId: meetingSession.id,
      })

      if (plan.action === 'skip') {
        return audioManager.getIsRecording()
      }

      if (plan.action === 'stop') {
        logger.info('Recording', 'Stopping recording')
        await audioManager.stop()
        meetingDetector.setRecordingState(false)
        closeActiveMeeting()
        windowHelper.sendToOverlay('recording-status', false)
        return false
      }

      logger.info('Recording', 'Starting recording')
      if (plan.endPreviousMeetingId != null) {
        logger.warn('Recording', `Closing still-active meeting ${plan.endPreviousMeetingId} before start`)
        closeActiveMeeting()
      }

      const meetingId = database.startMeeting()
      meetingSession.start(meetingId)
      attachTranscriptCallback()
      await audioManager.start(overlayWindow!)
      meetingDetector.setRecordingState(true)
      windowHelper.sendToOverlay('recording-status', true)
      return true
    } catch (err: any) {
      logger.error('Recording', 'Recording toggle failed', err)
      try {
        if (audioManager.getIsRecording()) {
          await audioManager.stop()
        }
      } catch (stopErr) {
        logger.error('Recording', 'Failed to stop capture after toggle error', stopErr)
      }
      meetingDetector.setRecordingState(false)
      closeActiveMeeting()
      windowHelper.sendToOverlay('recording-status', false)
      return false
    } finally {
      recordingOpGate.end()
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
