import { nanoid } from 'nanoid'
import type {
  Block,
  BlockType,
  ChordBlock,
  Duration,
  FretboardBlock,
  FretpadDoc,
  Measure,
  TabBlock,
  TabEvent,
  TextBlock,
} from './types.ts'
import { STANDARD_TUNING } from './theory.ts'

export const DEFAULT_DURATION: Duration = { base: 4, dots: 0 }

export function createTabEvent(duration: Duration = DEFAULT_DURATION): TabEvent {
  return { id: nanoid(8), duration: { ...duration }, notes: [] }
}

export function createMeasure(eventCount = 4, duration: Duration = DEFAULT_DURATION): Measure {
  return {
    id: nanoid(8),
    events: Array.from({ length: eventCount }, () => createTabEvent(duration)),
  }
}

export function createTextBlock(markdown = ''): TextBlock {
  return { id: nanoid(8), type: 'text', markdown }
}

export function createTabBlock(): TabBlock {
  return {
    id: nanoid(8),
    type: 'tab',
    tuning: [...STANDARD_TUNING],
    measures: [createMeasure()],
  }
}

export function createFretboardBlock(): FretboardBlock {
  return {
    id: nanoid(8),
    type: 'fretboard',
    tuning: [...STANDARD_TUNING],
    fretStart: 0,
    fretEnd: 12,
    markers: [],
  }
}

export function createChordBlock(): ChordBlock {
  return {
    id: nanoid(8),
    type: 'chord',
    name: '',
    frets: [null, null, null, null, null, null],
    baseFret: 1,
  }
}

export function createBlock(type: BlockType): Block {
  switch (type) {
    case 'text':
      return createTextBlock()
    case 'tab':
      return createTabBlock()
    case 'fretboard':
      return createFretboardBlock()
    case 'chord':
      return createChordBlock()
  }
}

export function createDoc(title = '無題のノート'): FretpadDoc {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    id: nanoid(10),
    title,
    blocks: [createTextBlock()],
    createdAt: now,
    updatedAt: now,
  }
}
