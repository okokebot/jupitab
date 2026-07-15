import { describe, expect, it } from 'vitest'
import { migrateDoc } from './migrate.ts'
import { createChordBlock, createDoc, createFretboardBlock } from './factory.ts'

/** JSON 保存 → 読込の往復を模す */
const roundtrip = (doc: unknown) => migrateDoc(JSON.parse(JSON.stringify(doc)))

describe('migrateDoc', () => {
  it('mirrored 付きの v1 ドキュメントが通る(spec 002)', () => {
    const doc = createDoc('テスト')
    doc.blocks.push({ ...createFretboardBlock(), mirrored: true })
    const migrated = roundtrip(doc)
    const block = migrated.blocks.find((b) => b.type === 'fretboard')
    expect(block).toMatchObject({ type: 'fretboard', mirrored: true })
  })

  it('mirrored なしの既存ドキュメントが通り、フィールドは undefined のまま(= 右利き表示)', () => {
    const doc = createDoc('テスト')
    doc.blocks.push(createFretboardBlock())
    const migrated = roundtrip(doc)
    const block = migrated.blocks.find((b) => b.type === 'fretboard')
    expect(block).toBeDefined()
    expect(block && 'mirrored' in block ? block.mirrored : undefined).toBeUndefined()
  })

  it('mirrored 付き ChordBlock を含む v1 ドキュメントが通る(spec 004)', () => {
    const doc = createDoc('テスト')
    doc.blocks.push({ ...createChordBlock(), mirrored: true })
    const migrated = roundtrip(doc)
    const block = migrated.blocks.find((b) => b.type === 'chord')
    expect(block).toMatchObject({ type: 'chord', mirrored: true })
  })

  it('未対応の schemaVersion は例外', () => {
    expect(() => migrateDoc({ schemaVersion: 99, id: 'x', title: 't', blocks: [] })).toThrow(
      /スキーマバージョン/,
    )
  })
})
