import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { kimiModelAcceptsImages } from './kimiVision.ts'

describe('kimiModelAcceptsImages', () => {
  it('rejects the default K2 model used by Settings and onboarding', () => {
    assert.equal(kimiModelAcceptsImages('kimi-k2-0905-preview'), false)
  })

  it('rejects other text-only K2 / moonshot ids in the settings dropdown', () => {
    assert.equal(kimiModelAcceptsImages('kimi-k2.5'), false)
    assert.equal(kimiModelAcceptsImages('moonshot-v1-128k'), false)
    assert.equal(kimiModelAcceptsImages('kimi-k2-turbo-preview'), false)
    assert.equal(kimiModelAcceptsImages('kimi-k2-thinking'), false)
  })

  it('accepts explicit vision models and K3 / late-K2 multimodal ids', () => {
    assert.equal(kimiModelAcceptsImages('moonshot-v1-128k-vision-preview'), true)
    assert.equal(kimiModelAcceptsImages('kimi-k3.1-pro'), true)
    assert.equal(kimiModelAcceptsImages('kimi-k3'), true)
    assert.equal(kimiModelAcceptsImages('kimi-k2.6'), true)
    assert.equal(kimiModelAcceptsImages('kimi-k2.7-code'), true)
  })

  it('rejects empty or unknown ids so Assist still sends text-only', () => {
    assert.equal(kimiModelAcceptsImages(''), false)
    assert.equal(kimiModelAcceptsImages('not-a-real-model'), false)
  })
})
