import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { nanoid } from 'nanoid'
import type { FretpadDoc } from '../model/types.ts'
import { migrateDoc } from '../model/migrate.ts'

interface FretpadDB extends DBSchema {
  docs: {
    key: string
    value: FretpadDoc
  }
}

export interface DocSummary {
  id: string
  title: string
  updatedAt: string
}

let dbPromise: Promise<IDBPDatabase<FretpadDB>> | null = null

function getDB(): Promise<IDBPDatabase<FretpadDB>> {
  dbPromise ??= openDB<FretpadDB>('fretpad', 1, {
    upgrade(db) {
      db.createObjectStore('docs', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function listDocs(): Promise<DocSummary[]> {
  const db = await getDB()
  const docs = await db.getAll('docs')
  return docs
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveDoc(doc: FretpadDoc): Promise<void> {
  const db = await getDB()
  await db.put('docs', doc)
}

export async function loadDoc(id: string): Promise<FretpadDoc | undefined> {
  const db = await getDB()
  const raw = await db.get('docs', id)
  return raw === undefined ? undefined : migrateDoc(raw)
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('docs', id)
}

// ---- JSON エクスポート / インポート ----

export function exportDocJson(doc: FretpadDoc): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.title || 'fretpad-doc'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** JSON を読み込み、既存 id と衝突したら新しい id を割り当てて保存する */
export async function importDocJson(file: File): Promise<FretpadDoc> {
  const text = await file.text()
  const doc = migrateDoc(JSON.parse(text))
  const existing = await loadDoc(doc.id)
  const toSave = existing ? { ...doc, id: nanoid(10) } : doc
  await saveDoc(toSave)
  return toSave
}
