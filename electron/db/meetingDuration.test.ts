import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { END_MEETING_SQL } from './meetingDuration.ts'

describe('END_MEETING_SQL', () => {
  it('computes duration from localtime on both sides, not UTC now vs local started_at', () => {
    assert.match(END_MEETING_SQL, /julianday\('now','localtime'\)/)
    assert.doesNotMatch(END_MEETING_SQL, /julianday\('now'\)\s*-/)
  })

  it('stores ~3600 seconds for a meeting that started one local hour ago', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE meetings (
      id INTEGER PRIMARY KEY,
      started_at TEXT,
      ended_at TEXT,
      duration_seconds INTEGER
    )`)
    db.prepare(`INSERT INTO meetings (id, started_at) VALUES (1, datetime('now','localtime','-3600 seconds'))`).run()
    db.prepare(END_MEETING_SQL).run(1)
    const row = db.prepare('SELECT duration_seconds, ended_at FROM meetings WHERE id = 1').get() as {
      duration_seconds: number
      ended_at: string
    }

    assert.ok(row.ended_at, 'ended_at should be set')
    assert.ok(
      Math.abs(row.duration_seconds - 3600) <= 2,
      `expected ~3600s, got ${row.duration_seconds}`
    )
  })

  it('old UTC-vs-local formula is wrong outside UTC (documents the bug)', () => {
    const db = new DatabaseSync(':memory:')
    const offsetHours = (
      db.prepare(`SELECT (julianday('now','localtime') - julianday('now')) * 24 AS hours`).get() as { hours: number }
    ).hours

    const buggy = (
      db.prepare(`SELECT CAST((julianday('now') - julianday(datetime('now','localtime','-3600 seconds'))) * 86400 AS INTEGER) AS d`).get() as { d: number }
    ).d

    if (Math.abs(offsetHours) < 0.01) {
      assert.ok(Math.abs(buggy - 3600) <= 2, 'UTC happens to be correct')
    } else {
      assert.ok(
        Math.abs(buggy - 3600) > 60,
        `expected timezone skew in buggy formula, got ${buggy}s with offset ${offsetHours}h`
      )
    }
  })
})
