// Fretpad のデータモデル。
// 音高は保存せず「弦 + フレット」から tuning/capo を使って導出する(theory.ts)。
// 音価は Fraction(fraction.ts)で厳密に計算する。

// ---- 音価 ----
export type DurationBase = 1 | 2 | 4 | 8 | 16 | 32 | 64

export interface Duration {
  base: DurationBase
  /** 付点・複付点 */
  dots: 0 | 1 | 2
  /** 連符: 3連符 = { actual: 3, normal: 2 } */
  tuplet?: { actual: number; normal: number }
}

export interface TimeSignature {
  beats: number
  beatUnit: 2 | 4 | 8 | 16
}

// ---- 音符 ----
export type Articulation =
  | 'staccato'
  | 'accent'
  | 'marcato'
  | 'tenuto'
  | 'palmMute'
  | 'letRing'
  | 'vibrato'
  | 'ghost'

export interface Bend {
  /** 半音単位。0.5 = クォーターチョーキング(¼) */
  semitones: number
  kind: 'bend' | 'bendRelease' | 'prebend'
}

export type Legato = 'hammer' | 'pull' | 'slide'

export interface TabNote {
  /** 1 = 1弦(高音E)〜 弦数 */
  string: number
  /** 0 = 開放 */
  fret: number
  /** ミュート音(x 表記)。fret は位置情報として保持 */
  dead?: boolean
  /** 運指(0 = 親指) */
  finger?: 0 | 1 | 2 | 3 | 4
  /** 前イベントの同弦音とタイで結合(小節をまたげる) */
  tieToPrev?: boolean
  articulations?: Articulation[]
  /** 次の音への接続(H/P/S) */
  legatoToNext?: Legato
  /** 不定音程からのスライドイン(音の前に / を描く) */
  slideIn?: boolean
  /** 不定音程へのスライドアウト(音の後に \ を描く) */
  slideOut?: boolean
  bend?: Bend
  harmonic?: 'natural' | 'artificial'
}

// ---- イベント(同時発音の単位)・小節 ----
export interface TabEvent {
  id: string
  duration: Duration
  /** 和音 = 複数。空配列 = 休符 */
  notes: TabNote[]
  /** コード名("Fm7" など)。譜の上に表示 */
  chord?: string
  /** メモ("※ 3度トップの形" など)。譜の下に表示 */
  memo?: string
}

export interface Measure {
  id: string
  /** 省略時は前小節を継承(先頭のデフォルトは 4/4) */
  timeSignature?: TimeSignature
  events: TabEvent[]
}

// ---- 理論レンズ(Phase 1)----
export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'

export interface KeyContext {
  /** ピッチクラス 0-11(0 = C) */
  tonic: number
  scale: ScaleType
  preferFlats?: boolean
}

// ---- ブロック ----
export interface TabBlock {
  id: string
  type: 'tab'
  label?: string
  /** 各弦の開放弦 MIDI 番号。index 0 = 1弦。標準 EADGBE = [64,59,55,50,45,40] */
  tuning: number[]
  capo?: number
  /** 将来の再生用 */
  tempo?: number
  keyContext?: KeyContext
  measures: Measure[]
}

export type MarkerStyle = 'root' | 'primary' | 'muted'

export interface FretMarker {
  string: number
  fret: number
  label?: string
  style?: MarkerStyle
}

export interface FretboardBlock {
  id: string
  type: 'fretboard'
  label?: string
  tuning: number[]
  fretStart: number
  fretEnd: number
  markers: FretMarker[]
  keyContext?: KeyContext
  /** 左右反転(左利き)表示。省略 = false = 右利き表示(ADR 0001: 省略可能フィールドの追加は schemaVersion を上げない) */
  mirrored?: boolean
  /** スケール自動マーカーのラベル表示。省略 = 'degree'(度数)(ADR 0001 に同じ) */
  labelMode?: 'degree' | 'name' | 'none'
}

export interface Barre {
  fret: number
  fromString: number
  toString: number
}

export interface ChordBlock {
  id: string
  type: 'chord'
  /** 表示名("Am7" など)。解析は将来 */
  name: string
  /** index 0 = 6弦 → 5 = 1弦。null = ミュート、0 = 開放 */
  frets: (number | null)[]
  fingers?: (0 | 1 | 2 | 3 | 4 | null)[]
  baseFret: number
  barres?: Barre[]
}

export interface TextBlock {
  id: string
  type: 'text'
  markdown: string
}

export type Block = TextBlock | TabBlock | FretboardBlock | ChordBlock
export type BlockType = Block['type']

export interface FretpadDoc {
  schemaVersion: 1
  id: string
  title: string
  blocks: Block[]
  tags?: string[]
  /** ISO 8601 */
  createdAt: string
  updatedAt: string
}

export const DEFAULT_TIME_SIGNATURE: TimeSignature = { beats: 4, beatUnit: 4 }

/** 小節の実効拍子(省略時は前小節から継承) */
export function effectiveTimeSignature(measures: Measure[], index: number): TimeSignature {
  for (let i = index; i >= 0; i--) {
    const ts = measures[i]?.timeSignature
    if (ts) return ts
  }
  return DEFAULT_TIME_SIGNATURE
}
