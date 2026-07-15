import { describe, expect, it } from 'vitest'
import {
  cycleBend,
  cycleFinger,
  cycleHarmonic,
  setEventChord,
  setEventMemo,
  setFret,
  setStringCount,
  setTimeSignature,
  togglePrebend,
} from './tabOps.ts'
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

describe('setEventChord / setEventMemo', () => {
  it('コード名を設定・上書きでき、他のイベントに影響しない', () => {
    const block = createTabBlock()
    let next = setEventChord(block, 0, 1, 'Fm7')
    expect(next.measures[0]?.events[1]?.chord).toBe('Fm7')
    expect(next.measures[0]?.events[0]?.chord).toBeUndefined()
    next = setEventChord(next, 0, 1, 'B♭m7')
    expect(next.measures[0]?.events[1]?.chord).toBe('B♭m7')
  })

  it('空文字・空白のみで削除される(trim 込み)', () => {
    const block = createTabBlock()
    let next = setEventChord(block, 0, 0, ' Am7 ')
    expect(next.measures[0]?.events[0]?.chord).toBe('Am7')
    next = setEventChord(next, 0, 0, '   ')
    expect(next.measures[0]?.events[0]?.chord).toBeUndefined()
  })

  it('メモも同様に設定・削除できる', () => {
    const block = createTabBlock()
    let next = setEventMemo(block, 0, 2, '※ 3度トップの形')
    expect(next.measures[0]?.events[2]?.memo).toBe('※ 3度トップの形')
    next = setEventMemo(next, 0, 2, '')
    expect(next.measures[0]?.events[2]?.memo).toBeUndefined()
  })
})

describe('ベンド・運指・ハーモニクスの循環', () => {
  const pos = { m: 0, e: 0, s: 2 }
  const note = (b: ReturnType<typeof createTabBlock>) => b.measures[0]?.events[0]?.notes.find((n) => n.string === 2)

  it('ベンドは なし → ¼ → ½ → full → リリース → なし', () => {
    let b = setFret(createTabBlock(), pos, 7)
    const seen: unknown[] = []
    for (let i = 0; i < 5; i++) {
      b = cycleBend(b, pos)
      seen.push(note(b)?.bend)
    }
    expect(seen).toEqual([
      { semitones: 0.5, kind: 'bend' },
      { semitones: 1, kind: 'bend' },
      { semitones: 2, kind: 'bend' },
      { semitones: 2, kind: 'bendRelease' },
      undefined,
    ])
  })

  it('プリベンドはトグルでき、既存のベンド量を引き継ぐ', () => {
    let b = setFret(createTabBlock(), pos, 7)
    b = cycleBend(b, pos) // ¼
    b = togglePrebend(b, pos)
    expect(note(b)?.bend).toEqual({ semitones: 0.5, kind: 'prebend' })
    b = togglePrebend(b, pos)
    expect(note(b)?.bend).toBeUndefined()
    b = togglePrebend(b, pos) // ベンドなしから → full プリベンド
    expect(note(b)?.bend).toEqual({ semitones: 2, kind: 'prebend' })
  })

  it('運指は なし → 1 → 2 → 3 → 4 → T(0) → なし', () => {
    let b = setFret(createTabBlock(), pos, 5)
    const seen: unknown[] = []
    for (let i = 0; i < 6; i++) {
      b = cycleFinger(b, pos)
      seen.push(note(b)?.finger)
    }
    expect(seen).toEqual([1, 2, 3, 4, 0, undefined])
  })

  it('ハーモニクスは なし → 自然 → 人工 → なし', () => {
    let b = setFret(createTabBlock(), pos, 12)
    b = cycleHarmonic(b, pos)
    expect(note(b)?.harmonic).toBe('natural')
    b = cycleHarmonic(b, pos)
    expect(note(b)?.harmonic).toBe('artificial')
    b = cycleHarmonic(b, pos)
    expect(note(b)?.harmonic).toBeUndefined()
  })
})

describe('setStringCount', () => {
  it('弦を足すと最低弦の完全4度下が付く', () => {
    const b = setStringCount(createTabBlock(), 7)
    expect(b.tuning).toHaveLength(7)
    expect(b.tuning[6]).toBe(35) // E2(40) の完全4度下 = B1
  })

  it('弦を減らすと消えた弦の音も取り除かれ、4〜8 にクランプされる', () => {
    let b = createTabBlock()
    b = setFret(b, { m: 0, e: 0, s: 6 }, 3)
    b = setFret(b, { m: 0, e: 0, s: 1 }, 5)
    b = setStringCount(b, 5)
    expect(b.tuning).toHaveLength(5)
    expect(b.measures[0]?.events[0]?.notes.map((n) => n.string)).toEqual([1])
    expect(setStringCount(b, 1).tuning).toHaveLength(4)
    expect(setStringCount(b, 99).tuning).toHaveLength(8)
  })
})
