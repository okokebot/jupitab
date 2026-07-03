import { describe, expect, it } from 'vitest'
import {
  degreeInKey,
  isInScale,
  noteName,
  pitchClassName,
  pitchFromTab,
  scalePitchClasses,
  STANDARD_TUNING,
} from './theory.ts'

describe('pitchFromTab', () => {
  it('開放弦は tuning そのまま', () => {
    expect(pitchFromTab(STANDARD_TUNING, 1, 0)).toBe(64) // 1弦開放 = E4
    expect(pitchFromTab(STANDARD_TUNING, 6, 0)).toBe(40) // 6弦開放 = E2
  })

  it('フレットとカポを加算', () => {
    expect(pitchFromTab(STANDARD_TUNING, 6, 5)).toBe(45) // 6弦5F = A2 = 5弦開放
    expect(pitchFromTab(STANDARD_TUNING, 2, 1, 2)).toBe(62) // カポ2 + 2弦1F = D4
  })

  it('不正な弦番号は例外', () => {
    expect(() => pitchFromTab(STANDARD_TUNING, 7, 0)).toThrow()
  })
})

describe('音名', () => {
  it('MIDI 60 = C4、シャープ/フラット表記', () => {
    expect(noteName(60)).toBe('C4')
    expect(noteName(63)).toBe('D#4')
    expect(noteName(63, true)).toBe('E♭4')
    expect(pitchClassName(10, true)).toBe('B♭')
  })
})

describe('スケールと度数', () => {
  const aMinorPenta = { tonic: 9, scale: 'minorPentatonic' as const }

  it('Am ペンタの構成音 = A C D E G', () => {
    expect([...scalePitchClasses(aMinorPenta)].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9])
  })

  it('度数ラベル', () => {
    expect(degreeInKey(9, aMinorPenta)).toBe('R')
    expect(degreeInKey(0, aMinorPenta)).toBe('♭3')
    expect(degreeInKey(4, aMinorPenta)).toBe('5')
    expect(degreeInKey(8, aMinorPenta)).toBe('7') // 非構成音でも度数は出る
  })

  it('スケール判定', () => {
    expect(isInScale(0, aMinorPenta)).toBe(true) // C
    expect(isInScale(1, aMinorPenta)).toBe(false) // C#
  })
})
