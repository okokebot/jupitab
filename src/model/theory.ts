import type { KeyContext, ScaleType } from './types.ts'

/** 標準チューニング EADGBE。index 0 = 1弦(高音E) */
export const STANDARD_TUNING: number[] = [64, 59, 55, 50, 45, 40]

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

/** 弦 + フレットから実音高(MIDI 番号)を導出する。単一の真実源 */
export function pitchFromTab(tuning: number[], string: number, fret: number, capo = 0): number {
  const open = tuning[string - 1]
  if (open === undefined) throw new Error(`invalid string: ${string}`)
  return open + capo + fret
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

export function pitchClassName(pc: number, preferFlats = false): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES
  return names[((pc % 12) + 12) % 12] ?? ''
}

/** MIDI 番号 → 音名 + オクターブ(60 = C4) */
export function noteName(midi: number, preferFlats = false): string {
  const octave = Math.floor(midi / 12) - 1
  return `${pitchClassName(pitchClass(midi), preferFlats)}${octave}`
}

const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
}

/** キーのスケール構成音(ピッチクラスの集合) */
export function scalePitchClasses(key: KeyContext): Set<number> {
  const intervals = SCALE_INTERVALS[key.scale]
  return new Set(intervals.map((i) => (key.tonic + i) % 12))
}

const DEGREE_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const

/** トニックからの半音距離を度数ラベルにする(理論レンズの中核) */
export function degreeInKey(pc: number, key: KeyContext): string {
  const dist = (((pc - key.tonic) % 12) + 12) % 12
  return DEGREE_NAMES[dist] ?? ''
}

/** スケール構成音かどうか */
export function isInScale(pc: number, key: KeyContext): boolean {
  return scalePitchClasses(key).has(((pc % 12) + 12) % 12)
}
