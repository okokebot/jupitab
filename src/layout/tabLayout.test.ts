import { describe, expect, it } from 'vitest'
import { flagCount, hitTest, layoutTab, stringY, TAB_METRICS } from './tabLayout.ts'
import { createMeasure, createTabBlock, createTabEvent } from '../model/factory.ts'
import type { TabBlock } from '../model/types.ts'

function blockWithMeasures(count: number): TabBlock {
  const block = createTabBlock()
  block.measures = Array.from({ length: count }, () => createMeasure())
  return block
}

describe('layoutTab', () => {
  it('イベント x が単調増加し、小節が並ぶ', () => {
    const layout = layoutTab(blockWithMeasures(2), 800)
    expect(layout.lines).toHaveLength(1)
    const xs = layout.lines[0]!.measures.flatMap((m) => m.events.map((e) => e.x))
    const sorted = [...xs].sort((a, b) => a - b)
    expect(xs).toEqual(sorted)
    expect(new Set(xs).size).toBe(xs.length)
  })

  it('幅が狭いと行に折り返す', () => {
    const layout = layoutTab(blockWithMeasures(6), 400)
    expect(layout.lines.length).toBeGreaterThan(1)
    // 各行は幅に収まる(先頭小節が巨大な場合を除く)
    for (const line of layout.lines) {
      const last = line.measures.at(-1)!
      expect(last.x + last.width).toBeLessThanOrEqual(400 + 1)
    }
  })

  it('拍子は先頭小節のみ表示(変更がなければ)', () => {
    const layout = layoutTab(blockWithMeasures(3), 800)
    const measures = layout.lines[0]!.measures
    expect(measures[0]!.showTimeSignature).toEqual({ beats: 4, beatUnit: 4 })
    expect(measures[1]!.showTimeSignature).toBeNull()
  })

  it('連桁: 休符で途切れる', () => {
    const block = createTabBlock()
    const m = createMeasure(0)
    const eighth = { base: 8 as const, dots: 0 as const }
    // 音 音 休 音 → beam は [0,1] のみ([3] は単独なので旗)
    m.events = [createTabEvent(eighth), createTabEvent(eighth), createTabEvent(eighth), createTabEvent(eighth)]
    m.events[0]!.notes = [{ string: 1, fret: 5 }]
    m.events[1]!.notes = [{ string: 1, fret: 7 }]
    m.events[3]!.notes = [{ string: 2, fret: 5 }]
    block.measures = [m]
    const layout = layoutTab(block, 800)
    expect(layout.lines[0]!.measures[0]!.beams).toEqual([{ from: 0, to: 1 }])
  })

  it('3連符ブラケット: actual 個ずつに区切る', () => {
    const block = createTabBlock()
    const m = createMeasure(0)
    const triplet = { base: 8 as const, dots: 0 as const, tuplet: { actual: 3, normal: 2 } }
    m.events = Array.from({ length: 6 }, () => createTabEvent(triplet))
    m.events.forEach((e) => (e.notes = [{ string: 1, fret: 5 }]))
    block.measures = [m]
    const layout = layoutTab(block, 800)
    expect(layout.lines[0]!.measures[0]!.tuplets).toEqual([
      { from: 0, to: 2, label: '3' },
      { from: 3, to: 5, label: '3' },
    ])
  })

  it('hitTest がイベントと弦を引き当てる', () => {
    const layout = layoutTab(blockWithMeasures(1), 800)
    const line = layout.lines[0]!
    const target = line.measures[0]!.events[2]!
    const y = stringY(line.staffTop, 3)
    expect(hitTest(layout, target.x, y)).toEqual({ measureIndex: 0, eventIndex: 2, string: 3 })
    // 譜面のはるか外は null
    expect(hitTest(layout, target.x, line.staffTop + 500)).toBeNull()
  })

  it('flagCount', () => {
    expect(flagCount(4)).toBe(0)
    expect(flagCount(8)).toBe(1)
    expect(flagCount(64)).toBe(4)
  })

  it('メトリクスの整合(弦間隔から譜高が決まる)', () => {
    const layout = layoutTab(blockWithMeasures(1), 800)
    expect(layout.staffHeight).toBe(5 * TAB_METRICS.stringGap)
  })
})
