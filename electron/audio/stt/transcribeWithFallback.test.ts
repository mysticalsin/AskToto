import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transcribeWithFallback, type TranscribeProvider } from './transcribeWithFallback.ts'

function provider(
  name: string,
  opts: {
    available?: boolean
    result?: string
    error?: Error
  } = {},
): TranscribeProvider {
  return {
    name,
    isAvailable: () => opts.available !== false,
    transcribe: async () => {
      if (opts.error) throw opts.error
      return opts.result ?? ''
    },
  }
}

test('returns preferred provider result on success, including silence', async () => {
  const text = await transcribeWithFallback(
    [provider('whisper-cloud', { result: 'hello' }), provider('whisper-local', { result: 'fallback' })],
    'whisper-cloud',
    Buffer.from('wav'),
    'auto',
  )
  assert.equal(text, 'hello')

  const silence = await transcribeWithFallback(
    [provider('whisper-cloud', { result: '' })],
    'whisper-cloud',
    Buffer.from('wav'),
    'auto',
  )
  assert.equal(silence, '')
})

test('falls back when preferred throws, then uses the next available provider', async () => {
  const text = await transcribeWithFallback(
    [
      provider('whisper-cloud', { error: new Error('cloud down') }),
      provider('whisper-local', { result: 'from local' }),
    ],
    'whisper-cloud',
    Buffer.from('wav'),
    'auto',
  )
  assert.equal(text, 'from local')
})

test('skips unavailable fallbacks', async () => {
  await assert.rejects(
    () =>
      transcribeWithFallback(
        [
          provider('whisper-cloud', { error: new Error('cloud down') }),
          provider('whisper-local', { available: false, result: 'should not run' }),
        ],
        'whisper-cloud',
        Buffer.from('wav'),
        'auto',
      ),
    /cloud down/,
  )
})

test('throws when every provider fails instead of returning empty string', async () => {
  await assert.rejects(
    () =>
      transcribeWithFallback(
        [
          provider('whisper-cloud', { error: new Error('401') }),
          provider('whisper-local', { error: new Error('ECONNREFUSED') }),
        ],
        'whisper-cloud',
        Buffer.from('wav'),
        'auto',
      ),
    /ECONNREFUSED/,
  )
})
