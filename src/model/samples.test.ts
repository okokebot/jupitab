import { describe, expect, it } from 'vitest'
import {
  createChordSampleBlock,
  createFretboardSampleBlock,
  createTabSampleBlock,
} from './samples.ts'
import { measureCapacity, measureUsed } from './duration.ts'
import { eq } from './fraction.ts'
import { effectiveTimeSignature } from './types.ts'
import { isInScale, pitchClass, pitchFromTab } from './theory.ts'
import { CHORD_ROWS } from '../layout/chordLayout.ts'

describe('TAB譜サンプル', () => {
  it('全小節がちょうど実効拍子(4/4・6/8・7/8)に収まる', () => {
    const block = createTabSampleBlock()
    block.measures.forEach((m, i) => {
      const ts = effectiveTimeSignature(block.measures, i)
      expect(
        eq(measureUsed(m), measureCapacity(ts)),
        `小節 ${i + 1} の合計音価が ${ts.beats}/${ts.beatUnit} と一致しない: ${JSON.stringify(measureUsed(m))}`,
      ).toBe(true)
    })
  })

  it('変拍子の小節を含む(6/8・7/8)', () => {
    const block = createTabSampleBlock()
    const signatures = block.measures.map((_, i) => effectiveTimeSignature(block.measures, i))
    expect(signatures).toContainEqual({ beats: 6, beatUnit: 8 })
    expect(signatures).toContainEqual({ beats: 7, beatUnit: 8 })
  })

  it('タイは同じ弦の直前の音に繋がっている', () => {
    const block = createTabSampleBlock()
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

describe('指板図サンプル', () => {
  it('手動マーカーが表示範囲(弦・フレット)に収まる', () => {
    const block = createFretboardSampleBlock()
    for (const m of block.markers) {
      expect(m.string).toBeGreaterThanOrEqual(1)
      expect(m.string).toBeLessThanOrEqual(block.tuning.length)
      expect(m.fret).toBeGreaterThanOrEqual(block.fretStart)
      expect(m.fret).toBeLessThanOrEqual(block.fretEnd)
    }
  })

  it('手動マーカーはスケール構成音上にある(ラベル省略時の導出表示が成立する)', () => {
    const block = createFretboardSampleBlock()
    const key = block.keyContext
    expect(key).toBeDefined()
    if (!key) return
    for (const m of block.markers) {
      const pc = pitchClass(pitchFromTab(block.tuning, m.string, m.fret))
      expect(isInScale(pc, key), `${m.string}弦 ${m.fret}F はスケール外`).toBe(true)
    }
  })

  it('マーカースタイル 3 種(強調/通常/弱)を網羅する', () => {
    const block = createFretboardSampleBlock()
    const styles = new Set(block.markers.map((m) => m.style))
    expect(styles).toEqual(new Set(['root', 'primary', 'muted']))
  })
})

describe('コード表サンプル', () => {
  it('6 弦分の frets を持ち、押弦は表示ウィンドウ(baseFret 〜 +CHORD_ROWS-1)に収まる', () => {
    const block = createChordSampleBlock()
    expect(block.frets).toHaveLength(6)
    for (const f of block.frets) {
      if (f === null || f === 0) continue
      expect(f).toBeGreaterThanOrEqual(block.baseFret)
      expect(f).toBeLessThan(block.baseFret + CHORD_ROWS)
    }
  })

  it('運指は frets と同数で、押弦していない弦には付かない', () => {
    const block = createChordSampleBlock()
    expect(block.fingers).toHaveLength(block.frets.length)
    block.frets.forEach((f, i) => {
      if (f === null || f === 0) expect(block.fingers?.[i]).toBeNull()
    })
  })

  it('バレーは表示ウィンドウ内で、範囲の弦番号が正しい(fromString ≧ toString)', () => {
    const block = createChordSampleBlock()
    const barre = block.barres?.[0]
    expect(barre).toBeDefined()
    if (!barre) return
    expect(barre.fret).toBeGreaterThanOrEqual(block.baseFret)
    expect(barre.fret).toBeLessThan(block.baseFret + CHORD_ROWS)
    expect(barre.fromString).toBeGreaterThanOrEqual(barre.toString)
    // バレー両端の弦は実際にそのフレット(以上)を押さえている
    // frets は index 0 = 6弦なので弦番号 s → index (6 - s)
    for (const s of [barre.fromString, barre.toString]) {
      const f = block.frets[6 - s]
      expect(f).not.toBeNull()
      expect(f).toBeGreaterThanOrEqual(barre.fret)
    }
  })
})
