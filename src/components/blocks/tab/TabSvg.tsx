// TAB 譜の SVG レンダラ。ジオメトリは layout/tabLayout.ts が計算済み。

import type { JSX, PointerEvent } from 'react'
import type { Articulation, TabBlock, TabNote } from '../../../model/types.ts'
import { effectiveTimeSignature } from '../../../model/types.ts'
import { measureCapacity, measureUsed } from '../../../model/duration.ts'
import { cmp } from '../../../model/fraction.ts'
import {
  findEvent,
  hitTest,
  stringY,
  TAB_METRICS,
  type LaidEvent,
  type LaidMeasure,
  type TabLayout,
  type TabPosition,
} from '../../../layout/tabLayout.ts'

const M = TAB_METRICS

interface TabSvgProps {
  block: TabBlock
  layout: TabLayout
  cursor?: TabPosition | null
  onPositionClick?: (pos: TabPosition) => void
}

/** 譜の上に出す注釈(スタッカートは符幹側なので含めない) */
const ANNOTATIONS: Partial<Record<Articulation, string>> = {
  accent: '>',
  marcato: '^',
  tenuto: 'ー',
  palmMute: 'P.M.',
  letRing: 'l.r.',
  vibrato: '〜〜',
}

function noteText(note: TabNote): string {
  if (note.dead) return 'x'
  const base = note.harmonic ? `◇${note.fret}` : String(note.fret)
  return note.articulations?.includes('ghost') ? `(${base})` : base
}

function bendLabel(semitones: number): string {
  if (semitones === 1) return '½'
  if (semitones === 2) return 'full'
  return semitones % 2 === 0 ? String(semitones / 2) : `${Math.floor(semitones / 2)}½`
}

export function TabSvg({ block, layout, cursor, onPositionClick }: TabSvgProps) {
  const handlePointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!onPositionClick) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = hitTest(layout, e.clientX - rect.left, e.clientY - rect.top)
    if (pos) onPositionClick(pos)
  }

  return (
    <svg
      className="tab-svg"
      width={layout.width}
      height={layout.height}
      onPointerDown={handlePointerDown}
      role="img"
      aria-label={block.label ?? 'TAB 譜'}
    >
      {cursor && <CursorHighlight layout={layout} cursor={cursor} />}
      {layout.lines.map((line, li) => (
        <g key={li}>
          <StaffLines layout={layout} staffTop={line.staffTop} measures={line.measures} />
          {line.measures.map((m) => (
            <MeasureGlyphs key={m.measure.id} layout={layout} staffTop={line.staffTop} m={m} block={block} />
          ))}
        </g>
      ))}
      {cursor && <CursorBox layout={layout} cursor={cursor} />}
    </svg>
  )
}

function StaffLines({ layout, staffTop, measures }: { layout: TabLayout; staffTop: number; measures: LaidMeasure[] }) {
  const last = measures.at(-1)
  if (!last) return null
  const x0 = measures[0]?.x ?? M.labelWidth
  const x1 = last.x + last.width
  return (
    <g className="staff">
      {Array.from({ length: layout.stringCount }, (_, i) => (
        <line key={i} x1={x0} y1={stringY(staffTop, i + 1)} x2={x1} y2={stringY(staffTop, i + 1)} />
      ))}
      {/* 行頭の TAB 表示と開始バーライン */}
      <line x1={x0} y1={staffTop} x2={x0} y2={staffTop + layout.staffHeight} />
      {['T', 'A', 'B'].map((c, i) => (
        <text key={c} className="tab-clef" x={x0 - 18} y={staffTop + layout.staffHeight / 2 + (i - 1) * 13 + 4}>
          {c}
        </text>
      ))}
      {measures.map((m) => (
        <line key={m.measure.id} x1={m.x + m.width} y1={staffTop} x2={m.x + m.width} y2={staffTop + layout.staffHeight} />
      ))}
    </g>
  )
}

