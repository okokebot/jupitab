import { describe, expect, it } from 'vitest'
import { FRET_W, INLAY_FRETS, fretboardGeometry } from './fretboardLayout.ts'

// 6弦・0〜4F(ナットあり)の標準ケース
const base = { stringCount: 6, fretStart: 0, fretEnd: 4 }
const normal = fretboardGeometry(base)
const mirrored = fretboardGeometry({ ...base, mirrored: true })

describe('fretboardGeometry(通常表示)', () => {
  it('寸法と余白(ナット側 40 / 反対側 20)', () => {
    expect(normal.width).toBe(40 + 4 * FRET_W + 20) // 244
    expect(normal.height).toBe(24 + 5 * 22 + 36) // 170
  })

  it('ナットが左端、弦線はナット〜最終フレット線', () => {
    expect(normal.fretLineX(0)).toBe(40)
    expect(normal.stringX1).toBe(40)
    expect(normal.stringX2).toBe(40 + 4 * FRET_W)
  })

  it('マーカーはフレット間中央、開放弦はナット左外側', () => {
    expect(normal.markerX(1)).toBe(40 + 0.5 * FRET_W)
    expect(normal.markerX(3)).toBe(40 + 2.5 * FRET_W)
    expect(normal.markerX(0)).toBe(24) // ナット(40)の左外側
  })

  it('弦 Y は反転パラメータと無関係(1弦が上)', () => {
    expect(normal.stringY(1)).toBe(24)
    expect(normal.stringY(6)).toBe(24 + 5 * 22)
    expect(mirrored.stringY(1)).toBe(normal.stringY(1))
  })
})

describe('fretboardGeometry(反転表示)', () => {
  it('すべての X が width - 通常時X と一致する(対称性)', () => {
    for (let i = 0; i <= 4; i++) {
      expect(mirrored.fretLineX(i)).toBe(normal.width - normal.fretLineX(i))
    }
    for (let f = 0; f <= 4; f++) {
      expect(mirrored.markerX(f)).toBe(normal.width - normal.markerX(f))
      expect(mirrored.fretNumberX(f)).toBe(normal.width - normal.fretNumberX(f))
    }
  })

  it('ナットが右端、開放弦マーカーはナットの右外側(AC-5)', () => {
    const nut = mirrored.fretLineX(0)
    expect(nut).toBe(mirrored.width - 40)
    expect(mirrored.markerX(0)).toBeGreaterThan(nut)
  })

  it('弦線範囲は反転後も x1 <= x2 を保つ', () => {
    expect(mirrored.stringX1).toBe(20)
    expect(mirrored.stringX2).toBe(mirrored.width - 40)
    expect(mirrored.stringX1).toBeLessThan(mirrored.stringX2)
  })
})

describe('ハイポジション図(fretStart > 0)', () => {
  const hi = fretboardGeometry({ stringCount: 6, fretStart: 5, fretEnd: 9 })
  const hiM = fretboardGeometry({ stringCount: 6, fretStart: 5, fretEnd: 9, mirrored: true })

  it('番号・マーカーが fretStart 起点で並ぶ', () => {
    expect(hi.markerX(6)).toBe(40 + 0.5 * FRET_W)
    expect(hi.fretNumberX(9)).toBe(40 + 3.5 * FRET_W)
  })

  it('反転時も対称性が成り立つ(AC-1)', () => {
    for (let f = 6; f <= 9; f++) {
      expect(hiM.markerX(f)).toBe(hi.width - hi.markerX(f))
    }
  })
})

describe('ポジションマーク(AC-6)', () => {
  const wide = fretboardGeometry({ stringCount: 6, fretStart: 10, fretEnd: 15 })
  const wideM = fretboardGeometry({ stringCount: 6, fretStart: 10, fretEnd: 15, mirrored: true })

  it('12F が INLAY_FRETS に含まれ、中心 X が反転で対称', () => {
    expect(INLAY_FRETS).toContain(12)
    expect(wide.inlayX(12)).toBe(40 + 1.5 * FRET_W)
    expect(wideM.inlayX(12)).toBe(wide.width - wide.inlayX(12))
  })
})

describe('hitRect(AC-2)', () => {
  it('通常セルはマーカー中心・幅 42', () => {
    const r = normal.hitRect(2, 3)
    expect(r.width).toBe(FRET_W - 4)
    expect(r.x + r.width / 2).toBe(normal.markerX(3))
    expect(r.y + r.height / 2).toBe(normal.stringY(2))
  })

  it('開放弦セルは幅 28 でナットを跨がない(通常・反転とも)', () => {
    const r = normal.hitRect(1, 0)
    expect(r.width).toBe(28)
    expect(r.x + r.width).toBeLessThan(normal.fretLineX(0)) // 右端 38 < ナット 40

    const rm = mirrored.hitRect(1, 0)
    expect(rm.x).toBeGreaterThan(mirrored.fretLineX(0)) // 反転時は左端がナットの右
  })

  it('反転時もヒット中心がマーカー中心と一致する', () => {
    const rm = mirrored.hitRect(4, 2)
    expect(rm.x + rm.width / 2).toBe(mirrored.markerX(2))
  })
})
