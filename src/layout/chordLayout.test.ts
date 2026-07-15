import { describe, expect, it } from 'vitest'
import { CHORD_NAME_H, CHORD_ROWS, chordGeometry } from './chordLayout.ts'
import { FRET_W } from './fretboardLayout.ts'

const open = chordGeometry({ stringCount: 6, baseFret: 1 })
const openM = chordGeometry({ stringCount: 6, baseFret: 1, mirrored: true })
const hi = chordGeometry({ stringCount: 6, baseFret: 5 })
const hiM = chordGeometry({ stringCount: 6, baseFret: 5, mirrored: true })

describe('chordGeometry(baseFret = 1)', () => {
  it('最初のフレット線が fret 0(ナット位置 40)', () => {
    expect(open.fretLineX(0)).toBe(40)
  })

  it('1 フレットの中心がフレット間中央、開放域はナット外側(AC-3)', () => {
    expect(open.markerX(1)).toBe(40 + 0.5 * FRET_W)
    expect(open.markerX(0)).toBe(24)
  })

  it('height はコード名行込みで一本化される(boardHeight + CHORD_NAME_H)', () => {
    expect(open.boardHeight).toBe(24 + 5 * 22 + 36)
    expect(open.height).toBe(open.boardHeight + CHORD_NAME_H)
    expect(open.boardOffsetY).toBe(CHORD_NAME_H)
  })
})

describe('chordGeometry(baseFret = 5)', () => {
  it('フレット 5〜9 が表示範囲に入る', () => {
    expect(hi.markerX(5)).toBe(40 + 0.5 * FRET_W)
    expect(hi.fretNumberX(9)).toBe(40 + 4.5 * FRET_W)
  })

  it('開放域は baseFret に関係なく最初の線の外側(AC-4 の座標的根拠)', () => {
    expect(hi.markerX(0)).toBe(24)
    expect(hi.hitRect(1, 0)).toEqual(open.hitRect(1, 0))
  })
})

describe('chordGeometry(反転)', () => {
  it('すべての X が width - 通常X(AC-2)', () => {
    for (let f = 0; f <= CHORD_ROWS; f++) {
      expect(openM.markerX(f)).toBe(open.width - open.markerX(f))
    }
    for (let f = 5; f <= 9; f++) {
      expect(hiM.markerX(f)).toBe(hi.width - hi.markerX(f))
    }
  })

  it('nameX は反転の影響を受けない', () => {
    expect(openM.nameX).toBe(open.nameX)
    expect(open.nameX).toBe(open.width / 2)
  })
})