function MeasureGlyphs({ layout, staffTop, m, block }: { layout: TabLayout; staffTop: number; m: LaidMeasure; block: TabBlock }) {
  const staffBottom = staffTop + layout.staffHeight
  const stemTop = staffBottom + 4
  const stemBottom = staffBottom + 22

  const beamedFlags = new Map<number, number>() // eventIndex → 連桁で描いた本数
  const glyphs: JSX.Element[] = []

  // ---- 連桁(隣接ペアごとに min(flags) 本、余りはスタブ) ----
  for (const group of m.beams) {
    for (let i = group.from; i < group.to; i++) {
      const a = m.events[i]
      const b = m.events[i + 1]
      if (!a || !b) continue
      const n = Math.min(a.flags, b.flags)
      for (let k = 0; k < n; k++) {
        const y = stemBottom - k * 4
        glyphs.push(<line key={`beam-${i}-${k}`} className="beam" x1={a.x} y1={y} x2={b.x} y2={y} />)
      }
      beamedFlags.set(i, Math.max(beamedFlags.get(i) ?? 0, n))
      beamedFlags.set(i + 1, Math.max(beamedFlags.get(i + 1) ?? 0, n))
    }
    // スタブ(付点8分+16分など、隣より旗が多い音)
    for (let i = group.from; i <= group.to; i++) {
      const ev = m.events[i]
      if (!ev) continue
      const drawn = beamedFlags.get(i) ?? 0
      const extra = ev.flags - drawn
      if (extra <= 0 || group.from === group.to) continue
      const dir = i === group.from ? 1 : -1
      for (let k = 0; k < extra; k++) {
        const y = stemBottom - (drawn + k) * 4
        glyphs.push(
          <line key={`stub-${i}-${k}`} className="beam" x1={ev.x} y1={y} x2={ev.x + dir * 8} y2={y} />,
        )
      }
      beamedFlags.set(i, ev.flags)
    }
  }

  // ---- イベントごとの描画 ----
  m.events.forEach((laid, ei) => {
    const { event } = laid
    const x = laid.x
    const isRest = event.notes.length === 0

    if (isRest) {
      glyphs.push(<RestGlyph key={`rest-${ei}`} x={x} yTop={stemTop} base={event.duration.base} />)
    } else {
      // 符幹(全音符はなし、2分は短い)
      if (event.duration.base >= 2) {
        const y1 = event.duration.base === 2 ? stemTop + 9 : stemTop
        glyphs.push(<line key={`stem-${ei}`} className="stem" x1={x} y1={y1} x2={x} y2={stemBottom} />)
      }
      // 旗(連桁で描かれていない分)
      const drawn = beamedFlags.get(ei) ?? 0
      for (let k = drawn; k < laid.flags; k++) {
        const y = stemBottom - k * 4
        glyphs.push(
          <path key={`flag-${ei}-${k}`} className="flag" d={`M ${x} ${y} q 7 -2 9 -8`} fill="none" />,
        )
      }
    }

    // 付点
    for (let d = 0; d < event.duration.dots; d++) {
      glyphs.push(<circle key={`dot-${ei}-${d}`} className="rhythm-dot" cx={x + 6 + d * 5} cy={stemBottom - 1} r={1.8} />)
    }

    // 音符
    const annotations: string[] = []
    for (const note of event.notes) {
      const y = stringY(staffTop, note.string)
      const text = noteText(note)
      const w = text.length * 7 + 3
      glyphs.push(
        <g key={`note-${ei}-${note.string}`}>
          <rect className="note-bg" x={x - w / 2} y={y - 6} width={w} height={12} />
          <text className="fret-text" x={x} y={y + 4}>
            {text}
          </text>
        </g>,
      )

      // スタッカート(符幹の下に点)
      if (note.articulations?.includes('staccato')) {
        glyphs.push(<circle key={`stac-${ei}-${note.string}`} className="rhythm-dot" cx={x} cy={stemBottom + 5} r={1.8} />)
      }

      // タイ(前のイベントの同じ弦から)
      if (note.tieToPrev) {
        const from = prevEventX(layout, m, laid)
        glyphs.push(
          <path
            key={`tie-${ei}-${note.string}`}
            className="tie"
            d={`M ${from + 6} ${y + 7} Q ${(from + x) / 2} ${y + 13} ${x - 6} ${y + 7}`}
            fill="none"
          />,
        )
      }

      // H/P/S(次のイベントへの接続)
      if (note.legatoToNext) {
        const to = nextEventX(layout, block, laid)
        if (to !== null) {
          const midX = (x + to) / 2
          if (note.legatoToNext === 'slide') {
            glyphs.push(
              <g key={`slide-${ei}-${note.string}`}>
                <line className="slide" x1={x + 8} y1={y + 3} x2={to - 8} y2={y - 3} />
                <text className="technique-text" x={midX} y={staffTop - 6}>S</text>
              </g>,
            )
          } else {
            glyphs.push(
              <g key={`legato-${ei}-${note.string}`}>
                <path className="tie" d={`M ${x + 6} ${y - 8} Q ${midX} ${y - 16} ${to - 6} ${y - 8}`} fill="none" />
                <text className="technique-text" x={midX} y={y - 16}>
                  {note.legatoToNext === 'hammer' ? 'H' : 'P'}
                </text>
              </g>,
            )
          }
        }
      }

      // ベンド(上向き矢印 + 量)
      if (note.bend) {
        const topY = staffTop - 12
        glyphs.push(
          <g key={`bend-${ei}-${note.string}`} className="bend">
            <path d={`M ${x + 7} ${y - 4} Q ${x + 15} ${y - 8} ${x + 15} ${topY + 6}`} fill="none" />
            <path d={`M ${x + 12} ${topY + 10} L ${x + 15} ${topY + 4} L ${x + 18} ${topY + 10}`} fill="none" />
            <text className="technique-text" x={x + 15} y={topY} textAnchor="middle">
              {bendLabel(note.bend.semitones)}
            </text>
          </g>,
        )
      }

      for (const art of note.articulations ?? []) {
        const a = ANNOTATIONS[art]
        if (a && !annotations.includes(a)) annotations.push(a)
      }
    }

    annotations.forEach((a, i) => {
      glyphs.push(
        <text key={`ann-${ei}-${i}`} className="annotation-text" x={x} y={staffTop - 8 - i * 11}>
          {a}
        </text>,
      )
    })
  })

  // ---- 連符ブラケット ----
  for (const t of m.tuplets) {
    const a = m.events[t.from]
    const b = m.events[t.to]
    if (!a || !b) continue
    const y = stemBottom + 8
    glyphs.push(
      <g key={`tuplet-${t.from}`} className="tuplet">
        <polyline points={`${a.x - 4},${y - 3} ${a.x - 4},${y} ${b.x + 4},${y} ${b.x + 4},${y - 3}`} fill="none" />
        <text x={(a.x + b.x) / 2} y={y + 9}>{t.label}</text>
      </g>,
    )
  }

  // 小節の合計音価が拍子を超えていたら警告マーク
  const overfull =
    cmp(measureUsed(m.measure), measureCapacity(effectiveTimeSignature(block.measures, m.index))) > 0

  return (
    <g>
      {m.showTimeSignature && (
        <g className="time-signature">
          <text x={m.x + M.measureLeadPad + 4} y={staffTop + layout.staffHeight / 2 - 3}>
            {m.showTimeSignature.beats}
          </text>
          <text x={m.x + M.measureLeadPad + 4} y={staffTop + layout.staffHeight / 2 + 13}>
            {m.showTimeSignature.beatUnit}
          </text>
        </g>
      )}
      {overfull && (
        <text className="overfull-mark" x={m.x + m.width - 8} y={staffTop - 8}>
          !<title>小節の合計音価が拍子を超えています</title>
        </text>
      )}
      {glyphs}
    </g>
  )
}

