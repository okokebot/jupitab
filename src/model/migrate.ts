import type { FretpadDoc } from './types.ts'

export const CURRENT_SCHEMA_VERSION = 1

/**
 * 保存データ(JSON インポート・IndexedDB 読込)は必ずここを通す。
 * 将来スキーマが変わったら旧バージョンからの変換をここに足す。
 */
export function migrateDoc(raw: unknown): FretpadDoc {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('ドキュメントの形式が不正です')
  }
  const doc = raw as Partial<FretpadDoc>
  if (doc.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`未対応のスキーマバージョンです: ${String(doc.schemaVersion)}`)
  }
  if (typeof doc.id !== 'string' || typeof doc.title !== 'string' || !Array.isArray(doc.blocks)) {
    throw new Error('ドキュメントに必須フィールドがありません')
  }
  return doc as FretpadDoc
}
