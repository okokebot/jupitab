import { describe, expect, it } from 'vitest'
import {
  degreeInKey,
  isCharacteristicTone,
  isInScale,
  noteName,
  pitchClassName,
  pitchFromTab,
  scalePitchClasses,
  scalePositions,
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

describe('isCharacteristicTone(モーダル特徴音)', () => {
  const dDorian = { tonic: 2, scale: 'dorian' as const }
  const aDorian = { tonic: 9, scale: 'dorian' as const }

  it('ドリアンではルートから 9 半音(6 度)のみが特徴音', () => {
    expect(isCharacteristicTone(11, dDorian)).toBe(true) // B
    expect(degreeInKey(11, dDorian)).toBe('6')

    expect(isCharacteristicTone(2, dDorian)).toBe(false) // R
    expect(isCharacteristicTone(4, dDorian)).toBe(false) // ♭3
    expect(isCharacteristicTone(7, dDorian)).toBe(false) // 5
    expect(isCharacteristicTone(9, dDorian)).toBe(false) // ♭7
    expect(isCharacteristicTone(8, dDorian)).toBe(false) // ♭6(ナチュラルマイナー側)
  })

  it('ルートが変わっても相対度数で判定する', () => {
    expect(isCharacteristicTone(6, aDorian)).toBe(true) // F# = A の 6 度
    expect(degreeInKey(6, aDorian)).toBe('6')
    expect(isCharacteristicTone(9, aDorian)).toBe(false) // R
  })

  it('ミクソリディアンではルートから 10 半音(♭7)のみが特徴音', () => {
    const gMixolydian = { tonic: 7, scale: 'mixolydian' as const }
    expect(isCharacteristicTone(5, gMixolydian)).toBe(true) // F
    expect(degreeInKey(5, gMixolydian)).toBe('♭7')

    expect(isCharacteristicTone(7, gMixolydian)).toBe(false) // R
    expect(isCharacteristicTone(11, gMixolydian)).toBe(false) // 5
    expect(isCharacteristicTone(6, gMixolydian)).toBe(false) // 7(メジャー側)
  })

  it('同じルートでもメジャーでは ♭7 は特徴音にならない', () => {
    const gMajor = { tonic: 7, scale: 'major' as const }
    expect(isCharacteristicTone(5, gMajor)).toBe(false) // ♭7
    expect(degreeInKey(5, gMajor)).toBe('♭7')
    expect(isCharacteristicTone(6, gMajor)).toBe(false) // 7
    expect(degreeInKey(6, gMajor)).toBe('7')
  })

  it('モーダル以外のスケールでは常に false', () => {
    const scales = [
      'major',
      'naturalMinor',
      'harmonicMinor',
      'melodicMinor',
      'majorPentatonic',
      'minorPentatonic',
      'blues',
    ] as const
    for (const scale of scales) {
      const key = { tonic: 2, scale }
      expect(isCharacteristicTone(11, key)).toBe(false)
      expect(isCharacteristicTone(0, key)).toBe(false) // ♭7 相当
    }
  })

  it('同じルートでもナチュラルマイナーでは 6 度は特徴音にならない', () => {
    const dNaturalMinor = { tonic: 2, scale: 'naturalMinor' as const }
    expect(isCharacteristicTone(10, dNaturalMinor)).toBe(false) // ♭6
    expect(degreeInKey(10, dNaturalMinor)).toBe('♭6')
    expect(isCharacteristicTone(11, dNaturalMinor)).toBe(false) // 6(ドリアン側の特徴音)
    expect(degreeInKey(11, dNaturalMinor)).toBe('6')
  })
})

describe('scalePositions(指板図の自動マーキング)', () => {
  const aMinorPenta = { tonic: 9, scale: 'minorPentatonic' as const }
  const has = (ps: ReturnType<typeof scalePositions>, string: number, fret: number) =>
    ps.some((p) => p.string === string && p.fret === fret)

  it('標準チューニング 0〜12F: 既知位置を含み、非構成音を含まない', () => {
    const ps = scalePositions(STANDARD_TUNING, 0, 12, aMinorPenta)
    expect(has(ps, 6, 5)).toBe(true) // 6弦5F = A(ルート)
    expect(ps.find((p) => p.string === 6 && p.fret === 5)?.isRoot).toBe(true)
    expect(has(ps, 1, 0)).toBe(true) // 1弦開放 E = 5度
    expect(ps.find((p) => p.string === 1 && p.fret === 0)?.isRoot).toBe(false)
    expect(has(ps, 2, 1)).toBe(true) // 2弦1F = C(♭3)
    expect(has(ps, 6, 1)).toBe(false) // 6弦1F = F は非構成音
  })

  it('fretStart > 0 では開放弦と fretStart 以下のフレットを含まない', () => {
    const ps = scalePositions(STANDARD_TUNING, 5, 12, aMinorPenta)
    expect(ps.length).toBeGreaterThan(0)
    expect(ps.every((p) => p.fret > 5 && p.fret <= 12)).toBe(true)
    expect(has(ps, 6, 5)).toBe(false) // 6弦5F(A)は表示範囲の左外
    expect(has(ps, 6, 8)).toBe(true) // 6弦8F = C は範囲内
  })

  it('変則チューニング(ドロップ D)では 6弦の位置がずれる', () => {
    const dropD = [64, 59, 55, 50, 45, 38]
    const std = scalePositions(STANDARD_TUNING, 0, 12, aMinorPenta)
    const drop = scalePositions(dropD, 0, 12, aMinorPenta)
    expect(has(std, 6, 3)).toBe(true) // 標準: 6弦3F = G(構成音)
    expect(has(drop, 6, 3)).toBe(false) // ドロップD: 6弦3F = F(非構成音)
    expect(drop.find((p) => p.string === 6 && p.fret === 7)?.isRoot).toBe(true) // D+7 = A
    expect(has(drop, 6, 0)).toBe(true) // 開放 D は構成音(4度)
  })

  it('isRoot の位置はすべてピッチクラスが tonic に一致する', () => {
    const ps = scalePositions(STANDARD_TUNING, 0, 12, aMinorPenta)
    const roots = ps.filter((p) => p.isRoot)
    expect(roots.length).toBeGreaterThan(0)
    for (const p of roots) expect(p.pc).toBe(9)
  })

  it('ドリアンでは 6 度(長6)のみが特徴音としてマークされる', () => {
    const dDorian = { tonic: 2, scale: 'dorian' as const }
    const ps = scalePositions(STANDARD_TUNING, 0, 12, dDorian)
    const chars = ps.filter((p) => p.isCharacteristic)

    expect(chars.length).toBeGreaterThan(0)
    expect(chars.every((p) => p.pc === 11)).toBe(true)
    expect(chars.every((p) => !p.isRoot)).toBe(true)
    expect(chars.every((p) => degreeInKey(p.pc, dDorian) === '6')).toBe(true)

    // 指板上の既知位置: 2弦開放 = B(6 度)
    expect(ps.find((p) => p.string === 2 && p.fret === 0)?.isCharacteristic).toBe(true)
    // 3弦4F = B(6 度)
    expect(ps.find((p) => p.string === 3 && p.fret === 4)?.isCharacteristic).toBe(true)
    // 6弦10F = D(ルート)は特徴音ではない
    expect(ps.find((p) => p.string === 6 && p.fret === 10)?.isCharacteristic).toBe(false)
    expect(ps.find((p) => p.string === 6 && p.fret === 10)?.isRoot).toBe(true)
  })

  it('ドリアンでは特徴音のピッチクラスは 1 種類だけ', () => {
    const dDorian = { tonic: 2, scale: 'dorian' as const }
    const ps = scalePositions(STANDARD_TUNING, 0, 12, dDorian)
    const charPcs = new Set(ps.filter((p) => p.isCharacteristic).map((p) => p.pc))
    expect([...charPcs]).toEqual([11])
  })

  it('ミクソリディアンでは ♭7 のみが特徴音としてマークされる', () => {
    const gMixolydian = { tonic: 7, scale: 'mixolydian' as const }
    const ps = scalePositions(STANDARD_TUNING, 0, 12, gMixolydian)
    const chars = ps.filter((p) => p.isCharacteristic)

    expect(chars.length).toBeGreaterThan(0)
    expect(chars.every((p) => p.pc === 5)).toBe(true) // F
    expect(chars.every((p) => !p.isRoot)).toBe(true)
    expect(chars.every((p) => degreeInKey(p.pc, gMixolydian) === '♭7')).toBe(true)

    // 4弦3F = F(♭7)
    expect(ps.find((p) => p.string === 4 && p.fret === 3)?.isCharacteristic).toBe(true)
    // 6弦3F = G(ルート)は特徴音ではない
    expect(ps.find((p) => p.string === 6 && p.fret === 3)?.isCharacteristic).toBe(false)
    expect(ps.find((p) => p.string === 6 && p.fret === 3)?.isRoot).toBe(true)
  })

  it('ミクソリディアンでは特徴音のピッチクラスは 1 種類だけ', () => {
    const gMixolydian = { tonic: 7, scale: 'mixolydian' as const }
    const ps = scalePositions(STANDARD_TUNING, 0, 12, gMixolydian)
    const charPcs = new Set(ps.filter((p) => p.isCharacteristic).map((p) => p.pc))
    expect([...charPcs]).toEqual([5])
  })

  it('非モーダルスケールでは特徴音フラグが立たない', () => {
    const ps = scalePositions(STANDARD_TUNING, 0, 12, aMinorPenta)
    expect(ps.every((p) => !p.isCharacteristic)).toBe(true)

    const dNaturalMinor = { tonic: 2, scale: 'naturalMinor' as const }
    const minorPs = scalePositions(STANDARD_TUNING, 0, 12, dNaturalMinor)
    expect(minorPs.every((p) => !p.isCharacteristic)).toBe(true)
  })
})
