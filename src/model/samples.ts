// リズム表現のショーケース用サンプル。
// データ構造が表現できる音価(全音符〜32分・付点・複付点・休符・連符・タイ)を
// 1 ブロックで見られるようにする。各小節はちょうど 4/4 に収まる(samples.test.ts で保証)。

import { nanoid } from 'nanoid'
import type { Duration, Measure, TabBlock, TabEvent, TabNote } from './types.ts'
import { STANDARD_TUNING } from './theory.ts'

type NoteSpec = [string: number, fret: number, extra?: Partial<TabNote>]

function ev(duration: Duration, ...notes: NoteSpec[]): TabEvent {
  return {
    id: nanoid(8),
    duration,
    notes: notes.map(([string, fret, extra]) => ({ string, fret, ...extra })),
  }
}

function measure(...events: TabEvent[]): Measure {
  return { id: nanoid(8), events }
}

function measureWithTs(ts: Measure['timeSignature'], ...events: TabEvent[]): Measure {
  return { id: nanoid(8), timeSignature: ts, events }
}

const whole: Duration = { base: 1, dots: 0 }
const half: Duration = { base: 2, dots: 0 }
const dottedHalf: Duration = { base: 2, dots: 1 }
const quarter: Duration = { base: 4, dots: 0 }
const doubleDottedQuarter: Duration = { base: 4, dots: 2 }
const dottedQuarter: Duration = { base: 4, dots: 1 }
const eighth: Duration = { base: 8, dots: 0 }
const dottedEighth: Duration = { base: 8, dots: 1 }
const sixteenth: Duration = { base: 16, dots: 0 }
const thirtySecond: Duration = { base: 32, dots: 0 }
const eighthTriplet: Duration = { base: 8, dots: 0, tuplet: { actual: 3, normal: 2 } }
const sixteenthTriplet: Duration = { base: 16, dots: 0, tuplet: { actual: 3, normal: 2 } }
const quarterTriplet: Duration = { base: 4, dots: 0, tuplet: { actual: 3, normal: 2 } }

export function createRhythmSampleTabBlock(): TabBlock {
  return {
    id: nanoid(8),
    type: 'tab',
    label: 'リズムサンプル: 全音符 → 32分・付点・休符・3連・タイ・6/8・7/8',
    tuning: [...STANDARD_TUNING],
    measures: [
      // M1: 全音符
      measure(ev(whole, [4, 7])),
      // M2: 付点2分 + 4分休符
      measure(ev(dottedHalf, [3, 5]), ev(quarter)),
      // M3: 4分 + 8分×2 + 8分休符 + 8分 + 4分
      measure(
        ev(quarter, [4, 5]),
        ev(eighth, [4, 7]),
        ev(eighth, [3, 5]),
        ev(eighth),
        ev(eighth, [3, 7]),
        ev(quarter, [2, 5]),
      ),
      // M4: (付点8分+16分)×2 + 16分×4 + 4分休符
      measure(
        ev(dottedEighth, [4, 5]),
        ev(sixteenth, [4, 7]),
        ev(dottedEighth, [3, 5]),
        ev(sixteenth, [3, 7]),
        ev(sixteenth, [2, 5]),
        ev(sixteenth, [2, 8]),
        ev(sixteenth, [2, 5]),
        ev(sixteenth, [3, 7]),
        ev(quarter),
      ),
      // M5: 8分3連(休符入り) + 16分3連×6 + 4分3連×3
      measure(
        ev(eighthTriplet, [3, 5]),
        ev(eighthTriplet),
        ev(eighthTriplet, [3, 7]),
        ev(sixteenthTriplet, [2, 5]),
        ev(sixteenthTriplet, [2, 8]),
        ev(sixteenthTriplet, [2, 5]),
        ev(sixteenthTriplet, [3, 7]),
        ev(sixteenthTriplet, [3, 5]),
        ev(sixteenthTriplet, [3, 7]),
        ev(quarterTriplet, [4, 7]),
        ev(quarterTriplet, [3, 5]),
        ev(quarterTriplet, [4, 7]),
      ),
      // M6: 付点4分 + 8分 → 2分(タイで結合)
      measure(
        ev(dottedQuarter, [4, 7]),
        ev(eighth, [4, 7]),
        ev(half, [4, 7, { tieToPrev: true }]),
      ),
      // M7: 複付点4分 + 16分 + 32分×4 + 16分休符 + 16分 + 4分
      measure(
        ev(doubleDottedQuarter, [1, 5]),
        ev(sixteenth, [1, 8]),
        ev(thirtySecond, [1, 5]),
        ev(thirtySecond, [1, 8]),
        ev(thirtySecond, [1, 5]),
        ev(thirtySecond, [1, 8]),
        ev(sixteenth),
        ev(sixteenth, [2, 5]),
        ev(quarter, [2, 5]),
      ),
      // M8: 6/8 拍子(8分×3 + 付点4分)
      measureWithTs(
        { beats: 6, beatUnit: 8 },
        ev(eighth, [4, 5]),
        ev(eighth, [3, 5]),
        ev(eighth, [3, 7]),
        ev(dottedQuarter, [2, 5]),
      ),
      // M9: 7/8 拍子(2+2+3 の 8分×7)
      measureWithTs(
        { beats: 7, beatUnit: 8 },
        ev(eighth, [4, 5]),
        ev(eighth, [4, 7]),
        ev(eighth, [3, 5]),
        ev(eighth, [3, 7]),
        ev(eighth, [2, 5]),
        ev(eighth, [2, 8]),
        ev(eighth, [2, 5]),
      ),
    ],
  }
}
