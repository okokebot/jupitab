import { useDocStore } from '../../store/docStore.ts'
import type { BlockType } from '../../model/types.ts'
import { createRhythmSampleTabBlock } from '../../model/samples.ts'
import { BlockFrame } from './BlockFrame.tsx'

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: 'text', label: '＋ テキスト' },
  { type: 'tab', label: '＋ TAB 譜' },
  { type: 'fretboard', label: '＋ 指板図' },
  { type: 'chord', label: '＋ コード表' },
]

export function DocEditor() {
  const doc = useDocStore((s) => s.doc)
  const setTitle = useDocStore((s) => s.setTitle)
  const addBlock = useDocStore((s) => s.addBlock)
  const insertBlock = useDocStore((s) => s.insertBlock)

  if (!doc) return null

  return (
    <div className="doc-editor">
      <input
        className="doc-title"
        value={doc.title}
        placeholder="無題のノート"
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="block-list">
        {doc.blocks.map((block, i) => (
          <BlockFrame key={block.id} block={block} isFirst={i === 0} isLast={i === doc.blocks.length - 1} />
        ))}
      </div>
      <div className="add-block-menu">
        {BLOCK_TYPES.map(({ type, label }) => (
          <button key={type} type="button" className="btn" onClick={() => addBlock(type)}>
            {label}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          title="音価・休符・連符の描画サンプルを挿入"
          onClick={() => insertBlock(createRhythmSampleTabBlock())}
        >
          ＋ リズムサンプル
        </button>
      </div>
    </div>
  )
}
