import type { Duration, DurationBase, Measure, TimeSignature } from './types.ts'
import { add, frac, ZERO, type Fraction } from './fraction.ts'

export const DURATION_BASES: DurationBase[] = [1, 2, 4, 8, 16, 32, 64]

/** 音価を全音符 = 1 とした分数で返す(付点・連符を含めて厳密) */
export function durationValue(d: Duration): Fraction {
  // 付点: 1 + 1/2 + 1/4 ... = (2^(dots+1) - 1) / 2^dots
  const dotNum = 2 ** (d.dots + 1) - 1
  const dotDen = 2 ** d.dots
  let v = frac(dotNum, d.base * dotDen)
  if (d.tuplet) {
    v = frac(v.num * d.tuplet.normal, v.den * d.tuplet.actual)
  }
  return v
}

/** 拍子の小節容量(全音符 = 1) */
export function measureCapacity(ts: TimeSignature): Fraction {
  return frac(ts.beats, ts.beatUnit)
}

/** 小節内イベントの合計音価 */
export function measureUsed(measure: Measure): Fraction {
  return measure.events.reduce((acc, e) => add(acc, durationValue(e.duration)), ZERO)
}

/** 音価を半分に(64分で止まる) */
export function halveBase(base: DurationBase): DurationBase {
  const i = DURATION_BASES.indexOf(base)
  return DURATION_BASES[Math.min(i + 1, DURATION_BASES.length - 1)] ?? base
}

/** 音価を倍に(全音符で止まる) */
export function doubleBase(base: DurationBase): DurationBase {
  const i = DURATION_BASES.indexOf(base)
  return DURATION_BASES[Math.max(i - 1, 0)] ?? base
}

/** 連符を なし → 3連 → 5連 → 6連 → なし と循環 */
export function cycleTuplet(d: Duration): Duration {
  const order: (Duration['tuplet'] | undefined)[] = [
    undefined,
    { actual: 3, normal: 2 },
    { actual: 5, normal: 4 },
    { actual: 6, normal: 4 },
  ]
  const i = order.findIndex((t) => t?.actual === d.tuplet?.actual && t?.normal === d.tuplet?.normal)
  const next = order[(i + 1) % order.length]
  return { ...d, tuplet: next }
}
