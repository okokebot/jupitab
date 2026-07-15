/**
 * コード表ブロックのジオメトリ(純関数・React 非依存)。
 * 横型コード表 = 「baseFret から CHORD_ROWS フレット分の指板図 + コード名行」なので、
 * fretboardGeometry の薄いラッパーとして実装する(spec 004)。反転・開放弦域・
 * ヒット領域の座標は fretboardLayout.ts の実装(spec 002)をそのまま継承する。
 */
import { fretboardGeometry, type FretboardGeometry } from './fretboardLayout.ts'

/** 表示するフレット数 */
export const CHORD_ROWS = 5
/** SVG 上部に確保するコード名行の高さ */
export const CHORD_NAME_H = 22

export interface ChordGeometryInput {
  stringCount: number
  baseFret: number
  mirrored?: boolean
}

export interface ChordGeometry extends FretboardGeometry {
  /** 指板部分の高さ(fret 番号行を含む) */
  boardHeight: number
  /** 指板部分を <g transform> で下げるオフセット(= コード名行の高さ) */
  boardOffsetY: number
  /** コード名の中心 X。反転の影響を受けない */
  nameX: number
}

export function chordGeometry({ stringCount, baseFret, mirrored = false }: ChordGeometryInput): ChordGeometry {
  const fretStart = baseFret - 1
  const board = fretboardGeometry({
    stringCount,
    fretStart,
    fretEnd: fretStart + CHORD_ROWS,
    mirrored,
  })
  return {
    ...board,
    boardHeight: board.height,
    // SVG 全体の最終高さはここで一本化する(View 側で足さない)
    height: board.height + CHORD_NAME_H,
    boardOffsetY: CHORD_NAME_H,
    nameX: board.width / 2,
  }
}
