import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { redo, undo, useDocStore } from './store/docStore.ts'
import {
  deleteDoc,
  exportDocJson,
  importDocJson,
  listDocs,
  loadDoc,
  saveDoc,
  type DocSummary,
} from './store/persistence.ts'
import { createDoc } from './model/factory.ts'
import { DocEditor } from './components/editor/DocEditor.tsx'
import { Sidebar } from './components/Sidebar.tsx'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export default function App() {
  const doc = useDocStore((s) => s.doc)
  const setDoc = useDocStore((s) => s.setDoc)
  const [summaries, setSummaries] = useState<DocSummary[]>([])

  const refreshList = useCallback(async () => {
    setSummaries(await listDocs())
  }, [])

  // 起動時: 一覧を読み、最新のドキュメントを開く(なければ作る)
  // StrictMode の二重実行で初期ドキュメントが2つ作られないよう ref でガードする
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void (async () => {
      const list = await listDocs()
      if (list.length === 0) {
        const fresh = createDoc()
        await saveDoc(fresh)
        setDoc(fresh)
        setSummaries([{ id: fresh.id, title: fresh.title, updatedAt: fresh.updatedAt }])
      } else {
        setSummaries(list)
        const first = list[0]
        if (first) setDoc((await loadDoc(first.id)) ?? null)
      }
    })()
  }, [setDoc])

  // 自動保存(debounce)+ 一覧のタイトル/日時を追従
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!doc) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveDoc(doc).then(refreshList)
    }, 500)
    return () => window.clearTimeout(saveTimer.current)
  }, [doc, refreshList])

  // グローバル undo/redo(テキスト入力中はネイティブ動作を優先)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSelect = async (id: string) => {
    if (doc?.id === id) return
    if (doc) await saveDoc(doc)
    setDoc((await loadDoc(id)) ?? null)
  }

  const handleCreate = async () => {
    if (doc) await saveDoc(doc)
    const fresh = createDoc()
    await saveDoc(fresh)
    setDoc(fresh)
    await refreshList()
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(id)
    const list = await listDocs()
    setSummaries(list)
    if (doc?.id === id) {
      const next = list[0]
      setDoc(next ? ((await loadDoc(next.id)) ?? null) : null)
    }
  }

  const handleImport = async (file: File) => {
    try {
      const imported = await importDocJson(file)
      if (doc) await saveDoc(doc)
      setDoc(imported)
      await refreshList()
    } catch (err) {
      alert(`インポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="app">
      <Sidebar
        summaries={summaries}
        activeId={doc?.id}
        onSelect={(id) => void handleSelect(id)}
        onCreate={() => void handleCreate()}
        onDelete={(id) => void handleDelete(id)}
        onExport={() => doc && exportDocJson(doc)}
        onImport={(file) => void handleImport(file)}
      />
      <main className="main">
        {doc ? (
          <DocEditor />
        ) : (
          <div className="empty-state">ノートがありません。「＋ 新規ノート」で作成してください。</div>
        )}
      </main>
    </div>
  )
}
