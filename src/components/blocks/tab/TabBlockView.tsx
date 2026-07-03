import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Articulation, Duration, TabBlock } from '../../../model/types.ts'
import { DEFAULT_DURATION } from '../../../model/factory.ts'
import { doubleBase, halveBase } from '../../../model/duration.ts'
import { noteName, pitchFromTab } from '../../../model/theory.ts'
import { layoutTab, type TabPosition } from '../../../layout/tabLayout.ts'
import { useDocStore } from '../../../store/docStore.ts'
import { TabSvg } from './TabSvg.tsx'
import { KEYMAP } from './keymap.ts'
import * as ops from './tabOps.ts'

const TUNINGS: Record<string, number[]> = {
  'スタンダード (EADGBE)': [64, 59, 55, 50, 45, 40],
  'ドロップ D (DADGBE)': [64, 59, 55, 50, 45, 38],
  '半音下げ (E♭A♭D♭G♭B♭E♭)': [63, 58, 54, 49, 44, 39],
  'DADGAD': [62, 57, 55, 50, 45, 38],
}

function tuningKey(tuning: number[]): string {
  return (
    Object.entries(TUNINGS).find(([, t]) => t.length === tuning.length && t.every((v, i) => v === tuning[i]))?.[0] ??
    'カスタム'
  )
}

function samePos(a: ops.TabPos, b: ops.TabPos): boolean {
  return a.m === b.m && a.e === b.e && a.s === b.s
}

