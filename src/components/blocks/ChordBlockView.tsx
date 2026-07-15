import { useEffect, useRef, useState } from 'react'
import type { ChordBlock } from '../../model/types.ts'
import { planChordPlayback } from '../../model/playback.ts'
import { play, type PlaybackHandle } from '../../audio/player.ts'
import { CHORD_ROWS, chordGeometry } from '../../layout/chordLayout.ts'
import { INLAY_FRETS, STRING_GAP } from '../../layout/fretboardLayout.ts'
import { OrientationToggle } from './OrientationToggle.tsx'
import { useDocStore } from '../../store/docStore.ts'

/** 開放/ミュート域のツールチップ。次の状態と記号の意味を告げる(spec 004 AC-10) */
const headTitle = (fret: number | null) =>
  fret === 0
    ? '○ = 開放弦。クリックでミュート ×(鳴らさない)'
    : fret === null
      ? '× = ミュート。クリックで開放 ○'
      : 'クリックで開放 ○(押さえずに鳴らす)'

export function ChordBlockView({ block }: { block: ChordBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const apply = (fn: (b: ChordBlock) => ChordBlock) => updateBlock<ChordBlock>(block.id, fn)

  // ストローク再生(アンマウント時は止める)
  const [playing, setPlaying] = useState(false)
  const playHandle = useRef<PlaybackHandle | null>(null)
  useEffect(() => () => playHandle.current?.stop(), [])

  const togglePlay = () => {
    if (playing) {
      playHandle.current?.stop()
      return
    }
    setPlaying(true)
    playHandle.current = play(planChordPlayback(block), {
      onEnd: () => setPlaying(false),
    })
  }

  const stringCount = block.frets.length
  const mirrored = block.mirrored ?? false
  const geom = chordGeometry({ stringCount, baseFret: block.baseFret, mirrored })

  /** frets は index 0 = 6弦(データ規約)。描画座標は弦番号(1 = 1弦 = 上)ベース */
  const stringNoOf = (i: number) => stringCount - i
  const yOf = (i: number) => geom.stringY(stringNoOf(i))

  /** グリッドクリック: フレットをセット(同じ場所なら解除 = ×)。解除時は運指も消す */
  const handleCellClick = (stringIdx: number, row: number) => {
    const fret = block.baseFret + row
    apply((b) => {
      const removing = b.frets[stringIdx] === fret
      return {
        ...b,
        frets: b.frets.map((f, i) => (i === stringIdx ? (removing ? null : fret) : f)),
        fingers: removing ? b.fingers?.map((fg, i) => (i === stringIdx ? null : fg)) : b.fingers,
      }
    })
  }

  /** 開放/ミュート域クリック: 押弦中 → ○、○ ↔ ×。運指は消す(押弦がなくなるため) */
  const handleHeadClick = (stringIdx: number) => {
    apply((b) => ({
      ...b,
      frets: b.frets.map((f, i) => (i === stringIdx ? (f === 0 ? null : 0) : f)),
      fingers: b.fingers?.map((fg, i) => (i === stringIdx ? null : fg)),
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
        <OrientationToggle
          mirrored={mirrored}
          onChange={(m) => apply((b) => ({ ...b, mirrored: m || undefined }))}
        />
        <label>
          バレー
          <select
            value={block.barres?.[0]?.fret ?? ''}
            onChange={(e) => {
              const fret = Number(e.target.value)
              apply((b) => ({
                ...b,
                // 範囲は既存設定を保持(初回は全弦)
                barres: fret
                  ? [{ fret, fromString: b.barres?.[0]?.fromString ?? 6, toString: b.barres?.[0]?.toString ?? 1 }]
                  : undefined,
              }))
            }}
          >
            <option value="">なし</option>
            {Array.from({ length: CHORD_ROWS }, (_, r) => (
              <option key={r} value={block.baseFret + r}>
                {block.baseFret + r}F
              </option>
            ))}
          </select>
        </label>
        {block.barres?.[0] && (
          <label title="バレーの範囲(部分バレーは低音側の弦を変える)">
            範囲
            <select
              value={block.barres[0].fromString}
              onChange={(e) => {
                const fromString = Number(e.target.value)
                apply((b) => {
                  const barre = b.barres?.[0]
                  if (!barre) return b
                  return { ...b, barres: [{ ...barre, fromString, toString: Math.min(barre.toString, fromString) }] }
                })
              }}
            >
              {Array.from({ length: stringCount }, (_, i) => stringCount - i).map((s) => (
                <option key={s} value={s}>
                  {s}弦
                </option>
              ))}
            </select>
            〜
            <select
              value={block.barres[0].toString}
              onChange={(e) => {
                const toString = Number(e.target.value)
                apply((b) => {
                  const barre = b.barres?.[0]
                  if (!barre) return b
                  return { ...b, barres: [{ ...barre, toString, fromString: Math.max(barre.fromString, toString) }] }
                })
              }}
            >
              {Array.from({ length: stringCount }, (_, i) => stringCount - i).map((s) => (
                <option key={s} value={s}>
                  {s}弦
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn"
          disabled={block.frets.every((f) => f === null)}
          onClick={togglePlay}
          title="コードをストロークで鳴らす"
        >
          {playing ? '■ 停止' : '▶ 鳴らす'}
        </button>
      </div>
      <svg
        className="chord-svg"
        width={geom.width}
        height={geom.height}
        role="img"
        aria-label={`コード ${block.name || '未設定'}${mirrored ? '(左利き表示)' : ''}`}
      >
        {/* コード名行(指板の translate 外) */}
        <text className="chord-name" x={geom.nameX} y={16}>
          {block.name || ' '}
        </text>
        {/* 反転時のみ、図単体でも向きが分かる手がかり(コード名行の右端。番号行だと 2 桁フレットと衝突する) */}
        {mirrored && (
          <text className="head-cue" x={geom.width - 2} y={16}>
            ヘッド側 ▷
          </text>
        )}
        <g transform={`translate(0, ${geom.boardOffsetY})`}>
          {/* フレット線(縦)と番号。baseFret = 1 のときだけ fret 0 = ナットが現れる */}
          {Array.from({ length: CHORD_ROWS + 1 }, (_, i) => {
            const fret = block.baseFret - 1 + i
            const x = geom.fretLineX(i)
            return (
              <g key={i}>
                <line
                  className={fret === 0 ? 'nut' : 'fret-line'}
                  x1={x}
                  y1={geom.stringY(1)}
                  x2={x}
                  y2={geom.stringY(stringCount)}
                />
                {i > 0 && (
                  <text className="fret-number" x={geom.fretNumberX(fret)} y={geom.boardHeight - 8}>
                    {fret}
                  </text>
                )}
              </g>
            )
          })}
          {/* ポジションマーク(指板図と同じ。コード表をポジションとして読めるように) */}
          {Array.from({ length: CHORD_ROWS }, (_, i) => {
            const fret = block.baseFret + i
            if (!INLAY_FRETS.includes(fret)) return null
            const x = geom.inlayX(fret)
            const midY = (geom.stringY(1) + geom.stringY(stringCount)) / 2
            return fret % 12 === 0 ? (
              <g key={fret}>
                <circle className="inlay" cx={x} cy={midY - STRING_GAP} r={3.5} />
                <circle className="inlay" cx={x} cy={midY + STRING_GAP} r={3.5} />
              </g>
            ) : (
              <circle key={fret} className="inlay" cx={x} cy={midY} r={3.5} />
            )
          })}
          {/* 弦(横)。6弦側ほど太く = 反転時にも上下の向きが分かる手がかり */}
          {Array.from({ length: stringCount }, (_, s) => (
            <line
              key={s}
              className="string-line"
              x1={geom.stringX1}
              y1={geom.stringY(s + 1)}
              x2={geom.stringX2}
              y2={geom.stringY(s + 1)}
              strokeWidth={0.8 + s * 0.25}
            />
          ))}
          {/* バレー(縦帯)。ドットと同じ太さのカプセル形 */}
          {block.barres?.map((barre) => {
            const row = barre.fret - block.baseFret
            if (row < 0 || row >= CHORD_ROWS) return null
            const x = geom.markerX(barre.fret)
            const yTop = geom.stringY(barre.toString)
            const yBottom = geom.stringY(barre.fromString)
            return (
              <rect
                key={barre.fret}
                className="barre"
                x={x - 9}
                y={yTop - 9}
                width={18}
                height={yBottom - yTop + 18}
                rx={9}
              />
            )
          })}
          {/* グリッドのクリック領域 */}
          {block.frets.map((_, i) =>
            Array.from({ length: CHORD_ROWS }, (_, r) => {
              const hit = geom.hitRect(stringNoOf(i), block.baseFret + r)
              return (
                <rect
                  key={`hit-${i}-${r}`}
                  className="hit-area"
                  x={hit.x}
                  y={hit.y}
                  width={hit.width}
                  height={hit.height}
                  onClick={() => handleCellClick(i, r)}
                />
              )
            }),
          )}
          {/* 開放/ミュート域。開始フレットに関係なく全弦・常時クリック可能(spec 004 AC-4) */}
          {block.frets.map((fret, i) => {
            const y = yOf(i)
            const x0 = geom.markerX(0)
            const hit = geom.hitRect(stringNoOf(i), 0)
            const fretted = fret !== null && fret >= 1
            return (
              <g key={`head-${i}`} className="chord-head" onClick={() => handleHeadClick(i)}>
                <rect className="hit-area" x={hit.x} y={hit.y} width={hit.width} height={hit.height} />
                {!fretted && (
                  <text className="open-mute" x={x0} y={y + 4}>
                    {fret === 0 ? '○' : '×'}
                  </text>
                )}
                {fretted && (
                  <text className="open-mute-preview" x={x0} y={y + 4}>
                    ○
                  </text>
                )}
                <title>{headTitle(fret)}</title>
              </g>
            )
          })}
          {/* 押弦マーカー(最前面 = クリックを受ける) */}
          {block.frets.map((fret, i) => {
            if (fret === null || fret === 0) return null
            const row = fret - block.baseFret
            if (row < 0 || row >= CHORD_ROWS) return null
            const finger = block.fingers?.[i]
            const x = geom.markerX(fret)
            const y = yOf(i)
            return (
              <g key={`dot-${i}`} className="chord-dot" onClick={() => handleCellClick(i, row)}>
                <circle cx={x} cy={y} r={9} />
                {finger != null && (
                  <text x={x} y={y + 3.5}>
                    {finger === 0 ? 'T' : finger}
                  </text>
                )}
                <title>{`${stringNoOf(i)}弦 ${fret}F(クリックで解除 = ミュート ×)`}</title>
              </g>
            )
          })}
        </g>
      </svg>
      <div className="finger-row">
        指:
        {block.frets.map((fret, i) => (
          <span key={i} className="finger-cell">
            <span className="finger-string-label">{stringNoOf(i)}弦</span>
            <select
              title={`${stringNoOf(i)}弦の指`}
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
          </span>
        ))}
      </div>
    </div>
  )
}
