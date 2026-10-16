import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { appendTranscriptSegment } from './rollingTranscript.ts'

describe('appendTranscriptSegment', () => {
  it('persists only the new STT segment across cycles, not the growing window', () => {
    const persisted: string[] = []
    let overlay = ''

    for (const speech of ['Hello team', 'lets begin', 'action items next']) {
      const result = appendTranscriptSegment(overlay, speech)
      assert.ok(result)
      overlay = result.full
      persisted.push(result.segment)
    }

    assert.deepEqual(persisted, ['Hello team', 'lets begin', 'action items next'])
    assert.equal(overlay, 'Hello team lets begin action items next')
    assert.notEqual(persisted[1], overlay)
    assert.notEqual(persisted[2], overlay)
  })

  it('does not persist silence or whitespace-only STT results', () => {
    assert.equal(appendTranscriptSegment('hello', ''), null)
    assert.equal(appendTranscriptSegment('hello', '   '), null)
    assert.equal(appendTranscriptSegment('', '\n\t'), null)
  })

  it('truncates the overlay window without changing the persisted segment', () => {
    const previous = Array.from({ length: 8 }, (_, i) => `w${i}`).join(' ')
    const result = appendTranscriptSegment(previous, 'newest words here', 6)

    assert.ok(result)
    assert.equal(result.segment, 'newest words here')
    assert.equal(result.full, 'w5 w6 w7 newest words here')
    assert.notEqual(result.segment, result.full)
  })
})