export function TabBlockView({ block }: { block: TabBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const [cursor, setCursor] = useState<ops.TabPos | null>(null)
  const [currentDuration, setCurrentDuration] = useState<Duration>(DEFAULT_DURATION)
  const [showHelp, setShowHelp] = useState(false)
  const digitBuffer = useRef<{ value: number; at: number; pos: ops.TabPos } | null>(null)

  // コンテナ幅に追従して折り返す
  const areaRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(760)
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 200) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(() => layoutTab(block, width), [block, width])

  const apply = (fn: (b: TabBlock) => TabBlock) => updateBlock<TabBlock>(block.id, fn)

  const moveCursor = (pos: ops.TabPos | null) => {
    if (pos) setCursor(ops.clampPos(block, pos))
  }

  const inputDigit = (digit: number) => {
    if (!cursor) return
    const now = performance.now()
    const buf = digitBuffer.current
    let fret = digit
    if (buf && now - buf.at < 600 && samePos(buf.pos, cursor)) {
      const combined = buf.value * 10 + digit
      if (combined <= 24) fret = combined
    }
    digitBuffer.current = { value: fret, at: now, pos: cursor }
    apply((b) => ops.setFret(b, cursor, fret))
  }

  const changeDuration = (fn: (d: Duration) => Duration) => {
    if (!cursor) return
    const ev = ops.eventAt(block, cursor.m, cursor.e)
    if (!ev) return
    const next = fn(ev.duration)
    setCurrentDuration(next)
    apply((b) => ops.setEventDuration(b, cursor.m, cursor.e, next))
  }

  const toggleArt = (art: Articulation) => cursor && apply((b) => ops.toggleArticulation(b, cursor, art))

  const advance = () => {
    if (!cursor) return
    const next = ops.nextPos(block, cursor)
    if (next) {
      setCursor(next)
    } else {
      apply((b) => ops.insertEventAfter(b, cursor.m, cursor.e, currentDuration))
      setCursor({ ...cursor, e: cursor.e + 1 })
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!cursor) return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'z') return // undo/redo はグローバルに任せる

    if (/^[0-9]$/.test(e.key) && !mod) {
      e.preventDefault()
      inputDigit(Number(e.key))
      return
    }

    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
        moveCursor(ops.prevPos(block, cursor))
        break
      case 'ArrowRight':
        moveCursor(ops.nextPos(block, cursor))
        break
      case 'ArrowUp':
        moveCursor({ ...cursor, s: cursor.s - 1 })
        break
      case 'ArrowDown':
        moveCursor({ ...cursor, s: cursor.s + 1 })
        break
      case ' ':
        advance()
        break
      case '|':
        apply((b) => ops.insertMeasureAfter(b, cursor.m, currentDuration))
        setCursor({ m: cursor.m + 1, e: 0, s: cursor.s })
        break
      case 'Backspace':
      case 'Delete':
        if (mod) {
          const next = ops.removeEvent(block, cursor.m, cursor.e)
          apply(() => next)
          setCursor(ops.clampPos(next, { ...cursor, e: cursor.e - 1 }))
        } else {
          apply((b) => ops.removeNote(b, cursor))
        }
        break
      case '+':
      case '=':
        changeDuration((d) => ({ ...d, base: doubleBase(d.base) }))
        break
      case '-':
        changeDuration((d) => ({ ...d, base: halveBase(d.base) }))
        break
      case '.':
        changeDuration((d) => ({ ...d, dots: ((d.dots + 1) % 3) as Duration['dots'] }))
        break
      case 't':
        changeDuration((d) => ({
          ...d,
          tuplet: d.tuplet ? undefined : { actual: 3, normal: 2 },
        }))
        break
      case 'y':
        apply((b) => ops.toggleTie(b, cursor))
        break
      case 'x':
        apply((b) => ops.toggleDead(b, cursor))
        break
      case 's':
        toggleArt('staccato')
        break
      case 'a':
        toggleArt('accent')
        break
      case 'v':
        toggleArt('vibrato')
        break
      case 'm':
        toggleArt('palmMute')
        break
      case 'g':
        toggleArt('ghost')
        break
      case 'l':
        toggleArt('letRing')
        break
      case 'h':
        apply((b) => ops.toggleLegato(b, cursor, 'hammer'))
        break
      case 'p':
        apply((b) => ops.toggleLegato(b, cursor, 'pull'))
        break
      case '/':
        apply((b) => ops.toggleLegato(b, cursor, 'slide'))
        break
      case 'b':
        apply((b) => ops.cycleBend(b, cursor))
        break
      case 'Escape':
        setCursor(null)
        break
      default:
        handled = false
    }
    if (handled) e.preventDefault()
  }

  const cursorNote = cursor ? ops.noteAt(block, cursor) : undefined
  const cursorEvent = cursor ? ops.eventAt(block, cursor.m, cursor.e) : undefined
  const svgCursor: TabPosition | null = cursor
    ? { measureIndex: cursor.m, eventIndex: cursor.e, string: cursor.s }
    : null

  return (
    <div className="tab-block">
      <div className="tab-toolbar">
        <input
          className="tab-label-input"
          placeholder="ラベル(例: Aマイナーペンタ 1st ポジション)"
          value={block.label ?? ''}
          onChange={(e) => apply((b) => ({ ...b, label: e.target.value || undefined }))}
        />
        <select
          value={tuningKey(block.tuning)}
          title="チューニング"
          onChange={(e) => {
            const t = TUNINGS[e.target.value]
            if (t) apply((b) => ({ ...b, tuning: [...t] }))
          }}
        >
          {[...Object.keys(TUNINGS), 'カスタム'].map((k) => (
            <option key={k} value={k} disabled={k === 'カスタム'}>
              {k}
            </option>
          ))}
        </select>
        <label className="capo-label">
          カポ
          <input
            type="number"
            min={0}
            max={12}
            value={block.capo ?? 0}
            onChange={(e) => apply((b) => ({ ...b, capo: Number(e.target.value) || undefined }))}
          />
        </label>
        <button type="button" className="btn" onClick={() => setShowHelp((v) => !v)}>
          ⌨ キー操作
        </button>
        <span className="tab-status">
          {cursor && cursorNote && !cursorNote.dead
            ? `${cursor.s}弦 ${cursorNote.fret}F = ${noteName(pitchFromTab(block.tuning, cursor.s, cursorNote.fret, block.capo ?? 0))}`
            : cursor
              ? `${cursor.s}弦(${cursorEvent && cursorEvent.notes.length === 0 ? '休符' : '空'})`
              : 'クリックしてキーボードで入力'}
        </span>
      </div>
      {showHelp && (
        <div className="keymap-help">
          {KEYMAP.map((k) => (
            <span key={k.key}>
              <kbd>{k.key}</kbd> {k.label}
            </span>
          ))}
        </div>
      )}
      <div
        ref={areaRef}
        className="tab-area"
        tabIndex={0}
        role="application"
        aria-label="TAB 譜エディタ"
        onKeyDown={handleKeyDown}
      >
        <TabSvg block={block} layout={layout} cursor={svgCursor} onPositionClick={(p) => setCursor({ m: p.measureIndex, e: p.eventIndex, s: p.string })} />
      </div>
    </div>
  )
}
