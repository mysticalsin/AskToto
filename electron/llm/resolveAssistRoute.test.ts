import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAssistProvider } from './resolveAssistRoute.ts'

describe('resolveAssistProvider', () => {
  it('uses the Settings active provider, not a stale overlay value', () => {
    assert.equal(resolveAssistProvider('anthropic', 'openai'), 'anthropic')
    assert.equal(resolveAssistProvider('gemini', 'openai'), 'gemini')
    assert.equal(resolveAssistProvider('kimi', 'anthropic'), 'kimi')
  })

  it('keeps the Settings provider when the overlay omits one', () => {
    assert.equal(resolveAssistProvider('anthropic'), 'anthropic')
    assert.equal(resolveAssistProvider('openai', undefined), 'openai')
  })

  it('falls back to openai when Settings has no provider', () => {
    assert.equal(resolveAssistProvider(undefined, 'gemini'), 'openai')
    assert.equal(resolveAssistProvider('', 'gemini'), 'openai')
    assert.equal(resolveAssistProvider('not-a-provider', 'kimi'), 'openai')
  })
})
