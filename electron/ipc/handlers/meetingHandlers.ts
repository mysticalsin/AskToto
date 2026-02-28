import { IpcMain } from 'electron'
import { Database } from '../../db/database'
import logger from '../../services/Logger'

export function registerMeetingHandlers(ipcMain: IpcMain, database: Database) {
  ipcMain.handle('meetings:list', () => {
    try {
      return database.getMeetings()
    } catch (err) {
      logger.error('Meetings', 'Failed to list meetings', err)
      return []
    }
  })

  ipcMain.handle('meetings:transcripts', (_event, meetingId: number) => {
    try {
      return database.getTranscripts(meetingId)
    } catch (err) {
      logger.error('Meetings', `Failed to get transcripts for meeting ${meetingId}`, err)
      return []
    }
  })

  ipcMain.handle('meetings:responses', (_event, meetingId: number) => {
    try {
      return database.getAIResponses(meetingId)
    } catch (err) {
      logger.error('Meetings', `Failed to get responses for meeting ${meetingId}`, err)
      return []
    }
  })
}
