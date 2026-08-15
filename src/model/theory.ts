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
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
}

/** モーダルスケールの特徴音(親スケールとの差分となる度数の半音距離。複数ありうる) */
const MODAL_CHARACTERISTIC_INTERVALS: Partial<Record<ScaleType, number[]>> = {
  dorian: [9], // 6(長6度) — ナチュラルマイナーの ♭6 との差
  mixolydian: [10], // ♭7 — メジャーの 7 との差
  phrygian: [1], // ♭2 — ナチュラルマイナーの 2 との差
  lydian: [6], // #4(ラベル表示は ♭5) — メジャーの 4 との差
  locrian: [1, 6], // ♭2 と ♭5 — ナチュラルマイナーの 2・5 との差
}

/** トニックからの相対半音距離(0-11)。degreeInKey と定義がずれないよう共有する */
function relativeDegree(pc: number, tonic: number): number {
  return (((pc - tonic) % 12) + 12) % 12
}

/** モーダルスケールの特徴音か。呼び出し側はスケール構成音(scalePitchClasses に含まれる pc)に対して呼ぶ前提 */
export function isCharacteristicTone(pc: number, key: KeyContext): boolean {
  const intervals = MODAL_CHARACTERISTIC_INTERVALS[key.scale]
  if (intervals === undefined) return false
  return intervals.includes(relativeDegree(pc, key.tonic))
}

/** キーのスケール構成音(ピッチクラスの集合) */
export function scalePitchClasses(key: KeyContext): Set<number> {
  const intervals = SCALE_INTERVALS[key.scale]
  return new Set(intervals.map((i) => (key.tonic + i) % 12))
}

const DEGREE_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'] as const

/** 長6度(9)と長7度(11)を両方持つスケール。この場合トライトーンは ♭5 でなく ♯4 と綴る(リディアン等) */
const SHARP_FOURTH_SCALES = new Set<ScaleType>(
  (Object.keys(SCALE_INTERVALS) as ScaleType[]).filter((scale) => {
    const intervals = SCALE_INTERVALS[scale]
    return intervals.includes(9) && intervals.includes(11)
  }),
)

/** トニックからの半音距離を度数ラベルにする(理論レンズの中核) */
export function degreeInKey(pc: number, key: KeyContext): string {
  const degree = relativeDegree(pc, key.tonic)
  if (degree === 6 && SHARP_FOURTH_SCALES.has(key.scale)) return '♯4'
  return DEGREE_NAMES[degree] ?? ''
}

/** スケール構成音かどうか */
export function isInScale(pc: number, key: KeyContext): boolean {
  return scalePitchClasses(key).has(((pc % 12) + 12) % 12)
}

// ---- 指板図の自動マーキング(spec 003)----

export interface ScalePosition {
  /** 1 = 1弦(高音 E) */
  string: number
  fret: number
  /** ピッチクラス 0-11 */
  pc: number
  isRoot: boolean
  /** モーダルスケールの特徴音(例: ドリアンの 6 度) */
  isCharacteristic: boolean
}

/**
 * 表示フレット範囲内のスケール構成音の位置。
 * 範囲は指板図の描画実態に合わせ fretStart+1〜fretEnd、fretStart === 0 のときのみ開放弦(0)を含む。
 * 音高は保存せず毎回 pitchFromTab から導出する(単一の真実源)。
 */
export function scalePositions(
  tuning: number[],
  fretStart: number,
  fretEnd: number,
  key: KeyContext,
): ScalePosition[] {
  const pcs = scalePitchClasses(key)
  // 表示範囲の規則: fretStart === 0 なら開放弦(0)込みの連番、それ以外は fretStart+1 から
  const firstFret = fretStart === 0 ? 0 : fretStart + 1

  const positions: ScalePosition[] = []
  for (let string = 1; string <= tuning.length; string++) {
    for (let fret = firstFret; fret <= fretEnd; fret++) {
      const pc = pitchClass(pitchFromTab(tuning, string, fret))
      if (pcs.has(pc))
        positions.push({
          string,
          fret,
          pc,
          isRoot: pc === key.tonic,
          isCharacteristic: isCharacteristicTone(pc, key),
        })
    }
  }
  return positions
}
