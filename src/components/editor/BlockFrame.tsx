import { useState } from 'react'
import type { Block } from '../../model/types.ts'
import { useDocStore } from '../../store/docStore.ts'
import { TextBlockView } from '../blocks/TextBlockView.tsx'
import { TabBlockView } from '../blocks/tab/TabBlockView.tsx'
import { FretboardBlockView } from '../blocks/FretboardBlockView.tsx'
import { ChordBlockView } from '../blocks/ChordBlockView.tsx'

const TYPE_LABELS: Record<Block['type'], string> = {
  text: 'テキスト',
  tab: 'TAB 譜',
  fretboard: '指板図',
  chord: 'コード表',
}

export function BlockFrame({ block, isFirst, isLast }: { block: Block; isFirst: boolean; isLast: boolean }) {
  const moveBlock = useDocStore((s) => s.moveBlock)
  const removeBlock = useDocStore((s) => s.removeBlock)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={`block-frame block-${block.type}`}>
      <div className="block-controls">
        <span className="block-type-label">{TYPE_LABELS[block.type]}</span>
        <button type="button" className="btn-icon" disabled={isFirst} title="上へ" onClick={() => moveBlock(block.id, -1)}>
          ↑
        </button>
        <button type="button" className="btn-icon" disabled={isLast} title="下へ" onClick={() => moveBlock(block.id, 1)}>
          ↓
        </button>
        {confirming ? (
          <button
            type="button"
            className="btn-icon danger"
            title="本当に削除する"
            onClick={() => removeBlock(block.id)}
            onBlur={() => setConfirming(false)}
          >
            削除?
          </button>
        ) : (
          <button type="button" className="btn-icon" title="ブロックを削除" onClick={() => setConfirming(true)}>
            ✕
          </button>
        )}
      </div>
      <div className="block-body">{renderBlock(block)}</div>
    </div>
  )
}

function renderBlock(block: Block) {
  switch (block.type) {
    case 'text':
      return <TextBlockView block={block} />
    case 'tab':
      return <TabBlockView block={block} />
    case 'fretboard':
      return <FretboardBlockView block={block} />
    case 'chord':
      return <ChordBlockView block={block} />
  }
}
