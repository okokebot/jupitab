import { useRef, useState } from 'react'
import type { DocSummary } from '../store/persistence.ts'

interface Props {
  summaries: DocSummary[]
  activeId: string | undefined
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (file: File) => void
}

export function Sidebar({ summaries, activeId, onSelect, onCreate, onDelete, onExport, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  // 削除は誤操作防止のため二段階(confirm ダイアログは使わない)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">♪</span> Jupitab
      </div>
      <button type="button" className="btn btn-primary new-doc" onClick={onCreate}>
        ＋ 新規ノート
      </button>
      <nav className="doc-list">
        {summaries.map((s) => (
          <div key={s.id} className={`doc-item ${s.id === activeId ? 'active' : ''}`}>
            <button type="button" className="doc-item-title" onClick={() => onSelect(s.id)}>
              {s.title || '無題のノート'}
              <span className="doc-item-date">{s.updatedAt.slice(0, 10)}</span>
            </button>
            {confirmingId === s.id ? (
              <button
                type="button"
                className="btn-icon danger"
                title="本当に削除する"
                onClick={() => {
                  setConfirmingId(null)
                  onDelete(s.id)
                }}
                onBlur={() => setConfirmingId(null)}
              >
                削除?
              </button>
            ) : (
              <button
                type="button"
                className="btn-icon"
                title="ノートを削除"
                onClick={() => setConfirmingId(s.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button type="button" className="btn" onClick={onExport}>
          JSON 書き出し
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          JSON 読み込み
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImport(file)
            e.target.value = ''
          }}
        />
      </div>
    </aside>
  )
}
