// TabBlock → 配置済みジオメトリの純関数。React に依存しない。
// Phase 1 の画像出力でもこのレイアウトをそのまま使う。

import type { Duration, Measure, TabBlock, TabEvent, TimeSignature } from '../model/types.ts'
import { effectiveTimeSignature } from '../model/types.ts'
import { durationValue } from '../model/duration.ts'
import { toNumber } from '../model/fraction.ts'

export const TAB_METRICS = {
  stringGap: 14,
  /** 上部の奏法記号・連符ブラケット用スペース */
  topPad: 30,
  /** 譜の下のリズム記号(符幹・旗・連桁)領域 */
  rhythmHeight: 32,
  linePad: 20,
  /** 行頭の "TAB" 表示 + 左余白 */
  labelWidth: 30,
  measureLeadPad: 12,
  measureTailPad: 8,
  tsWidth: 20,
  /** コード名行(ブロック内にコード名があるとき topPad に加算) */
  chordHeight: 16,
  /** メモ行(ブロック内にメモがあるとき行高に加算) */
  memoHeight: 16,
} as const

export interface LaidEvent {
  event: TabEvent
  measureIndex: number
  eventIndex: number
  /** イベント中心の x(絶対座標) */
  x: number
  width: number
  /** 旗/連桁の本数(8分=1, 16分=2, 32分=3, 64分=4) */
  flags: number
}

/** LaidMeasure.events の index 範囲(両端含む) */
export interface EventRange {
  from: number
  to: number
  label?: string
}

export interface LaidMeasure {
  measure: Measure
  index: number
  x: number
  width: number
  /** 表示すべき拍子(先頭小節 or 明示変更時のみ非 null) */
  showTimeSignature: TimeSignature | null
  events: LaidEvent[]
  beams: EventRange[]
  tuplets: EventRange[]
}

export interface TabLine {
  measures: LaidMeasure[]
  /** 1弦ライン(最上線)の y */
  staffTop: number
}

export interface TabLayout {
  lines: TabLine[]
  width: number
  height: number
  stringCount: number
  staffHeight: number
  /** 実効の上余白(コード名があれば chordHeight ぶん広い) */
  topPad: number
  /** メモ行の有無(行高と hitTest の範囲に影響) */
  hasMemos: boolean
}

export function flagCount(base: Duration['base']): number {
  return base >= 8 ? Math.log2(base) - 2 : 0
}

function eventWidth(event: TabEvent): number {
  const v = toNumber(durationValue(event.duration)) // 全音符 = 1
  const w = 30 * (v * 8) ** 0.55 // 8分音符 = 30px 基準で緩やかに伸縮
  const base = Math.min(76, Math.max(24, w))
  // 長いコード名が隣のイベントと重ならないだけの幅を確保
  const chordW = event.chord ? event.chord.length * 8 + 8 : 0
  return Math.max(base, chordW)
}

function measureContentWidth(measure: Measure, showTs: boolean): number {
  const events = measure.events.reduce((acc, e) => acc + eventWidth(e), 0)
  return (
    TAB_METRICS.measureLeadPad +
    (showTs ? TAB_METRICS.tsWidth : 0) +
    Math.max(events, 24) +
    TAB_METRICS.measureTailPad
  )
}

/** 連桁: 休符・旗なし音符で途切れる連続した音符のまとまり */
function beamGroups(events: LaidEvent[]): EventRange[] {
  const groups: EventRange[] = []
  let start = -1
  const flush = (end: number) => {
    if (start >= 0 && end - start >= 1) groups.push({ from: start, to: end })
    start = -1
  }
  events.forEach((e, i) => {
    const beamable = e.flags > 0 && e.event.notes.length > 0
    if (beamable && start < 0) start = i
    if (!beamable) flush(i - 1)
  })
  flush(events.length - 1)
  return groups
}

/** 連符ブラケット: 同じ連符設定の連続を actual 個ずつに区切る */
function tupletGroups(events: LaidEvent[]): EventRange[] {
  const groups: EventRange[] = []
  let i = 0
  while (i < events.length) {
    const t = events[i]?.event.duration.tuplet
    if (!t) {
      i++
      continue
    }
    let j = i
    while (
      j < events.length &&
      events[j]?.event.duration.tuplet?.actual === t.actual &&
      events[j]?.event.duration.tuplet?.normal === t.normal
    ) {
      j++
    }
    // [i, j) を actual 個ずつに分割
    for (let k = i; k < j; k += t.actual) {
      groups.push({ from: k, to: Math.min(k + t.actual - 1, j - 1), label: String(t.actual) })
    }
    i = j
  }
  return groups
}

