import { useState } from 'react'
import type { FretboardBlock, FretMarker, MarkerStyle } from '../../model/types.ts'
import { noteName, pitchFromTab } from '../../model/theory.ts'
import { useDocStore } from '../../store/docStore.ts'

const FRET_W = 46
const STRING_GAP = 22
const LEFT = 40
const TOP = 24
const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
const STYLE_LABELS: { value: MarkerStyle; label: string }[] = [
  { value: 'root', label: 'ルート' },
  { value: 'primary', label: '通常' },
  { value: 'muted', label: '弱' },
]

export function FretboardBlockView({ block }: { block: FretboardBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const [selected, setSelected] = useState<{ string: number; fret: number } | null>(null)

  const apply = (fn: (b: FretboardBlock) => FretboardBlock) => updateBlock<FretboardBlock>(block.id, fn)

  const stringCount = block.tuning.length
  const fretCount = block.fretEnd - block.fretStart
  const width = LEFT + fretCount * FRET_W + 20
  const height = TOP + (stringCount - 1) * STRING_GAP + 36

  const stringYPos = (s: number) => TOP + (s - 1) * STRING_GAP
  /** フレット f を押さえる位置(フレット間の中央)。開放弦はナットの左 */
  const markerX = (f: number) =>
    f === 0 ? LEFT - 16 : LEFT + (f - block.fretStart - 0.5) * FRET_W

  const markerAt = (string: number, fret: number): FretMarker | undefined =>
    block.markers.find((m) => m.string === string && m.fret === fret)

  const handleClick = (string: number, fret: number) => {
    if (markerAt(string, fret)) {
      setSelected({ string, fret })
    } else {
      apply((b) => ({ ...b, markers: [...b.markers, { string, fret, style: 'primary' }] }))
      setSelected({ string, fret })
    }
  }

  const updateSelected = (fn: (m: FretMarker) => FretMarker | null) => {
    if (!selected) return
    apply((b) => ({
      ...b,
      markers: b.markers.flatMap((m) => {
        if (m.string !== selected.string || m.fret !== selected.fret) return [m]
        const next = fn(m)
        return next ? [next] : []
      }),
    }))
  }

  const selectedMarker = selected ? markerAt(selected.string, selected.fret) : undefined

  return (
    <div className="fretboard-block">
      <div className="fretboard-toolbar">
        <input
          className="tab-label-input"
          placeholder="ラベル(例: Am ペンタ ボックス1)"
          value={block.label ?? ''}
          onChange={(e) => apply((b) => ({ ...b, label: e.target.value || undefined }))}
        />
        <label>
          フレット
          <input
            type="number"
            min={0}
            max={22}
            value={block.fretStart}
            onChange={(e) => {
              const v = Math.max(0, Number(e.target.value))
              apply((b) => ({ ...b, fretStart: v, fretEnd: Math.max(b.fretEnd, v + 3) }))
            }}
          />
          〜
          <input
            type="number"
            min={block.fretStart + 3}
            max={24}
            value={block.fretEnd}
            onChange={(e) => {
              const v = Math.min(24, Number(e.target.value))
              apply((b) => ({ ...b, fretEnd: Math.max(v, b.fretStart + 3) }))
            }}
          />
        </label>
        {selectedMarker && (
          <span className="marker-editor">
            <input
              className="marker-label-input"
              placeholder="ラベル(R, ♭3…)"
              value={selectedMarker.label ?? ''}
              onChange={(e) => updateSelected((m) => ({ ...m, label: e.target.value || undefined }))}
            />
            {STYLE_LABELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${selectedMarker.style === value ? 'btn-active' : ''}`}
                onClick={() => updateSelected((m) => ({ ...m, style: value }))}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-sm danger"
              onClick={() => {
                updateSelected(() => null)
                setSelected(null)
              }}
            >
              削除
            </button>
            <span className="tab-status">
              {noteName(
                pitchFromTab(block.tuning, selectedMarker.string, selectedMarker.fret),
              )}
            </span>
          </span>
        )}
      </div>
      <svg className="fretboard-svg" width={width} height={height} role="img" aria-label={block.label ?? '指板図'}>
        {/* フレット線(縦) */}
        {Array.from({ length: fretCount + 1 }, (_, i) => {
          const fret = block.fretStart + i
          const x = LEFT + i * FRET_W
          return (
            <g key={i}>
              <line
                className={fret === 0 ? 'nut' : 'fret-line'}
                x1={x}
                y1={stringYPos(1)}
                x2={x}
                y2={stringYPos(stringCount)}
              />
              {i > 0 && (
                <text className="fret-number" x={x - FRET_W / 2} y={height - 8}>
                  {fret}
                </text>
              )}
            </g>
          )
        })}
        {/* ポジションマーク */}
        {Array.from({ length: fretCount }, (_, i) => {
          const fret = block.fretStart + i + 1
          if (!INLAY_FRETS.includes(fret)) return null
          const x = LEFT + (i + 0.5) * FRET_W
          const midY = (stringYPos(1) + stringYPos(stringCount)) / 2
          return fret % 12 === 0 ? (
            <g key={fret}>
              <circle className="inlay" cx={x} cy={midY - STRING_GAP} r={3.5} />
              <circle className="inlay" cx={x} cy={midY + STRING_GAP} r={3.5} />
            </g>
          ) : (
            <circle key={fret} className="inlay" cx={x} cy={midY} r={3.5} />
          )
        })}
        {/* 弦(横) */}
        {Array.from({ length: stringCount }, (_, i) => (
          <line
            key={i}
            className="string-line"
            x1={LEFT}
            y1={stringYPos(i + 1)}
            x2={LEFT + fretCount * FRET_W}
            y2={stringYPos(i + 1)}
            strokeWidth={0.8 + i * 0.25}
          />
        ))}
        {/* クリック領域(開放弦含む) */}
        {Array.from({ length: stringCount }, (_, si) =>
          Array.from({ length: fretCount + 1 }, (_, fi) => {
            const string = si + 1
            const fret = fi === 0 ? (block.fretStart === 0 ? 0 : -1) : block.fretStart + fi
            if (fret < 0) return null
            return (
              <rect
                key={`${string}-${fret}`}
                className="hit-area"
                x={markerX(fret) - FRET_W / 2 + 2}
                y={stringYPos(string) - STRING_GAP / 2}
                width={FRET_W - 4}
                height={STRING_GAP}
                onClick={() => handleClick(string, fret)}
              />
            )
          }),
        )}
        {/* マーカー */}
        {block.markers.map((m) => {
          const x = markerX(m.fret)
          const y = stringYPos(m.string)
          const isSelected = selected?.string === m.string && selected?.fret === m.fret
          return (
            <g
              key={`${m.string}-${m.fret}`}
              className={`marker marker-${m.style ?? 'primary'} ${isSelected ? 'marker-selected' : ''}`}
              onClick={() => handleClick(m.string, m.fret)}
            >
              <circle cx={x} cy={y} r={9} />
              {m.label && (
                <text x={x} y={y + 3.5}>
                  {m.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
