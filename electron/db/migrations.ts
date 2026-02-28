import type BetterSqlite3 from 'better-sqlite3'
import logger from '../services/Logger'

interface Migration {
  version: number
  description: string
  up: (db: BetterSqlite3.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — meetings, transcripts, ai_responses',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        started_at TEXT DEFAULT (datetime('now','localtime')),
        ended_at TEXT,
        duration_seconds INTEGER
      )`)

      db.exec(`CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        speaker TEXT DEFAULT 'unknown',
        text TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now','localtime')),
        is_final INTEGER DEFAULT 1,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )`)

      db.exec(`CREATE TABLE IF NOT EXISTS ai_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        query TEXT,
        response TEXT NOT NULL,
        provider TEXT,
        model TEXT,
        screenshot_path TEXT,
        timestamp TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )`)

      // Indexes for query performance
      db.exec('CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_responses_meeting ON ai_responses(meeting_id)')
      db.exec('CREATE INDEX IF NOT EXISTS idx_meetings_started ON meetings(started_at DESC)')
    },
  },
  {
    version: 2,
    description: 'RAG embeddings table',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        meeting_id INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )`)

      db.exec('CREATE INDEX IF NOT EXISTS idx_embeddings_meeting ON embeddings(meeting_id)')
    },
  },
]

/**
 * Run all pending migrations in a transaction.
 * Creates schema_version table if it doesn't exist.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
  // Ensure schema_version table exists
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL,
    description TEXT,
    applied_at TEXT DEFAULT (datetime('now','localtime'))
  )`)

  const getCurrentVersion = db.prepare('SELECT MAX(version) as v FROM schema_version')
  const current = getCurrentVersion.get() as { v: number | null } | undefined
  const currentVersion = current?.v || 0

  logger.info('DB', `Current schema version: ${currentVersion}`)

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      logger.info('DB', `Running migration v${migration.version}: ${migration.description}`)

      const runMigration = db.transaction(() => {
        migration.up(db)
        db.prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)').run(
          migration.version,
          migration.description
        )
      })

      runMigration()
      logger.info('DB', `Migration v${migration.version} complete`)
    }
  }
}
