import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { drainRecordingStop } from './drainRecordingStop.ts'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('drainRecordingStop', () => {
  it('flushes immediately when nothing is in-flight', async () => {
    const order: string[] = []
    await drainRecordingStop({
      inFlight: null,
      flush: async () => {
        order.push('flush')
      },
    })
    assert.deepEqual(order, ['flush'])
  })

  it('waits for in-flight STT before flushing leftover PCM', async () => {
    const inFlight = deferred()
    const order: string[] = []

    const drain = drainRecordingStop({
      inFlight: inFlight.promise.then(() => {
        order.push('stt')
      }),
      flush: async () => {
        order.push('flush')
      },
    })

    await Promise.resolve()
    assert.deepEqual(order, [])

    inFlight.resolve()
    await drain
    assert.deepEqual(order, ['stt', 'flush'])
  })

  it('still flushes leftover audio if in-flight STT exceeds the timeout', async () => {
    const hung = new Promise<void>(() => {})
    const order: string[] = []

    await drainRecordingStop({
      inFlight: hung,
      timeoutMs: 5,
      timeout: async () => {
        order.push('timeout')
      },
      flush: async () => {
        order.push('flush')
      },
    })

    assert.deepEqual(order, ['timeout', 'flush'])
  })
})
