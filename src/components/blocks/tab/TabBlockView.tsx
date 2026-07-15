import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Articulation, Duration, TabBlock, TimeSignature } from '../../../model/types.ts'
import { effectiveTimeSignature } from '../../../model/types.ts'
import { DEFAULT_DURATION } from '../../../model/factory.ts'
import { cycleTuplet, doubleBase, halveBase } from '../../../model/duration.ts'
import { noteName, pitchFromTab } from '../../../model/theory.ts'
import { DEFAULT_TEMPO, planTabPlayback, type PlaybackMarker } from '../../../model/playback.ts'
import { findEvent, layoutTab, TAB_METRICS, type TabPosition } from '../../../layout/tabLayout.ts'
import { play, type PlaybackHandle } from '../../../audio/player.ts'
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

/** コード名・メモ編集の対象。開いた時点のイベント位置を固定する */
interface TextEditTarget {
  kind: 'chord' | 'memo'
  m: number
  e: number
}

/** 譜面上に重ねる 1 行テキスト入力。Enter/blur で確定、Esc で取り消し */
function FloatingTextInput({
  initial,
  placeholder,
  style,
  onCommit,
  onCancel,
}: {
  initial: string
  placeholder: string
  style: { left: number; top: number }
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (fn: () => void) => {
    if (done.current) return
    done.current = true
    fn()
  }

  return (
    <input
      ref={inputRef}
      className="tab-inline-input"
      style={style}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(() => onCommit(value))}
      onKeyDown={(e) => {
        e.stopPropagation() // TAB エディタのキーバインドに流さない
        if (e.key === 'Enter') finish(() => onCommit(value))
        if (e.key === 'Escape') finish(onCancel)
      }}
    />
  )
}