/**
 * タイの始点 x。直前イベント(小節をまたぐ)が同じ行にあればその x、
 * 行頭や先頭ならカーソルの少し左(行またぎのタイは短い弧で示す)。
 */
function prevEventX(layout: TabLayout, m: LaidMeasure, laid: LaidEvent): number {
  if (laid.eventIndex > 0) {
    return m.events[laid.eventIndex - 1]?.x ?? laid.x - 20
  }
  for (const line of layout.lines) {
    if (!line.measures.some((lm) => lm.index === laid.measureIndex)) continue
    const prevMeasure = line.measures.find((lm) => lm.index === laid.measureIndex - 1)
    return prevMeasure?.events.at(-1)?.x ?? laid.x - 20
  }
  return laid.x - 20
}

/** レガート・スライドの終点: 次イベントの x(小節をまたぐ)。次がなければ null */
function nextEventX(layout: TabLayout, block: TabBlock, laid: LaidEvent): number | null {
  const measure = block.measures[laid.measureIndex]
  if (measure && laid.eventIndex + 1 < measure.events.length) {
    return findEvent(layout, laid.measureIndex, laid.eventIndex + 1)?.laid.x ?? null
  }
  return findEvent(layout, laid.measureIndex + 1, 0)?.laid.x ?? null
}

function RestGlyph({ x, yTop, base }: { x: number; yTop: number; base: number }) {
  if (base === 1) return <rect className="rest" x={x - 5} y={yTop + 2} width={10} height={4} />
  if (base === 2) return <rect className="rest" x={x - 5} y={yTop + 6} width={10} height={4} />
  if (base === 4) {
    return (
      <path
        className="rest rest-path"
        d={`M ${x - 2} ${yTop} l 5 6 l -5 5 l 5 6`}
        fill="none"
      />
    )
  }
  // 8分以上: 斜線 + 旗の数だけ点
  const flags = Math.log2(base) - 2
  return (
    <g className="rest rest-path">
      <line x1={x + 3} y1={yTop + 2} x2={x - 3} y2={yTop + 16} />
      {Array.from({ length: flags }, (_, i) => (
        <circle key={i} cx={x - 1 + i * -1} cy={yTop + 4 + i * 4} r={1.7} />
      ))}
    </g>
  )
}

function CursorHighlight({ layout, cursor }: { layout: TabLayout; cursor: TabPosition }) {
  const geom = findEvent(layout, cursor.measureIndex, cursor.eventIndex)
  if (!geom) return null
  return (
    <rect
      className="cursor-column"
      x={geom.laid.x - geom.laid.width / 2 + 2}
      y={geom.staffTop - 8}
      width={geom.laid.width - 4}
      height={layout.staffHeight + 16}
      rx={4}
    />
  )
}

function CursorBox({ layout, cursor }: { layout: TabLayout; cursor: TabPosition }) {
  const geom = findEvent(layout, cursor.measureIndex, cursor.eventIndex)
  if (!geom) return null
  const y = stringY(geom.staffTop, cursor.string)
  return <rect className="cursor-box" x={geom.laid.x - 10} y={y - 8} width={20} height={16} rx={3} />
}
