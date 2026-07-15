// TabBlock への編集操作。全て immutable な純関数(undo は store の履歴に任せる)。

import type {
  Articulation,
  Bend,
  Duration,
  Legato,
  Measure,
  TabBlock,
  TabEvent,
  TabNote,
  TimeSignature,
} from '../../../model/types.ts'
import { createMeasure, createTabEvent } from '../../../model/factory.ts'

export interface TabPos {
  m: number
  e: number
  s: number
}

function updateMeasure(block: TabBlock, m: number, fn: (measure: Measure) => Measure): TabBlock {
  return {
    ...block,
    measures: block.measures.map((measure, i) => (i === m ? fn(measure) : measure)),
  }
}

export function updateEvent(block: TabBlock, m: number, e: number, fn: (ev: TabEvent) => TabEvent): TabBlock {
  return updateMeasure(block, m, (measure) => ({
    ...measure,
    events: measure.events.map((ev, i) => (i === e ? fn(ev) : ev)),
  }))
}

export function updateNote(
  block: TabBlock,
  pos: TabPos,
  fn: (note: TabNote) => TabNote | null,
): TabBlock {
  return updateEvent(block, pos.m, pos.e, (ev) => {
    const notes: TabNote[] = []
    for (const n of ev.notes) {
      if (n.string !== pos.s) {
        notes.push(n)
        continue
      }
      const next = fn(n)
      if (next) notes.push(next)
    }
    return { ...ev, notes }
  })
}

export function noteAt(block: TabBlock, pos: TabPos): TabNote | undefined {
  return block.measures[pos.m]?.events[pos.e]?.notes.find((n) => n.string === pos.s)
}

export function eventAt(block: TabBlock, m: number, e: number): TabEvent | undefined {
  return block.measures[m]?.events[e]
}

export function setFret(block: TabBlock, pos: TabPos, fret: number): TabBlock {
  return updateEvent(block, pos.m, pos.e, (ev) => {
    const existing = ev.notes.find((n) => n.string === pos.s)
    const notes = existing
      ? ev.notes.map((n) => (n.string === pos.s ? { ...n, fret, dead: undefined } : n))
      : [...ev.notes, { string: pos.s, fret }]
    return { ...ev, notes }
  })
}

export function removeNote(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, () => null)
}

export function toggleArticulation(block: TabBlock, pos: TabPos, art: Articulation): TabBlock {
  return updateNote(block, pos, (n) => {
    const arts = n.articulations ?? []
    const next = arts.includes(art) ? arts.filter((a) => a !== art) : [...arts, art]
    return { ...n, articulations: next.length > 0 ? next : undefined }
  })
}

export function toggleDead(block: TabBlock, pos: TabPos): TabBlock {
  const existing = noteAt(block, pos)
  if (!existing) {
    // 音がなければデッドノートを新規作成
    return updateEvent(block, pos.m, pos.e, (ev) => ({
      ...ev,
      notes: [...ev.notes, { string: pos.s, fret: 0, dead: true }],
    }))
  }
  return updateNote(block, pos, (n) => ({ ...n, dead: n.dead ? undefined : true }))
}

export function toggleTie(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, (n) => ({ ...n, tieToPrev: n.tieToPrev ? undefined : true }))
}

/** H → P → S → なし の循環にせず、押したキーの奏法をトグルする */
export function toggleLegato(block: TabBlock, pos: TabPos, legato: Legato): TabBlock {
  return updateNote(block, pos, (n) => ({
    ...n,
    legatoToNext: n.legatoToNext === legato ? undefined : legato,
  }))
}

/** なし → ¼ → ½ → full → full リリース → なし を循環 */
export function cycleBend(block: TabBlock, pos: TabPos): TabBlock {
  const order: (Bend | undefined)[] = [
    undefined,
    { semitones: 0.5, kind: 'bend' },
    { semitones: 1, kind: 'bend' },
    { semitones: 2, kind: 'bend' },
    { semitones: 2, kind: 'bendRelease' },
  ]
  return updateNote(block, pos, (n) => {
    const i = order.findIndex((b) => b?.semitones === n.bend?.semitones && b?.kind === n.bend?.kind)
    // 循環外の値(プリベンド等)からはリセット
    const next = i >= 0 ? order[(i + 1) % order.length] : undefined
    return { ...n, bend: next }
  })
}

/** 不定音程からのスライドイン(/5)をトグル */
export function toggleSlideIn(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, (n) => ({ ...n, slideIn: n.slideIn ? undefined : true }))
}

/** 不定音程へのスライドアウト(5\)をトグル */
export function toggleSlideOut(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, (n) => ({ ...n, slideOut: n.slideOut ? undefined : true }))
}

/** プリベンドをトグルする。ベンドがなければ full のプリベンドを付ける */
export function togglePrebend(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, (n) => {
    if (!n.bend) return { ...n, bend: { semitones: 2, kind: 'prebend' } }
    if (n.bend.kind === 'prebend') return { ...n, bend: undefined }
    return { ...n, bend: { ...n.bend, kind: 'prebend' } }
  })
}

