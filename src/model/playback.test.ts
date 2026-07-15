import { describe, expect, it } from 'vitest'
import type { ChordBlock, Duration, Measure, TabBlock, TabEvent, TabNote, TimeSignature } from './types.ts'
import { STANDARD_TUNING } from './theory.ts'
import { planChordPlayback, planTabPlayback } from './playback.ts'

let seq = 0
const QUARTER: Duration = { base: 4, dots: 0 }

function ev(notes: Partial<TabNote>[], duration: Duration = QUARTER): TabEvent {
  return {
    id: `e${seq++}`,
    duration,
    notes: notes.map((n) => ({ string: 1, fret: 0, ...n })),
  }
}

function measure(events: TabEvent[], timeSignature?: TimeSignature): Measure {
  return { id: `m${seq++}`, events, ...(timeSignature ? { timeSignature } : {}) }
}

function tab(measures: Measure[], extra: Partial<TabBlock> = {}): TabBlock {
  return { id: 'b', type: 'tab', tuning: [...STANDARD_TUNING], measures, ...extra }
}

describe('planTabPlayback', () => {
  it('4分音符はテンポ 120 で 0.5 秒間隔', () => {
    const block = tab([measure([ev([{ fret: 0 }]), ev([{ fret: 2 }]), ev([{ fret: 3 }]), ev([{ fret: 5 }])])])
    const plan = planTabPlayback(block, 120)
    expect(plan.notes.map((n) => n.start)).toEqual([0, 0.5, 1, 1.5])
    expect(plan.notes.every((n) => n.duration === 0.5)).toBe(true)
    expect(plan.total).toBe(2)
  })

  it('block.tempo を既定テンポとして使う', () => {
    const block = tab([measure([ev([{ fret: 0 }]), ev([{ fret: 0 }])])], { tempo: 60 })
    const plan = planTabPlayback(block)
    expect(plan.notes[1]?.start).toBe(1)
  })

  it('音高は弦 + フレット + カポから導出する', () => {
    const block = tab([measure([ev([{ string: 5, fret: 3 }])])], { capo: 2 })
    const plan = planTabPlayback(block, 120)
    // 5弦(A=45)+ カポ2 + 3フレット = 50
    expect(plan.notes[0]?.midi).toBe(50)
  })

  it('休符は音を出さずに時間を進める(マーカーは全イベント分)', () => {
    const block = tab([measure([ev([{ fret: 1 }]), ev([]), ev([{ fret: 1 }]), ev([])])])
    const plan = planTabPlayback(block, 120)
    expect(plan.notes.map((n) => n.start)).toEqual([0, 1])
    expect(plan.markers.map((m) => m.start)).toEqual([0, 0.5, 1, 1.5])
  })

  it('タイは前の同弦音を延長して 1 音にする(小節またぎも可)', () => {
    const block = tab([
      measure([ev([]), ev([]), ev([]), ev([{ string: 2, fret: 5 }])]),
      measure([ev([{ string: 2, fret: 5, tieToPrev: true }]), ev([]), ev([]), ev([])]),
    ])
    const plan = planTabPlayback(block, 120)
    expect(plan.notes).toHaveLength(1)
    expect(plan.notes[0]?.start).toBe(1.5)
    expect(plan.notes[0]?.duration).toBe(1)
  })

  it('3連符も誤差なく刻む', () => {
    const triplet: Duration = { base: 8, dots: 0, tuplet: { actual: 3, normal: 2 } }
    const block = tab([measure([ev([{ fret: 0 }], triplet), ev([{ fret: 1 }], triplet), ev([{ fret: 2 }], triplet)])])
    const plan = planTabPlayback(block, 120)
    // 8分3連 = 全音符の 1/12 → 120bpm では 1/6 秒
    expect(plan.notes[1]?.start).toBeCloseTo(1 / 6, 10)
    expect(plan.notes[2]?.start).toBeCloseTo(2 / 6, 10)
  })

  it('入力途中の小節は拍子の残りを休符として扱う', () => {
    const block = tab([measure([ev([{ fret: 0 }])]), measure([ev([{ fret: 0 }])])])
    const plan = planTabPlayback(block, 120)
    // 1 小節目は 4/4 いっぱい(2 秒)まで埋める
    expect(plan.notes[1]?.start).toBe(2)
  })

  it('拍子変更(3/4)を反映する', () => {
    const block = tab([
      measure([ev([{ fret: 0 }])], { beats: 3, beatUnit: 4 }),
      measure([ev([{ fret: 0 }])]),
    ])
    const plan = planTabPlayback(block, 120)
    expect(plan.notes[1]?.start).toBe(1.5)
  })

  it('スタッカートは音価の半分、ゴースト/アクセントは音量に反映', () => {
    const block = tab([
      measure([
        ev([{ fret: 0, articulations: ['staccato'] }]),
        ev([{ fret: 0, articulations: ['ghost'] }]),
        ev([{ fret: 0, articulations: ['accent'] }]),
      ]),
    ])
    const plan = planTabPlayback(block, 120)
    expect(plan.notes[0]?.duration).toBe(0.25)
    expect(plan.notes[1]?.gain).toBeLessThan(plan.notes[2]?.gain ?? 0)
  })

  it('ミュート音(x)は dead フラグ付きで出す', () => {
    const block = tab([measure([ev([{ fret: 5, dead: true }])])])
    expect(planTabPlayback(block, 120).notes[0]?.dead).toBe(true)
  })
})

describe('planChordPlayback', () => {
  const chord = (frets: (number | null)[]): ChordBlock => ({
    id: 'c',
    type: 'chord',
    name: '',
    frets,
    baseFret: 1,
  })

  it('Am(x02210)は 6弦側から順にずらして 5 音鳴らす', () => {
    const plan = planChordPlayback(chord([null, 0, 2, 2, 1, 0]))
    expect(plan.notes.map((n) => n.midi)).toEqual([45, 52, 57, 60, 64])
    const starts = plan.notes.map((n) => n.start)
    expect(starts[0]).toBe(0)
    expect([...starts].sort((a, b) => a - b)).toEqual(starts)
    expect(plan.total).toBeGreaterThan(2)
  })

  it('全弦ミュートなら何も鳴らさない', () => {
    const plan = planChordPlayback(chord([null, null, null, null, null, null]))
    expect(plan.notes).toHaveLength(0)
    expect(plan.total).toBe(0)
  })
})
