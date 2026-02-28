import BetterSqlite3 from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import logger from '../services/Logger'
import { runMigrations } from './migrations'

// ── Types ────────────────────────────────────────────────────────────
export interface Meeting {
  id: number
  title: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

export interface Transcript {
  id: number
  meeting_id: number
  speaker: string
  text: string
  timestamp: string
  is_final: number
}

export interface AIResponse {
  id: number
  meeting_id: number
  query: string | null
  response: string
  provider: string | null
  model: string | null
  screenshot_path: string | null
  timestamp: string
}

// ── Database Class ───────────────────────────────────────────────────
export class Database {
  private static instance: Database | null = null
  private db: BetterSqlite3.Database

  // Cached prepared statements for frequent queries
  private stmts!: {
    insertMeeting: BetterSqlite3.Statement
    lastInsertId: BetterSqlite3.Statement
    endMeeting: BetterSqlite3.Statement
    getMeetings: BetterSqlite3.Statement
    deleteMeetingTranscripts: BetterSqlite3.Statement
    deleteMeetingResponses: BetterSqlite3.Statement
    deleteMeetingEmbeddings: BetterSqlite3.Statement
    deleteMeeting: BetterSqlite3.Statement
    insertTranscript: BetterSqlite3.Statement
    getTranscripts: BetterSqlite3.Statement
    insertAIResponse: BetterSqlite3.Statement
    getAIResponses: BetterSqlite3.Statement
    countMeetings: BetterSqlite3.Statement
    sumDuration: BetterSqlite3.Statement
    countResponses: BetterSqlite3.Statement
  }

  constructor() {
    const dbDir = path.join(app.getPath('userData'), 'data')
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    const dbPath = path.join(dbDir, 'meetings.db')

    logger.info('DB', `Opening database at ${dbPath}`)

    this.db = new BetterSqlite3(dbPath)

    // Enable WAL mode for better concurrent read/write performance
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')

    // Run migrations
    runMigrations(this.db)

    // Prepare cached statements
    this.prepareStatements()

    logger.info('DB', 'Database initialized successfully')
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database()
    }
    return Database.instance
  }

  private prepareStatements() {
    this.stmts = {
      insertMeeting: this.db.prepare('INSERT INTO meetings (title) VALUES (?)'),
      lastInsertId: this.db.prepare('SELECT last_insert_rowid() as id'),
      endMeeting: this.db.prepare(`UPDATE meetings SET
        ended_at = datetime('now','localtime'),
        duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
        WHERE id = ?`),
      getMeetings: this.db.prepare('SELECT * FROM meetings ORDER BY started_at DESC LIMIT ?'),
      deleteMeetingTranscripts: this.db.prepare('DELETE FROM transcripts WHERE meeting_id = ?'),
      deleteMeetingResponses: this.db.prepare('DELETE FROM ai_responses WHERE meeting_id = ?'),
      deleteMeetingEmbeddings: this.db.prepare('DELETE FROM embeddings WHERE meeting_id = ?'),
      deleteMeeting: this.db.prepare('DELETE FROM meetings WHERE id = ?'),
      insertTranscript: this.db.prepare('INSERT INTO transcripts (meeting_id, text, speaker) VALUES (?, ?, ?)'),
      getTranscripts: this.db.prepare('SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY timestamp ASC'),
      insertAIResponse: this.db.prepare(
        'INSERT INTO ai_responses (meeting_id, query, response, provider, model, screenshot_path) VALUES (?, ?, ?, ?, ?, ?)'
      ),
      getAIResponses: this.db.prepare('SELECT * FROM ai_responses WHERE meeting_id = ? ORDER BY timestamp ASC'),
      countMeetings: this.db.prepare('SELECT COUNT(*) as count FROM meetings'),
      sumDuration: this.db.prepare('SELECT COALESCE(SUM(duration_seconds), 0) as total FROM meetings'),
      countResponses: this.db.prepare('SELECT COUNT(*) as count FROM ai_responses'),
    }
  }

  // ── Meetings ───────────────────────────────────────────────────────
  startMeeting(title?: string): number {
    this.stmts.insertMeeting.run(title || null)
    const result = this.stmts.lastInsertId.get() as { id: number }
    logger.info('DB', `Meeting ${result.id} created`)
    return result.id
  }

  endMeeting(meetingId: number): void {
    this.stmts.endMeeting.run(meetingId)
    logger.info('DB', `Meeting ${meetingId} ended`)
  }

  getMeetings(limit = 100): Meeting[] {
    return this.stmts.getMeetings.all(limit) as Meeting[]
  }

  deleteMeeting(meetingId: number): void {
    // Wrap in transaction for atomicity
    const deleteAll = this.db.transaction(() => {
      this.stmts.deleteMeetingTranscripts.run(meetingId)
      this.stmts.deleteMeetingResponses.run(meetingId)
      this.stmts.deleteMeetingEmbeddings.run(meetingId)
      this.stmts.deleteMeeting.run(meetingId)
    })
    deleteAll()
    logger.info('DB', `Meeting ${meetingId} deleted`)
  }

  // ── Transcripts ────────────────────────────────────────────────────
  addTranscript(meetingId: number, text: string, speaker?: string): void {
    this.stmts.insertTranscript.run(meetingId, text, speaker || 'unknown')
  }

  getTranscripts(meetingId: number): Transcript[] {
    return this.stmts.getTranscripts.all(meetingId) as Transcript[]
  }

  // ── AI Responses ───────────────────────────────────────────────────
  addAIResponse(meetingId: number, response: string, opts?: {
    query?: string; provider?: string; model?: string; screenshotPath?: string
  }): void {
    this.stmts.insertAIResponse.run(
      meetingId,
      opts?.query || null,
      response,
      opts?.provider || null,
      opts?.model || null,
      opts?.screenshotPath || null
    )
  }

  getAIResponses(meetingId: number): AIResponse[] {
    return this.stmts.getAIResponses.all(meetingId) as AIResponse[]
  }

  // ── Embeddings (for RAG) ───────────────────────────────────────────
  saveEmbedding(id: string, meetingId: number, chunkText: string, embedding: Buffer): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO embeddings (id, meeting_id, chunk_text, embedding) VALUES (?, ?, ?, ?)'
    ).run(id, meetingId, chunkText, embedding)
  }

  getEmbeddings(meetingId: number): { id: string; chunk_text: string; embedding: Buffer }[] {
    return this.db.prepare('SELECT id, chunk_text, embedding FROM embeddings WHERE meeting_id = ?')
      .all(meetingId) as any[]
  }

  getAllEmbeddings(): { id: string; meeting_id: number; chunk_text: string; embedding: Buffer }[] {
    return this.db.prepare('SELECT id, meeting_id, chunk_text, embedding FROM embeddings')
      .all() as any[]
  }

  // ── Stats ──────────────────────────────────────────────────────────
  getStats(): { totalMeetings: number; totalDuration: number; totalResponses: number } {
    const meetings = this.stmts.countMeetings.get() as { count: number }
    const duration = this.stmts.sumDuration.get() as { total: number }
    const responses = this.stmts.countResponses.get() as { count: number }
    return {
      totalMeetings: meetings.count,
      totalDuration: duration.total,
      totalResponses: responses.count,
    }
  }

  // ── Raw DB Access (for advanced queries) ───────────────────────────
  getRawDb(): BetterSqlite3.Database {
    return this.db
  }

  // ── Lifecycle ──────────────────────────────────────────────────────
  close(): void {
    logger.info('DB', 'Closing database')
    this.db.close()
    Database.instance = null
  }
}
