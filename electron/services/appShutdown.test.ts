import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { performShutdown } from './appShutdown.ts'

describe('performShutdown', () => {
  it('stops recording, then ends the meeting, then closes the database', async () => {
    const order: string[] = []
    await performShutdown({
      stopRecording: async () => {
        order.push('stop')
      },
      endActiveMeeting: () => {
        order.push('end')
      },
      closeDatabase: () => {
        order.push('close')
      },
    })
    assert.deepEqual(order, ['stop', 'end', 'close'])
  })

  it('still ends the meeting and closes the DB if stop throws', async () => {
    const order: string[] = []
    await performShutdown({
      stopRecording: async () => {
        order.push('stop')
        throw new Error('STT hung')
      },
      endActiveMeeting: () => {
        order.push('end')
      },
      closeDatabase: () => {
        order.push('close')
      },
    })
    assert.deepEqual(order, ['stop', 'end', 'close'])
  })

  it('still closes the DB if endMeeting throws', async () => {
    const order: string[] = []
    await performShutdown({
      stopRecording: async () => {
        order.push('stop')
      },
      endActiveMeeting: () => {
        order.push('end')
        throw new Error('already closed')
      },
      closeDatabase: () => {
        order.push('close')
      },
    })
    assert.deepEqual(order, ['stop', 'end', 'close'])
  })

  it('does not wait forever if stop hangs', async () => {
    const order: string[] = []
    const started = Date.now()
    await performShutdown({
      stopTimeoutMs: 40,
      stopRecording: () => new Promise(() => {}),
      endActiveMeeting: () => {
        order.push('end')
      },
      closeDatabase: () => {
        order.push('close')
      },
    })
    assert.ok(Date.now() - started < 500)
    assert.deepEqual(order, ['end', 'close'])
  })

  it('unregisters shortcuts and stops detection before flushing audio', async () => {
    const order: string[] = []
    await performShutdown({
      unregisterShortcuts: () => {
        order.push('shortcuts')
      },
      stopMeetingDetector: () => {
        order.push('detector')
      },
      stopRecording: async () => {
        order.push('stop')
      },
      endActiveMeeting: () => {
        order.push('end')
      },
      closeDatabase: () => {
        order.push('close')
      },
      destroyTray: () => {
        order.push('tray')
      },
    })
    assert.deepEqual(order, ['shortcuts', 'detector', 'stop', 'end', 'close', 'tray'])
  })
})
