/**
 * 指板図ブロックのジオメトリ計算(純関数・React 非依存)。
 * 左右反転(mirrored)はここで一元処理し、コンポーネントに X 座標の直書きを残さない
 * (spec 002)。tabLayout.ts と同様、Phase 1 の画像出力で再利用する。
 */

/** ポジションマークを打つフレット */
export const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]

export const FRET_W = 46
export const STRING_GAP = 22

const NUT_MARGIN = 40 // ナット側余白(開放弦マーカー用)
const FAR_MARGIN = 20 // 反対側余白
const TOP = 24
const BOTTOM = 36 // フレット番号行を含む
const OPEN_OFFSET = 16 // ナットから開放弦マーカー中心までの距離
const HIT_W = FRET_W - 4
const OPEN_HIT_W = 28 // 開放弦セル。ナットを跨がず第 1 セルと重ねない幅

export interface FretboardGeometryInput {
  stringCount: number
  fretStart: number
  fretEnd: number
  mirrored?: boolean
}

export interface HitRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FretboardGeometry {
  width: number
  height: number
  /** 弦の Y(string は 1 = 1弦)。反転の影響を受けない */
  stringY: (string: number) => number
  /** 弦線の水平範囲(ナット〜最終フレット線)。反転後も x1 <= x2 */
  stringX1: number
  stringX2: number
  /** i 本目のフレット線 X(i = 0 がナット側 = fretStart 側) */
  fretLineX: (i: number) => number
  /** フレット番号ラベルの中心 X(フレット間の中央) */
  fretNumberX: (fret: number) => number
  /** ポジションマークの中心 X */
  inlayX: (fret: number) => number
  /** マーカー中心 X。fret 0 = 開放弦はナットの外側 */
  markerX: (fret: number) => number
  /** クリック領域。マーカーと同じ座標源から導出する */
  hitRect: (string: number, fret: number) => HitRect
}

export function fretboardGeometry({
  stringCount,
  fretStart,
  fretEnd,
  mirrored = false,
}: FretboardGeometryInput): FretboardGeometry {
  const fretCount = fretEnd - fretStart
  const width = NUT_MARGIN + fretCount * FRET_W + FAR_MARGIN
  const height = TOP + (stringCount - 1) * STRING_GAP + BOTTOM

  const flip = (x: number) => (mirrored ? width - x : x)
  const rawFretLineX = (i: number) => NUT_MARGIN + i * FRET_W
  /** フレット f の中心(押さえる位置)。開放弦はナットの外側 */
  const rawCellX = (fret: number) =>
    fret === 0 ? NUT_MARGIN - OPEN_OFFSET : NUT_MARGIN + (fret - fretStart - 0.5) * FRET_W

  const stringY = (string: number) => TOP + (string - 1) * STRING_GAP
  const nutX = flip(rawFretLineX(0))
  const lastX = flip(rawFretLineX(fretCount))

  return {
    width,
    height,
    stringY,
    stringX1: Math.min(nutX, lastX),
    stringX2: Math.max(nutX, lastX),
    fretLineX: (i) => flip(rawFretLineX(i)),
    fretNumberX: (fret) => flip(rawCellX(fret)),
    inlayX: (fret) => flip(rawCellX(fret)),
    markerX: (fret) => flip(rawCellX(fret)),
    hitRect: (string, fret) => {
      const w = fret === 0 ? OPEN_HIT_W : HIT_W
      return {
        x: flip(rawCellX(fret)) - w / 2,
        y: stringY(string) - STRING_GAP / 2,
        width: w,
        height: STRING_GAP,
      }
    },
  }
}
