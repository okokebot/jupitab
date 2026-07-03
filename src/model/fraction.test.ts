import { describe, expect, it } from 'vitest'
import { add, cmp, eq, frac, mul, toNumber } from './fraction.ts'

describe('fraction', () => {
  it('約分して正規化する', () => {
    expect(frac(2, 4)).toEqual({ num: 1, den: 2 })
    expect(frac(3, -6)).toEqual({ num: -1, den: 2 })
  })

  it('加算・乗算が厳密', () => {
    expect(add(frac(1, 3), frac(1, 6))).toEqual({ num: 1, den: 2 })
    expect(mul(frac(2, 3), frac(3, 4))).toEqual({ num: 1, den: 2 })
  })

  it('比較', () => {
    expect(cmp(frac(1, 3), frac(1, 4))).toBeGreaterThan(0)
    expect(eq(frac(2, 6), frac(1, 3))).toBe(true)
    expect(toNumber(frac(1, 4))).toBe(0.25)
  })

  it('ゼロ除算は例外', () => {
    expect(() => frac(1, 0)).toThrow()
  })
})
