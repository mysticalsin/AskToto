import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CLOUD_STT_REQUIRES_OPENAI, getSttReadiness } from './sttReadiness.ts'

describe('getSttReadiness', () => {
  it('allows cloud STT when an OpenAI key is present', () => {
    assert.deepEqual(getSttReadiness('cloud', true), { ok: true })
  })

  it('blocks cloud STT when no OpenAI key is set', () => {
    assert.deepEqual(getSttReadiness('cloud', false), {
      ok: false,
      reason: CLOUD_STT_REQUIRES_OPENAI,
    })
  })

  it('treats missing/default mode as cloud', () => {
    assert.equal(getSttReadiness('', false).ok, false)
    assert.equal(getSttReadiness('cloud', false).ok, false)
  })

  it('allows local STT without an OpenAI key', () => {
    assert.deepEqual(getSttReadiness('local', false), { ok: true })
  })
})
