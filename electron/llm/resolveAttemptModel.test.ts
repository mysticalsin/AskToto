import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PROVIDER_MODELS,
  resolveAttemptModel,
} from './resolveAttemptModel.ts'
import type { ProviderName } from './types.ts'

describe('resolveAttemptModel', () => {
  it('keeps the requested model for the preferred provider', () => {
    assert.equal(
      resolveAttemptModel('openai', 'openai', 'gpt-4o-mini'),
      'gpt-4o-mini'
    )
  })

  it('does not send the preferred provider model to fallback providers', () => {
    const preferredModel = 'gpt-4o'
    const fallbacks: ProviderName[] = ['anthropic', 'gemini', 'kimi']

    for (const provider of fallbacks) {
      const model = resolveAttemptModel(provider, 'openai', preferredModel)
      assert.notEqual(
        model,
        preferredModel,
        `${provider} must not inherit ${preferredModel}`
      )
      assert.equal(model, DEFAULT_PROVIDER_MODELS[provider])
    }
  })

  it('uses each provider default when the preferred request has no model', () => {
    assert.equal(resolveAttemptModel('openai', 'openai', undefined), 'gpt-4o')
    assert.equal(
      resolveAttemptModel('anthropic', 'openai', undefined),
      DEFAULT_PROVIDER_MODELS.anthropic
    )
  })

  it('honors a custom modelForProvider lookup on fallback', () => {
    const models: Record<ProviderName, string> = {
      openai: 'gpt-4.1',
      anthropic: 'claude-haiku-4-5-20251001',
      gemini: 'gemini-2.0-pro',
      kimi: 'kimi-k2.5',
    }

    assert.equal(
      resolveAttemptModel('anthropic', 'openai', 'gpt-4o', (p) => models[p]),
      'claude-haiku-4-5-20251001'
    )
  })
})
