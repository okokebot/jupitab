import { describe, expect, it } from 'vitest'
import { createRhythmSampleTabBlock } from './samples.ts'
import { measureCapacity, measureUsed } from './duration.ts'
import { eq } from './fraction.ts'
import { effectiveTimeSignature } from './types.ts'

describe('リズムサンプル', () => {
  it('全小節がちょうど実効拍子(4/4・6/8・7/8)に収まる', () => {
    const block = createRhythmSampleTabBlock()
    block.measures.forEach((m, i) => {
      const ts = effectiveTimeSignature(block.measures, i)
      expect(
        eq(measureUsed(m), measureCapacity(ts)),
        `小節 ${i + 1} の合計音価が ${ts.beats}/${ts.beatUnit} と一致しない: ${JSON.stringify(measureUsed(m))}`,
      ).toBe(true)
    })
  })

  it('変拍子の小節を含む(6/8・7/8)', () => {
    const block = createRhythmSampleTabBlock()
    const signatures = block.measures.map((_, i) => effectiveTimeSignature(block.measures, i))
    expect(signatures).toContainEqual({ beats: 6, beatUnit: 8 })
    expect(signatures).toContainEqual({ beats: 7, beatUnit: 8 })
  })

  it('タイは同じ弦の直前の音に繋がっている', () => {
    const block = createRhythmSampleTabBlock()
    for (const m of block.measures) {
      m.events.forEach((e, i) => {
        for (const n of e.notes) {
          if (!n.tieToPrev) continue
          const prev = m.events[i - 1]
          expect(prev?.notes.some((p) => p.string === n.string)).toBe(true)
        }
      })
    }
  })
})