export function TabBlockView({ block }: { block: TabBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const [cursor, setCursor] = useState<ops.TabPos | null>(null)
  const [currentDuration, setCurrentDuration] = useState<Duration>(DEFAULT_DURATION)
  const [showHelp, setShowHelp] = useState(false)
  const [showTuningEditor, setShowTuningEditor] = useState(false)
  const [textEdit, setTextEdit] = useState<TextEditTarget | null>(null)
  const digitBuffer = useRef<{ value: number; at: number; pos: ops.TabPos } | null>(null)

  // 再生。playHandle は再生中のみ非 null(アンマウント時は止める)
  const [playhead, setPlayhead] = useState<PlaybackMarker | null>(null)
  const [playing, setPlaying] = useState(false)
  const playHandle = useRef<PlaybackHandle | null>(null)
  useEffect(() => () => playHandle.current?.stop(), [])

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

  const togglePlay = () => {
    if (playing) {
      playHandle.current?.stop()
      return
    }
    setPlaying(true)
    playHandle.current = play(planTabPlayback(block), {
      onMarker: setPlayhead,
      onEnd: () => {
        setPlaying(false)
        setPlayhead(null)
      },
    })
  }

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

  const openTextEdit = (kind: TextEditTarget['kind']) => {
    if (cursor && ops.eventAt(block, cursor.m, cursor.e)) setTextEdit({ kind, m: cursor.m, e: cursor.e })
  }

  const closeTextEdit = (commit?: { value: string }) => {
    if (commit && textEdit) {
      const { kind, m, e } = textEdit
      apply((b) => (kind === 'chord' ? ops.setEventChord(b, m, e, commit.value) : ops.setEventMemo(b, m, e, commit.value)))
    }
    setTextEdit(null)
    areaRef.current?.focus()
  }

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
      case 'Enter': {
        // カーソル直後にイベントを挿入(採譜中の「音が 1 個多かった」に対応)
        const next = ops.insertEventAfter(block, cursor.m, cursor.e, currentDuration)
        apply(() => next)
        setCursor({ ...cursor, e: cursor.e + 1 })
        break
      }
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
        changeDuration(cycleTuplet)
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
      case 'B':
        apply((b) => ops.togglePrebend(b, cursor))
        break
      case 'f':
        apply((b) => ops.cycleFinger(b, cursor))
        break
      case 'o':
        apply((b) => ops.cycleHarmonic(b, cursor))
        break
      case 'e':
        toggleArt('tenuto')
        break
      case 'w':
        toggleArt('marcato')
        break
      case 'i':
        apply((b) => ops.toggleSlideIn(b, cursor))
        break
      case 'u':
        apply((b) => ops.toggleSlideOut(b, cursor))
        break
      case 'c':
        openTextEdit('chord')
        break
      case 'n':
        openTextEdit('memo')
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
  // 拍子コントロールの対象小節: カーソル位置、なければ先頭小節
  const tsMeasure = cursor?.m ?? 0
  const cursorTs: TimeSignature = effectiveTimeSignature(block.measures, tsMeasure)
  const cursorTsExplicit = block.measures[tsMeasure]?.timeSignature !== undefined

  const changeTimeSignature = (ts: TimeSignature | undefined) => {
    apply((b) => ops.setTimeSignature(b, tsMeasure, ts))
  }
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
        <button type="button" className="btn" onClick={togglePlay} title="TAB を再生 / 停止">
          {playing ? '■ 停止' : '▶ 再生'}
        </button>
        <label className="tempo-label" title="テンポ(BPM、4分音符基準)">
          ♩=
          <input
            type="number"
            min={20}
            max={400}
            value={block.tempo ?? DEFAULT_TEMPO}
            onChange={(e) => {
              const t = Number(e.target.value)
              apply((b) => ({ ...b, tempo: Number.isFinite(t) && t > 0 ? t : undefined }))
            }}
          />
        </label>
        <select
          value={tuningKey(block.tuning)}
          title="チューニング(プリセット)。弦ごとの変更は「調弦」から"
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
        <button
          type="button"
          className={`btn ${showTuningEditor ? 'btn-active' : ''}`}
          title="弦ごとのチューニング編集と弦数変更"
          onClick={() => setShowTuningEditor((v) => !v)}
        >
          調弦
        </button>
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
        <label
          className="ts-label"
          title="拍子を変更(カーソル位置の小節から。未選択なら先頭小節。以降の小節に引き継がれる)"
        >
          拍子{cursor && cursor.m > 0 ? `(${cursor.m + 1}小節目〜)` : ''}
          <input
            type="number"
            min={1}
            max={32}
            value={cursorTs.beats}
            onChange={(e) => {
              const beats = Math.min(32, Math.max(1, Number(e.target.value) || 4))
              changeTimeSignature({ ...cursorTs, beats })
            }}
          />
          /
          <select
            value={cursorTs.beatUnit}
            onChange={(e) =>
              changeTimeSignature({ ...cursorTs, beatUnit: Number(e.target.value) as TimeSignature['beatUnit'] })
            }
          >
            {[2, 4, 8, 16].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          {cursorTsExplicit && (
            <button
              type="button"
              className="btn-icon"
              title="拍子の変更を解除(前の小節を引き継ぐ。先頭小節は 4/4 に戻る)"
              onClick={() => changeTimeSignature(undefined)}
            >
              解除
            </button>
          )}
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
      {showTuningEditor && (
        <div className="tuning-editor">
          {block.tuning.map((midi, i) => (
            <label key={i}>
              {i + 1}弦
              <select
                value={midi}
                onChange={(e) => apply((b) => ops.setStringTuning(b, i, Number(e.target.value)))}
              >
                {/* F#1(30)〜C5(72) を半音刻みで */}
                {Array.from({ length: 43 }, (_, k) => 30 + k).map((m) => (
                  <option key={m} value={m}>
                    {noteName(m)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            disabled={block.tuning.length <= 4}
            title="低音弦を減らす(その弦の音は消えます)"
            onClick={() => {
              const next = ops.setStringCount(block, block.tuning.length - 1)
              apply(() => next)
              setCursor((c) => (c ? ops.clampPos(next, c) : c))
            }}
          >
            − 弦
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={block.tuning.length >= 8}
            title="低音弦を足す(最低弦の完全4度下)"
            onClick={() => apply((b) => ops.setStringCount(b, b.tuning.length + 1))}
          >
            ＋ 弦
          </button>
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
        <div className="tab-svg-wrap">
          <TabSvg
            block={block}
            layout={layout}
            cursor={svgCursor}
            playhead={playing ? playhead : null}
            onPositionClick={(p) => setCursor({ m: p.measureIndex, e: p.eventIndex, s: p.string })}
          />
          {textEdit &&
            (() => {
              const geom = findEvent(layout, textEdit.m, textEdit.e)
              if (!geom) return null
              const ev = ops.eventAt(block, textEdit.m, textEdit.e)
              const isChord = textEdit.kind === 'chord'
              return (
                <FloatingTextInput
                  key={`${textEdit.kind}-${textEdit.m}-${textEdit.e}`}
                  initial={(isChord ? ev?.chord : ev?.memo) ?? ''}
                  placeholder={isChord ? 'コード名' : 'メモ'}
                  style={{
                    left: geom.laid.x,
                    top: isChord
                      ? geom.staffTop - layout.topPad
                      : geom.staffTop + layout.staffHeight + TAB_METRICS.rhythmHeight,
                  }}
                  onCommit={(value) => closeTextEdit({ value })}
                  onCancel={() => closeTextEdit()}
                />
              )
            })()}
        </div>
      </div>
    </div>
  )
}
