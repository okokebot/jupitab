// Web Audio による簡易再生(vision の柱 4)。PlaybackPlan(model/playback.ts)を
// Karplus-Strong の撥弦合成で鳴らす。アプリ全体で同時に再生できるのは 1 つだけで、
// 新しい再生を始めると前の再生は自動的に止まる(onEnd はどの止まり方でも必ず 1 回呼ぶ)。

import type { PlaybackMarker, PlaybackPlan } from '../model/playback.ts'

export interface PlaybackCallbacks {
  /** 再生位置がイベント境界を越えたとき */
  onMarker?: (marker: PlaybackMarker) => void
  /** 再生終了時(最後まで再生・stop()・別の再生開始のいずれでも必ず 1 回) */
  onEnd?: () => void
}

export interface PlaybackHandle {
  stop: () => void
}

/** 音の切れ目のクリックノイズを避ける減衰しろ(秒) */
const RELEASE = 0.25

let sharedCtx: AudioContext | null = null

function getContext(): AudioContext {
  sharedCtx ??= new AudioContext()
  return sharedCtx
}

/** Karplus-Strong: ノイズバーストを短い遅延ループに通して撥弦の音を作る */
function pluckBuffer(ctx: AudioContext, midi: number, seconds: number, damping: number): AudioBuffer {
  const sr = ctx.sampleRate
  const length = Math.max(1, Math.ceil(sr * (seconds + RELEASE)))
  const buffer = ctx.createBuffer(1, length, sr)
  const data = buffer.getChannelData(0)
  const freq = 440 * 2 ** ((midi - 69) / 12)
  const period = Math.max(2, Math.round(sr / freq))
  for (let i = 0; i < Math.min(period, length); i++) {
    data[i] = Math.random() * 2 - 1
  }
  for (let i = period; i < length; i++) {
    data[i] = ((data[i - period] ?? 0) + (data[i - period + 1] ?? 0)) * 0.5 * damping
  }
  // ノートの終端で直線フェード(ぶつ切りのクリックを防ぐ)
  const fadeStart = Math.min(length - 1, Math.floor(sr * seconds))
  for (let i = fadeStart; i < length; i++) {
    data[i] = (data[i] ?? 0) * (1 - (i - fadeStart) / (length - fadeStart))
  }
  return buffer
}

/** ミュート音(x): 音程のない短い打撃ノイズ */
function muteBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const length = Math.ceil(sr * 0.06)
  const buffer = ctx.createBuffer(1, length, sr)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.01)) * 0.5
  }
  return buffer
}

interface ActivePlayback {
  master: GainNode
  timer: number
  onEnd?: (() => void) | undefined
}

let active: ActivePlayback | null = null

function finish(playback: ActivePlayback) {
  clearInterval(playback.timer)
  playback.master.disconnect()
  if (active === playback) active = null
  playback.onEnd?.()
}

/** 再生中の音を止める(何も鳴っていなければ何もしない) */
export function stop() {
  if (active) finish(active)
}

export function play(plan: PlaybackPlan, callbacks: PlaybackCallbacks = {}): PlaybackHandle {
  stop()
  const ctx = getContext()
  void ctx.resume() // ユーザー操作前に作られた場合は suspended になっている

  const master = ctx.createGain()
  master.gain.value = 0.8
  const limiter = ctx.createDynamicsCompressor() // 和音でのクリップ防止
  master.connect(limiter)
  limiter.connect(ctx.destination)

  const t0 = ctx.currentTime + 0.08
  for (const note of plan.notes) {
    const source = ctx.createBufferSource()
    source.buffer = note.dead
      ? muteBuffer(ctx)
      : pluckBuffer(ctx, note.midi, note.duration, note.palmMute ? 0.97 : 0.996)
    const gain = ctx.createGain()
    gain.gain.value = note.gain * 0.4
    source.connect(gain)
    gain.connect(master)
    source.start(t0 + note.start)
  }

  const playback: ActivePlayback = { master, timer: 0, onEnd: callbacks.onEnd }
  let markerIndex = -1
  const tick = () => {
    const elapsed = ctx.currentTime - t0
    let next = markerIndex
    while (next + 1 < plan.markers.length && (plan.markers[next + 1]?.start ?? Infinity) <= elapsed) next++
    if (next !== markerIndex) {
      markerIndex = next
      const marker = plan.markers[markerIndex]
      if (marker) callbacks.onMarker?.(marker)
    }
    if (elapsed >= plan.total + RELEASE) finish(playback)
  }
  // rAF ではなく setInterval: 非表示タブでは rAF が止まり、終了検知まで固まってしまう
  playback.timer = window.setInterval(tick, 40)
  active = playback

  return {
    stop: () => {
      if (active === playback) finish(playback)
    },
  }
}
