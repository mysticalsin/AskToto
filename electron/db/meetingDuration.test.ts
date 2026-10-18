import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { END_MEETING_SQL } from './meetingDuration.ts'

describe('END_MEETING_SQL', () => {
  it('computes duration from localtime on both sides, not UTC now vs local started_at', () => {
    assert.match(END_MEETING_SQL, /julianday\('now','localtime'\)/)
    assert.doesNotMatch(END_MEETING_SQL, /julianday\('now'\)\s*-/)
  })

  it('stores ~3600s for a one-hour localtime meeting', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER
    )`)
    db.prepare(
      `INSERT INTO meetings (started_at) VALUES (datetime('now','localtime','-3600 seconds'))`
    ).run()
    db.prepare(END_MEETING_SQL).run(1)

    const row = db.prepare('SELECT duration_seconds FROM meetings WHERE id = 1').get() as {
      duration_seconds: number
    }
    assert.ok(
      Math.abs(row.duration_seconds - 3600) <= 2,
      `expected ~3600s, got ${row.duration_seconds}`
    )
    db.close()
  })

  it('documents that UTC now minus local started_at skews by the timezone offset', () => {
    const db = new DatabaseSync(':memory:')
    const offsetHours = (
      db.prepare(
        `SELECT (julianday('now','localtime') - julianday('now')) * 24 AS hours`
      ).get() as { hours: number }
    ).hours

    const buggy = (
      db.prepare(
        `SELECT CAST((julianday('now') - julianday(datetime('now','localtime','-3600 seconds'))) * 86400 AS INTEGER) AS d`
      ).get() as { d: number }
    ).d

    const expectedBuggy = 3600 - Math.round(offsetHours * 3600)
    assert.ok(
      Math.abs(buggy - expectedBuggy) <= 2,
      `buggy formula should be ~${expectedBuggy}s (3600 minus UTC offset), got ${buggy}`
    )
    db.close()
  })
})
