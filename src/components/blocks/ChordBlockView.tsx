import type { ChordBlock } from '../../model/types.ts'
import { useDocStore } from '../../store/docStore.ts'

// 縦型コードダイアグラム。左 = 6弦、上 = ナット(または baseFret)
const STRING_GAP = 20
const FRET_GAP = 24
const ROWS = 5
const LEFT = 28
const TOP = 40

export function ChordBlockView({ block }: { block: ChordBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const apply = (fn: (b: ChordBlock) => ChordBlock) => updateBlock<ChordBlock>(block.id, fn)

  const stringCount = block.frets.length
  const width = LEFT + (stringCount - 1) * STRING_GAP + 28
  const height = TOP + ROWS * FRET_GAP + 16

  const stringX = (i: number) => LEFT + i * STRING_GAP // i: 0 = 6弦(左端)

  /** グリッドクリック: フレットをセット(同じ場所なら解除) */
  const handleCellClick = (stringIdx: number, row: number) => {
    const fret = block.baseFret + row
    apply((b) => ({
      ...b,
      frets: b.frets.map((f, i) => (i === stringIdx ? (f === fret ? null : fret) : f)),
    }))
  }

  /** ナット上クリック: 開放 ○ ↔ ミュート × */
  const handleHeadClick = (stringIdx: number) => {
    apply((b) => ({
      ...b,
      frets: b.frets.map((f, i) => (i === stringIdx ? (f === 0 ? null : 0) : f)),
    }))
  }

  return (
    <div className="chord-block">
      <div className="chord-form">
        <input
          className="chord-name-input"
          placeholder="コード名(Am7 など)"
          value={block.name}
          onChange={(e) => apply((b) => ({ ...b, name: e.target.value }))}
        />
        <label>
          開始フレット
          <input
            type="number"
            min={1}
            max={20}
            value={block.baseFret}
            onChange={(e) => apply((b) => ({ ...b, baseFret: Math.max(1, Number(e.target.value) || 1) }))}
          />
        </label>
        <label>
          バレー
          <select
            value={block.barres?.[0]?.fret ?? ''}
            onChange={(e) => {
              const fret = Number(e.target.value)
              apply((b) => ({
                ...b,
                barres: fret ? [{ fret, fromString: 6, toString: 1 }] : undefined,
              }))
            }}
          >
            <option value="">なし</option>
            {Array.from({ length: ROWS }, (_, r) => (
              <option key={r} value={block.baseFret + r}>
                {block.baseFret + r}F
              </option>
            ))}
          </select>
        </label>
      </div>
      <svg className="chord-svg" width={width} height={height} role="img" aria-label={`コード ${block.name || '未設定'}`}>
        <text className="chord-name" x={LEFT + ((stringCount - 1) * STRING_GAP) / 2} y={16}>
          {block.name || ' '}
        </text>
        {/* ナット or 開始フレット表示 */}
        {block.baseFret === 1 ? (
          <line className="nut" x1={stringX(0) - 1} y1={TOP} x2={stringX(stringCount - 1) + 1} y2={TOP} strokeWidth={4} />
        ) : (
          <text className="base-fret-label" x={stringX(0) - 8} y={TOP + FRET_GAP / 2 + 4}>
            {block.baseFret}
          </text>
        )}
        {/* グリッド */}
        {Array.from({ length: ROWS + 1 }, (_, r) => (
          <line
            key={`f${r}`}
            className="fret-line"
            x1={stringX(0)}
            y1={TOP + r * FRET_GAP}
            x2={stringX(stringCount - 1)}
            y2={TOP + r * FRET_GAP}
          />
        ))}
        {Array.from({ length: stringCount }, (_, i) => (
          <line
            key={`s${i}`}
            className="string-line"
            x1={stringX(i)}
            y1={TOP}
            x2={stringX(i)}
            y2={TOP + ROWS * FRET_GAP}
          />
        ))}
        {/* バレー */}
        {block.barres?.map((barre) => {
          const row = barre.fret - block.baseFret
          if (row < 0 || row >= ROWS) return null
          const y = TOP + (row + 0.5) * FRET_GAP
          // fromString/toString は弦番号(6=低音)。左端 = 6弦なので index = 6 - 弦番号
          const x1 = stringX(stringCount - barre.fromString)
          const x2 = stringX(stringCount - barre.toString)
          return (
            <rect
              key={barre.fret}
              className="barre"
              x={Math.min(x1, x2) - 6}
              y={y - 6}
              width={Math.abs(x2 - x1) + 12}
              height={12}
              rx={6}
            />
          )
        })}
        {/* 押弦・開放・ミュート */}
        {block.frets.map((fret, i) => {
          const x = stringX(i)
          const stringNo = stringCount - i // 表示上の弦番号(左端 = 6弦)
          const finger = block.fingers?.[i]
          if (fret === null || fret === 0) {
            return (
              <g key={i} className="chord-head" onClick={() => handleHeadClick(i)}>
                <rect className="hit-area" x={x - 9} y={TOP - 26} width={18} height={22} />
                <text className="open-mute" x={x} y={TOP - 10}>
                  {fret === 0 ? '○' : '×'}
                </text>
              </g>
            )
          }
          const row = fret - block.baseFret
          if (row < 0 || row >= ROWS) return null
          const y = TOP + (row + 0.5) * FRET_GAP
          return (
            <g key={i} className="chord-dot" onClick={() => handleCellClick(i, row)}>
              <circle cx={x} cy={y} r={7.5} />
              {finger != null && (
                <text x={x} y={y + 3.5}>
                  {finger === 0 ? 'T' : finger}
                </text>
              )}
              <title>{`${stringNo}弦 ${fret}F`}</title>
            </g>
          )
        })}
        {/* クリック領域 */}
        {Array.from({ length: stringCount }, (_, i) =>
          Array.from({ length: ROWS }, (_, r) => (
            <rect
              key={`hit-${i}-${r}`}
              className="hit-area"
              x={stringX(i) - STRING_GAP / 2 + 2}
              y={TOP + r * FRET_GAP + 1}
              width={STRING_GAP - 4}
              height={FRET_GAP - 2}
              onClick={() => handleCellClick(i, r)}
            />
          )),
        )}
      </svg>
      <div className="finger-row">
        指:
        {block.frets.map((fret, i) => (
          <select
            key={i}
            title={`${stringCount - i}弦の指`}
            disabled={fret === null || fret === 0}
            value={block.fingers?.[i] ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : (Number(e.target.value) as 0 | 1 | 2 | 3 | 4)
              apply((b) => {
                const fingers = [...(b.fingers ?? b.frets.map(() => null))]
                fingers[i] = v
                return { ...b, fingers }
              })
            }}
          >
            <option value="">-</option>
            <option value="0">T</option>
            {[1, 2, 3, 4].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  )
}
