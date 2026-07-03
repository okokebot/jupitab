import { describe, expect, it } from 'vitest'
import { doubleBase, durationValue, halveBase, measureCapacity, measureUsed } from './duration.ts'
import { eq, frac } from './fraction.ts'
import type { Measure } from './types.ts'

describe('durationValue', () => {
  it('基本音価', () => {
    expect(durationValue({ base: 4, dots: 0 })).toEqual(frac(1, 4))
    expect(durationValue({ base: 1, dots: 0 })).toEqual(frac(1, 1))
    expect(durationValue({ base: 64, dots: 0 })).toEqual(frac(1, 64))
  })

  it('付点・複付点', () => {
    // 付点4分 = 1/4 + 1/8 = 3/8
    expect(durationValue({ base: 4, dots: 1 })).toEqual(frac(3, 8))
    // 複付点4分 = 1/4 + 1/8 + 1/16 = 7/16
    expect(durationValue({ base: 4, dots: 2 })).toEqual(frac(7, 16))
  })

  it('3連符は誤差なく厳密', () => {
    // 8分3連 = 1/8 × 2/3 = 1/12
    const triplet = durationValue({ base: 8, dots: 0, tuplet: { actual: 3, normal: 2 } })
    expect(triplet).toEqual(frac(1, 12))
    // 3つ合わせるとちょうど4分音符
    const m: Measure = {
      id: 'm',
      events: Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        duration: { base: 8 as const, dots: 0 as const, tuplet: { actual: 3, normal: 2 } },
        notes: [],
      })),
    }
    expect(eq(measureUsed(m), frac(1, 4))).toBe(true)
  })

  it('付点付き連符も計算できる', () => {
    // 付点8分の3連 = 3/16 × 2/3 = 1/8
    expect(durationValue({ base: 8, dots: 1, tuplet: { actual: 3, normal: 2 } })).toEqual(frac(1, 8))
  })
})

describe('measure', () => {
  it('拍子の容量', () => {
    expect(measureCapacity({ beats: 4, beatUnit: 4 })).toEqual(frac(1, 1))
    expect(measureCapacity({ beats: 6, beatUnit: 8 })).toEqual(frac(3, 4))
    expect(measureCapacity({ beats: 7, beatUnit: 16 })).toEqual(frac(7, 16))
  })
})

describe('base の変更', () => {
  it('半分・倍(端で止まる)', () => {
    expect(halveBase(4)).toBe(8)
    expect(halveBase(64)).toBe(64)
    expect(doubleBase(4)).toBe(2)
    expect(doubleBase(1)).toBe(1)
  })
})
