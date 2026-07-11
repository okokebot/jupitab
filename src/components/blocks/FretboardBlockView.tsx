import { useState } from 'react'
import type { FretboardBlock, FretMarker, MarkerStyle, ScaleType } from '../../model/types.ts'
import { degreeInKey, noteName, pitchClassName, pitchFromTab, scalePositions } from '../../model/theory.ts'
import { INLAY_FRETS, STRING_GAP, fretboardGeometry } from '../../layout/fretboardLayout.ts'
import { useDocStore } from '../../store/docStore.ts'

const STYLE_LABELS: { value: MarkerStyle; label: string }[] = [
  { value: 'root', label: 'ルート' },
  { value: 'primary', label: '通常' },
  { value: 'muted', label: '弱' },
]

/** ルート選択肢。異名同音は併記してどちらの表記でも探せるようにする(spec 003) */
const ROOT_OPTIONS: { pc: number; label: string }[] = [
  { pc: 0, label: 'C' },
  { pc: 1, label: 'C# / D♭' },
  { pc: 2, label: 'D' },
  { pc: 3, label: 'D# / E♭' },
  { pc: 4, label: 'E' },
  { pc: 5, label: 'F' },
  { pc: 6, label: 'F# / G♭' },
  { pc: 7, label: 'G' },
  { pc: 8, label: 'G# / A♭' },
  { pc: 9, label: 'A' },
  { pc: 10, label: 'A# / B♭' },
  { pc: 11, label: 'B' },
]

/** 自動マーカーのラベル表示。「点のみ」は度数を自分で思い出す自己テストにも使える */
const LABEL_MODE_OPTIONS: { value: NonNullable<FretboardBlock['labelMode']>; label: string }[] = [
  { value: 'degree', label: '度数' },
  { value: 'name', label: '音名' },
  { value: 'none', label: '点のみ' },
]

/** スケール選択肢。見出しは学習経路の言葉でグルーピング(理論初学者向け) */
const SCALE_GROUPS: { heading: string; scales: { value: ScaleType; label: string }[] }[] = [
  {
    heading: 'まずはこれ',
    scales: [
      { value: 'minorPentatonic', label: 'マイナーペンタトニック' },
      { value: 'majorPentatonic', label: 'メジャーペンタトニック' },
    ],
  },
  {
    heading: '次のステップ',
    scales: [
      { value: 'major', label: 'メジャー(長調)' },
      { value: 'naturalMinor', label: 'ナチュラルマイナー(短調)' },
      { value: 'blues', label: 'ブルース' },
    ],
  },
  {
    heading: '慣れてきたら',
    scales: [
      { value: 'harmonicMinor', label: 'ハーモニックマイナー' },
      { value: 'melodicMinor', label: 'メロディックマイナー' },
      { value: 'dorian', label: 'ドリアン' },
      { value: 'mixolydian', label: 'ミクソリディアン' },
    ],
  },
]

