import logger from './Logger'

/**
 * Tracks the currently active meeting session.
 * Replaces the old global `currentMeetingId` variable in ipcHandlers.ts.
 */
export class MeetingSession {
  private currentMeetingId: number | null = null

  get id(): number | null {
    return this.currentMeetingId
  }

  get isActive(): boolean {
    return this.currentMeetingId !== null
  }

  start(meetingId: number): void {
    if (this.currentMeetingId !== null) {
      logger.warn('MeetingSession', `Starting new meeting ${meetingId} while meeting ${this.currentMeetingId} is still active`)
    }
    this.currentMeetingId = meetingId
    logger.info('MeetingSession', `Meeting ${meetingId} started`)
  }

  end(): number | null {
    const id = this.currentMeetingId
    this.currentMeetingId = null
    if (id !== null) {
      logger.info('MeetingSession', `Meeting ${id} ended`)
    }
    return id
  }
}
