import { useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { TextBlock } from '../../model/types.ts'
import { useDocStore } from '../../store/docStore.ts'

export function TextBlockView({ block }: { block: TextBlock }) {
  const updateBlock = useDocStore((s) => s.updateBlock)
  const [editing, setEditing] = useState(block.markdown === '')
  // 下書きはローカルに持ち、確定時に 1 回だけ store を更新する(undo の粒度をブロック単位にする)
  const [draft, setDraft] = useState(block.markdown)

  const commit = () => {
    if (draft !== block.markdown) {
      updateBlock<TextBlock>(block.id, (b) => ({ ...b, markdown: draft }))
    }
    if (draft !== '') setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        className="text-block-editor"
        autoFocus
        value={draft}
        rows={Math.max(3, draft.split('\n').length + 1)}
        placeholder="Markdown で書けます(# 見出し、- リスト、**強調**)"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') commit()
        }}
      />
    )
  }

  const html = DOMPurify.sanitize(marked.parse(block.markdown, { async: false }))
  return (
    <div
      className="text-block-view md"
      onClick={() => {
        setDraft(block.markdown)
        setEditing(true)
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