export function FretboardBlockView({ block }: { block: FretboardBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const [selected, setSelected] = useState<{ string: number; fret: number } | null>(null)
  /** keyContext 未設定時のルート選択値。A = 最初の一歩の定番(A マイナーペンタ)に合わせる */
  const [draftRoot, setDraftRoot] = useState(9)

  const apply = (fn: (b: FretboardBlock) => FretboardBlock) => updateBlock<FretboardBlock>(block.id, fn)

  const key = block.keyContext
  const rootShown = key?.tonic ?? draftRoot

  const setRoot = (pc: number) => {
    if (key) {
      // スプレッドで preferFlats 等を保持する(spec 003 design)
      apply((b) => (b.keyContext ? { ...b, keyContext: { ...b.keyContext, tonic: pc } } : b))
    } else {
      setDraftRoot(pc)
    }
  }

  const setScale = (value: string) => {
    if (value === '') {
      apply((b) => ({ ...b, keyContext: undefined }))
    } else {
      const scale = value as ScaleType
      apply((b) => ({ ...b, keyContext: { ...b.keyContext, tonic: rootShown, scale } }))
    }
  }

  // ---- スケール自動マーカー(導出表示: 保存せず表示のたびに計算する)----
  const labelMode = block.labelMode ?? 'degree'
  const autoPositions = key ? scalePositions(block.tuning, block.fretStart, block.fretEnd, key) : []
  const autoAt = (string: number, fret: number) =>
    autoPositions.find((p) => p.string === string && p.fret === fret)
  /** 現在の表示モードでのラベル(labelMode 'none' のときは呼び出し側でガード) */
  const derivedLabel = (pc: number) =>
    key ? (labelMode === 'name' ? pitchClassName(pc, key.preferFlats) : degreeInKey(pc, key)) : ''
  /** ホバーツールチップ用「音名(度数)」 */
  const hoverTitle = (pc: number) =>
    key ? `${pitchClassName(pc, key.preferFlats)}(${degreeInKey(pc, key)})` : ''

  const stringCount = block.tuning.length
  const fretCount = block.fretEnd - block.fretStart
  const mirrored = block.mirrored ?? false
  const geom = fretboardGeometry({
    stringCount,
    fretStart: block.fretStart,
    fretEnd: block.fretEnd,
    mirrored,
  })

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
        <span className="orientation-toggle">
          向き
          <button
            type="button"
            className={`btn btn-sm ${!mirrored ? 'btn-active' : ''}`}
            aria-pressed={!mirrored}
            title="一般的な指板図の向き(ヘッドが左)"
            onClick={() => apply((b) => ({ ...b, mirrored: undefined }))}
          >
            右利き
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mirrored ? 'btn-active' : ''}`}
            aria-pressed={mirrored}
            title="左右反転して表示します(ヘッドが右)。弦の並びは変わりません"
            onClick={() => apply((b) => ({ ...b, mirrored: true }))}
          >
            左利き
          </button>
        </span>
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
      {/* 理論レンズ(スケール自動表示)の設定行。ブロック属性の行とは分けて情報をグルーピングする */}
      <div className="fretboard-toolbar fretboard-lens">
        <label>
          ルート
          <select value={rootShown} onChange={(e) => setRoot(Number(e.target.value))}>
            {ROOT_OPTIONS.map((o) => (
              <option key={o.pc} value={o.pc}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          スケール
          <select value={key?.scale ?? ''} onChange={(e) => setScale(e.target.value)}>
            <option value="">なし(自動表示オフ)</option>
            {SCALE_GROUPS.map((g) => (
              <optgroup key={g.heading} label={g.heading}>
                {g.scales.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {key && (
          <span className="label-mode-toggle">
            表示
            {LABEL_MODE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${labelMode === value ? 'btn-active' : ''}`}
                aria-pressed={labelMode === value}
                onClick={() => apply((b) => ({ ...b, labelMode: value }))}
              >
                {label}
              </button>
            ))}
          </span>
        )}
        {key && labelMode === 'name' && (
          <button
            type="button"
            className="btn btn-sm"
            title="音名の ♯/♭ 表記を切り替えます"
            onClick={() =>
              apply((b) =>
                b.keyContext
                  ? { ...b, keyContext: { ...b.keyContext, preferFlats: !b.keyContext.preferFlats } }
                  : b,
              )
            }
          >
            {key.preferFlats ? '♭表記' : '♯表記'}
          </button>
        )}
        {!key && (
          <span className="lens-hint">
            スケールを選ぶと、その音が指板に自動表示されます(ルートは A から変更できます)
          </span>
        )}
      </div>
      <svg
        className="fretboard-svg"
        width={geom.width}
        height={geom.height}
        role="img"
        aria-label={`${block.label ?? '指板図'}${mirrored ? '(左利き表示)' : ''}`}
      >
        {/* フレット線(縦) */}
        {Array.from({ length: fretCount + 1 }, (_, i) => {
          const fret = block.fretStart + i
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
                <text className="fret-number" x={geom.fretNumberX(fret)} y={geom.height - 8}>
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
        {/* 弦(横) */}
        {Array.from({ length: stringCount }, (_, i) => (
          <line
            key={i}
            className="string-line"
            x1={geom.stringX1}
            y1={geom.stringY(i + 1)}
            x2={geom.stringX2}
            y2={geom.stringY(i + 1)}
            strokeWidth={0.8 + i * 0.25}
          />
        ))}
        {/* クリック領域(開放弦含む) */}
        {Array.from({ length: stringCount }, (_, si) =>
          Array.from({ length: fretCount + 1 }, (_, fi) => {
            const string = si + 1
            const fret = fi === 0 ? (block.fretStart === 0 ? 0 : -1) : block.fretStart + fi
            if (fret < 0) return null
            const rect = geom.hitRect(string, fret)
            const auto = autoAt(string, fret)
            return (
              <rect
                key={`${string}-${fret}`}
                className="hit-area"
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                onClick={() => handleClick(string, fret)}
              >
                {/* 自動マーカー本体は pointer-events: none のため、ツールチップはヒット領域側に付ける */}
                {auto && <title>{hoverTitle(auto.pc)}</title>}
              </rect>
            )
          }),
        )}
        {/* スケール自動マーカー(手動マーカーより背面に描き、クリックはヒット領域へ透過) */}
        {key && (
          <g className="auto-markers">
            {autoPositions.map((p) => {
              const x = geom.markerX(p.fret)
              const y = geom.stringY(p.string)
              return (
                <g
                  key={`auto-${p.string}-${p.fret}`}
                  className={`marker-auto${p.isRoot ? ' marker-auto-root' : ''}`}
                >
                  {/* ルートは二重円で強調(手動マーカーの塗りと混同しないよう塗りは使わない) */}
                  {p.isRoot && <circle cx={x} cy={y} r={10} />}
                  <circle cx={x} cy={y} r={7} />
                  {labelMode !== 'none' && (
                    <text x={x} y={y + 3}>
                      {derivedLabel(p.pc)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}
        {/* マーカー */}
        {block.markers.map((m) => {
          const x = geom.markerX(m.fret)
          const y = geom.stringY(m.string)
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
        {/* 反転時のみ、図単体でも向きが分かる手がかりを描く(spec 002 AC-7) */}
        {mirrored && (
          <text className="head-cue" x={geom.width - 2} y={geom.height - 8}>
            ヘッド側 ▷
          </text>
        )}
      </svg>
    </div>
  )
}
