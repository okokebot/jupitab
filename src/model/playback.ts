// TabBlock / ChordBlock → 再生計画(音高 + 開始秒 + 長さ)。純 TS、Web Audio 非依存。
// 実際に音を鳴らすのは audio/player.ts。時間の累積は Fraction(全音符 = 1)で
// 厳密に行い、秒への変換は最後に 1 回だけ行う。

import type { ChordBlock, TabBlock, TabNote } from './types.ts'
import { effectiveTimeSignature } from './types.ts'
import { durationValue, measureCapacity } from './duration.ts'
import { add, cmp, eq, frac, mul, toNumber, ZERO, type Fraction } from './fraction.ts'
import { pitchFromTab, STANDARD_TUNING } from './theory.ts'

export const DEFAULT_TEMPO = 120
export const MIN_TEMPO = 20
export const MAX_TEMPO = 400

export interface PlaybackNote {
  /** MIDI 番号 */
  midi: number
  /** 開始(秒) */
  start: number
  /** 長さ(秒) */
  duration: number
  /** 音量 0-1 */
  gain: number
  /** ミュート音(x)。音程のない短い打撃音で鳴らす */
  dead?: boolean
  /** パームミュート(減衰を強める) */
  palmMute?: boolean
}

/** 再生位置ハイライト用: 各イベントの開始時刻 */
export interface PlaybackMarker {
  measureIndex: number
  eventIndex: number
  /** 開始(秒) */
  start: number
}

export interface PlaybackPlan {
  notes: PlaybackNote[]
  markers: PlaybackMarker[]
  /** 最後のイベントが鳴り終わる時刻(秒) */
  total: number
}

function sub(a: Fraction, b: Fraction): Fraction {
  return add(a, frac(-b.num, b.den))
}

function noteGain(note: TabNote): number {
  if (note.articulations?.includes('ghost')) return 0.4
  if (note.articulations?.includes('accent') || note.articulations?.includes('marcato')) return 1
  return 0.75
}

interface PendingNote {
  midi: number
  startWhole: Fraction
  endWhole: Fraction
  gain: number
  dead: boolean
  palmMute: boolean
}

/**
 * TAB 譜全体の再生計画。テンポは 4分音符 = tempo(BPM)。
 * 入力途中の小節は拍子の残りを休符として扱い、あふれた小節はそのまま流す。
 */
export function planTabPlayback(block: TabBlock, tempo: number = block.tempo ?? DEFAULT_TEMPO): PlaybackPlan {
  const bpm = Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, tempo))
  const secPerWhole = 240 / bpm // 全音符 = 4分音符 4 つ分
  const capo = block.capo ?? 0

  const pending: PendingNote[] = []
  const rawMarkers: { measureIndex: number; eventIndex: number; startWhole: Fraction }[] = []
  /** タイ接続用: 弦ごとの直近の発音 */
  const lastOnString = new Map<number, PendingNote>()

  let pos = ZERO
  block.measures.forEach((measure, measureIndex) => {
    const measureStart = pos
    measure.events.forEach((event, eventIndex) => {
      rawMarkers.push({ measureIndex, eventIndex, startWhole: pos })
      const value = durationValue(event.duration)
      const end = add(pos, value)
      for (const note of event.notes) {
        // タイ: 直前まで鳴っていた同弦音を延長する(小節をまたげる)
        const prev = lastOnString.get(note.string)
        if (note.tieToPrev && prev && eq(prev.endWhole, pos)) {
          prev.endWhole = end
          continue
        }
        const staccato = note.articulations?.includes('staccato') ?? false
        const p: PendingNote = {
          midi: pitchFromTab(block.tuning, note.string, note.fret, capo),
          startWhole: pos,
          endWhole: staccato ? add(pos, mul(value, frac(1, 2))) : end,
          gain: noteGain(note),
          dead: note.dead === true,
          palmMute: note.articulations?.includes('palmMute') ?? false,
        }
        pending.push(p)
        lastOnString.set(note.string, p)
      }
      pos = end
    })
    const capacityEnd = add(measureStart, measureCapacity(effectiveTimeSignature(block.measures, measureIndex)))
    if (cmp(capacityEnd, pos) > 0) pos = capacityEnd
  })

  const toSec = (f: Fraction) => toNumber(f) * secPerWhole
  const notes: PlaybackNote[] = pending.map((p) => ({
    midi: p.midi,
    start: toSec(p.startWhole),
    duration: Math.max(0.05, toSec(sub(p.endWhole, p.startWhole))),
    gain: p.gain,
    ...(p.dead ? { dead: true } : {}),
    ...(p.palmMute ? { palmMute: true } : {}),
  }))
  const markers: PlaybackMarker[] = rawMarkers.map((m) => ({
    measureIndex: m.measureIndex,
    eventIndex: m.eventIndex,
    start: toSec(m.startWhole),
  }))
  return { notes, markers, total: toSec(pos) }
}

/** コード表のストローク 1 回分の計画(6弦側から順にずらして鳴らす) */
export function planChordPlayback(chord: ChordBlock): PlaybackPlan {
  const STRUM_GAP = 0.055
  const RING = 2.2
  const notes: PlaybackNote[] = []
  chord.frets.forEach((fret, i) => {
    if (fret === null) return
    // ChordBlock.frets は index 0 = 6弦(types.ts 参照)
    const stringNo = chord.frets.length - i
    notes.push({
      midi: pitchFromTab(STANDARD_TUNING, stringNo, fret),
      start: notes.length * STRUM_GAP,
      duration: RING,
      gain: 0.75,
    })
  })
  const last = notes.at(-1)
  return { notes, markers: [], total: last ? last.start + RING : 0 }
}