export function layoutTab(block: TabBlock, width: number): TabLayout {
  const stringCount = block.tuning.length
  const staffHeight = (stringCount - 1) * TAB_METRICS.stringGap
  const allEvents = block.measures.flatMap((m) => m.events)
  const topPad = TAB_METRICS.topPad + (allEvents.some((e) => e.chord) ? TAB_METRICS.chordHeight : 0)
  const hasMemos = allEvents.some((e) => e.memo)
  const lineHeight =
    topPad + staffHeight + TAB_METRICS.rhythmHeight + (hasMemos ? TAB_METRICS.memoHeight : 0) + TAB_METRICS.linePad

  const lines: TabLine[] = []
  let current: LaidMeasure[] = []
  let cursorX = TAB_METRICS.labelWidth

  const pushLine = () => {
    if (current.length === 0) return
    lines.push({ measures: current, staffTop: topPad + lines.length * lineHeight })
    current = []
    cursorX = TAB_METRICS.labelWidth
  }

  block.measures.forEach((measure, index) => {
    const showTs =
      index === 0 || measure.timeSignature !== undefined
        ? effectiveTimeSignature(block.measures, index)
        : null
    const mWidth = measureContentWidth(measure, showTs !== null)

    if (current.length > 0 && cursorX + mWidth > width) pushLine()

    const mX = cursorX
    let eX = mX + TAB_METRICS.measureLeadPad + (showTs ? TAB_METRICS.tsWidth : 0)
    const events: LaidEvent[] = measure.events.map((event, eventIndex) => {
      const w = eventWidth(event)
      const laid: LaidEvent = {
        event,
        measureIndex: index,
        eventIndex,
        x: eX + w / 2,
        width: w,
        flags: flagCount(event.duration.base),
      }
      eX += w
      return laid
    })

    current.push({
      measure,
      index,
      x: mX,
      width: mWidth,
      showTimeSignature: showTs,
      events,
      beams: beamGroups(events),
      tuplets: tupletGroups(events),
    })
    cursorX = mX + mWidth
  })
  pushLine()

  return {
    lines,
    width,
    height: Math.max(lines.length, 1) * lineHeight + 8,
    stringCount,
    staffHeight,
    topPad,
    hasMemos,
  }
}

// ---- エディタ用ヘルパー ----

export interface TabPosition {
  measureIndex: number
  eventIndex: number
  string: number
}

/** クリック座標 → (小節, イベント, 弦)。範囲外は null */
export function hitTest(layout: TabLayout, x: number, y: number): TabPosition | null {
  for (const line of layout.lines) {
    const yTop = line.staffTop - layout.topPad
    const yBottom =
      line.staffTop +
      layout.staffHeight +
      TAB_METRICS.rhythmHeight +
      (layout.hasMemos ? TAB_METRICS.memoHeight : 0)
    if (y < yTop || y > yBottom) continue
    for (const m of line.measures) {
      if (x < m.x || x > m.x + m.width) continue
      if (m.events.length === 0) return { measureIndex: m.index, eventIndex: 0, string: 1 }
      let best = m.events[0] as LaidEvent
      for (const e of m.events) {
        if (Math.abs(e.x - x) < Math.abs(best.x - x)) best = e
      }
      const string = Math.min(
        layout.stringCount,
        Math.max(1, Math.round((y - line.staffTop) / TAB_METRICS.stringGap) + 1),
      )
      return { measureIndex: best.measureIndex, eventIndex: best.eventIndex, string }
    }
  }
  return null
}

export interface EventGeom {
  laid: LaidEvent
  /** イベントが属する行の 1弦ライン y */
  staffTop: number
}

/** (小節, イベント) の描画位置を引く */
export function findEvent(layout: TabLayout, measureIndex: number, eventIndex: number): EventGeom | null {
  for (const line of layout.lines) {
    for (const m of line.measures) {
      if (m.index !== measureIndex) continue
      const laid = m.events[eventIndex]
      return laid ? { laid, staffTop: line.staffTop } : null
    }
  }
  return null
}

export function stringY(staffTop: number, string: number): number {
  return staffTop + (string - 1) * TAB_METRICS.stringGap
}