/** 運指を なし → 1 → 2 → 3 → 4 → T(親指) → なし と循環 */
export function cycleFinger(block: TabBlock, pos: TabPos): TabBlock {
  const order = [undefined, 1, 2, 3, 4, 0] as const
  return updateNote(block, pos, (n) => {
    const i = order.indexOf(n.finger as (typeof order)[number])
    return { ...n, finger: order[(i + 1) % order.length] }
  })
}

/** ハーモニクスを なし → 自然 → 人工 → なし と循環 */
export function cycleHarmonic(block: TabBlock, pos: TabPos): TabBlock {
  return updateNote(block, pos, (n) => {
    const next = n.harmonic === undefined ? 'natural' : n.harmonic === 'natural' ? 'artificial' : undefined
    return { ...n, harmonic: next }
  })
}

export function setEventDuration(block: TabBlock, m: number, e: number, duration: Duration): TabBlock {
  return updateEvent(block, m, e, (ev) => ({ ...ev, duration }))
}

/** コード名を設定する。空文字・空白のみで削除 */
export function setEventChord(block: TabBlock, m: number, e: number, chord: string): TabBlock {
  const text = chord.trim()
  return updateEvent(block, m, e, (ev) => ({ ...ev, chord: text || undefined }))
}

/** メモを設定する。空文字・空白のみで削除 */
export function setEventMemo(block: TabBlock, m: number, e: number, memo: string): TabBlock {
  const text = memo.trim()
  return updateEvent(block, m, e, (ev) => ({ ...ev, memo: text || undefined }))
}

export function insertEventAfter(block: TabBlock, m: number, e: number, duration: Duration): TabBlock {
  return updateMeasure(block, m, (measure) => {
    const events = [...measure.events]
    events.splice(e + 1, 0, createTabEvent(duration))
    return { ...measure, events }
  })
}

/** イベント削除。小節が空になったら(唯一の小節でなければ)小節ごと削除 */
export function removeEvent(block: TabBlock, m: number, e: number): TabBlock {
  const measure = block.measures[m]
  if (!measure) return block
  if (measure.events.length <= 1) {
    if (block.measures.length <= 1) return block
    return { ...block, measures: block.measures.filter((_, i) => i !== m) }
  }
  return updateMeasure(block, m, (msr) => ({
    ...msr,
    events: msr.events.filter((_, i) => i !== e),
  }))
}

/** 拍子を設定する。undefined で「前小節から継承」に戻す */
export function setTimeSignature(
  block: TabBlock,
  m: number,
  ts: TimeSignature | undefined,
): TabBlock {
  return updateMeasure(block, m, (measure) => ({ ...measure, timeSignature: ts }))
}

/** 1 本の弦のチューニングを変更する(stringIdx は 0 = 1弦) */
export function setStringTuning(block: TabBlock, stringIdx: number, midi: number): TabBlock {
  return { ...block, tuning: block.tuning.map((m, i) => (i === stringIdx ? midi : m)) }
}

/**
 * 弦数を変更する(4〜8)。増やすと最低弦の完全4度下を足し、
 * 減らすと低音弦側から削って、なくなった弦の音も取り除く。
 */
export function setStringCount(block: TabBlock, count: number): TabBlock {
  const c = Math.min(8, Math.max(4, count))
  if (c === block.tuning.length) return block
  let tuning = [...block.tuning]
  while (tuning.length < c) tuning.push((tuning.at(-1) ?? 40) - 5)
  tuning = tuning.slice(0, c)
  return {
    ...block,
    tuning,
    measures: block.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((ev) => ({
        ...ev,
        notes: ev.notes.filter((n) => n.string <= c),
      })),
    })),
  }
}

export function insertMeasureAfter(block: TabBlock, m: number, duration: Duration): TabBlock {
  const measures = [...block.measures]
  measures.splice(m + 1, 0, createMeasure(1, duration))
  return { ...block, measures }
}

// ---- カーソル移動 ----

export function clampPos(block: TabBlock, pos: TabPos): TabPos {
  const m = Math.min(Math.max(0, pos.m), block.measures.length - 1)
  const events = block.measures[m]?.events ?? []
  const e = Math.min(Math.max(0, pos.e), Math.max(0, events.length - 1))
  const s = Math.min(Math.max(1, pos.s), block.tuning.length)
  return { m, e, s }
}

/** 右へ。小節末なら次の小節へ。最後なら null(呼び出し側が追加を判断) */
export function nextPos(block: TabBlock, pos: TabPos): TabPos | null {
  const measure = block.measures[pos.m]
  if (!measure) return null
  if (pos.e + 1 < measure.events.length) return { ...pos, e: pos.e + 1 }
  if (pos.m + 1 < block.measures.length) return { ...pos, m: pos.m + 1, e: 0 }
  return null
}

export function prevPos(block: TabBlock, pos: TabPos): TabPos | null {
  if (pos.e > 0) return { ...pos, e: pos.e - 1 }
  if (pos.m > 0) {
    const prev = block.measures[pos.m - 1]
    return { ...pos, m: pos.m - 1, e: Math.max(0, (prev?.events.length ?? 1) - 1) }
  }
  return null
}
