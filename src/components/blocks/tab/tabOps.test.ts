import { describe, expect, it } from 'vitest'
import { setTimeSignature } from './tabOps.ts'
import { createMeasure, createTabBlock } from '../../../model/factory.ts'
import { effectiveTimeSignature } from '../../../model/types.ts'

describe('setTimeSignature', () => {
  it('設定した小節以降に引き継がれ、明示設定した小節で切り替わる', () => {
    const block = createTabBlock()
    block.measures = [createMeasure(), createMeasure(), createMeasure(), createMeasure()]

    // 2小節目から 7/8 に変更、4小節目で 4/4 に戻す
    let next = setTimeSignature(block, 1, { beats: 7, beatUnit: 8 })
    next = setTimeSignature(next, 3, { beats: 4, beatUnit: 4 })

    const signatures = next.measures.map((_, i) => effectiveTimeSignature(next.measures, i))
    expect(signatures).toEqual([
      { beats: 4, beatUnit: 4 },
      { beats: 7, beatUnit: 8 },
      { beats: 7, beatUnit: 8 }, // 継承
      { beats: 4, beatUnit: 4 },
    ])
  })

  it('undefined で継承に戻せる', () => {
    const block = createTabBlock()
    block.measures = [createMeasure(), createMeasure()]
    let next = setTimeSignature(block, 1, { beats: 6, beatUnit: 8 })
    next = setTimeSignature(next, 1, undefined)
    expect(effectiveTimeSignature(next.measures, 1)).toEqual({ beats: 4, beatUnit: 4 })
    expect(next.measures[1]?.timeSignature).toBeUndefined()
  })
})
