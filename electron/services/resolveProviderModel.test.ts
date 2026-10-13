import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PROVIDER_MODELS,
  modelBelongsToProvider,
  resolveProviderModel,
} from './resolveProviderModel.ts'

describe('modelBelongsToProvider', () => {
  it('accepts native models and rejects foreign ones', () => {
    assert.equal(modelBelongsToProvider('openai', 'gpt-4o'), true)
    assert.equal(modelBelongsToProvider('openai', 'claude-sonnet-4-20250514'), false)
    assert.equal(modelBelongsToProvider('anthropic', 'claude-haiku-4-5-20251001'), true)
    assert.equal(modelBelongsToProvider('anthropic', 'gpt-4o'), false)
    assert.equal(modelBelongsToProvider('gemini', 'gemini-2.0-flash'), true)
    assert.equal(modelBelongsToProvider('gemini', 'gpt-4o'), false)
    assert.equal(modelBelongsToProvider('kimi', 'kimi-k2-0905-preview'), true)
    assert.equal(modelBelongsToProvider('kimi', 'moonshot-v1-128k'), true)
    assert.equal(modelBelongsToProvider('kimi', 'gpt-4o'), false)
  })
})

describe('resolveProviderModel', () => {
  it('keeps a matching custom model for the active provider', () => {
    assert.equal(
      resolveProviderModel('openai', 'openai', 'gpt-4o-mini'),
      'gpt-4o-mini',
    )
    assert.equal(
      resolveProviderModel('anthropic', 'anthropic', 'claude-haiku-4-5-20251001'),
      'claude-haiku-4-5-20251001',
    )
  })

  it('does not send gpt-4o to a non-OpenAI active provider (onboarding default)', () => {
    // Fresh install defaults: activeModel is gpt-4o even after picking Anthropic/Gemini/Kimi.
    assert.equal(
      resolveProviderModel('anthropic', 'anthropic', 'gpt-4o'),
      DEFAULT_PROVIDER_MODELS.anthropic,
    )
    assert.equal(
      resolveProviderModel('gemini', 'gemini', 'gpt-4o'),
      DEFAULT_PROVIDER_MODELS.gemini,
    )
    assert.equal(
      resolveProviderModel('kimi', 'kimi', 'gpt-4o'),
      DEFAULT_PROVIDER_MODELS.kimi,
    )
  })

  it('uses the provider default when requesting a non-active provider', () => {
    assert.equal(
      resolveProviderModel('anthropic', 'openai', 'gpt-4o'),
      DEFAULT_PROVIDER_MODELS.anthropic,
    )
    assert.equal(
      resolveProviderModel('openai', 'anthropic', 'claude-sonnet-4-20250514'),
      DEFAULT_PROVIDER_MODELS.openai,
    )
  })

  it('falls back when activeModel is missing', () => {
    assert.equal(resolveProviderModel('anthropic', 'anthropic', ''), DEFAULT_PROVIDER_MODELS.anthropic)
    assert.equal(resolveProviderModel('openai', 'openai', null), DEFAULT_PROVIDER_MODELS.openai)
    assert.equal(resolveProviderModel('gemini', 'gemini', undefined), DEFAULT_PROVIDER_MODELS.gemini)
  })
})
