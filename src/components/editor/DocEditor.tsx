import { useDocStore } from '../../store/docStore.ts'
import type { Block, BlockType } from '../../model/types.ts'
import {
  createChordSampleBlock,
  createFretboardSampleBlock,
  createTabSampleBlock,
} from '../../model/samples.ts'
import { BlockFrame } from './BlockFrame.tsx'

const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: 'text', label: '＋ テキスト' },
  { type: 'tab', label: '＋ TAB 譜' },
  { type: 'fretboard', label: '＋ 指板図' },
  { type: 'chord', label: '＋ コード表' },
]

const SAMPLES: { key: string; label: string; title: string; create: () => Block }[] = [
  {
    key: 'tab',
    label: 'TAB 譜',
    title: '音価・休符・連符・変拍子の描画サンプルを挿入',
    create: createTabSampleBlock,
  },
  {
    key: 'fretboard',
    label: '指板図',
    title: 'スケール自動表示と手動マーカーのサンプルを挿入',
    create: createFretboardSampleBlock,
  },
  {
    key: 'chord',
    label: 'コード表',
    title: 'バレー・運指・ミュート入りのコード表サンプルを挿入',
    create: createChordSampleBlock,
  },
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
        <span className="add-block-samples">
          サンプル:
          {SAMPLES.map(({ key, label, title, create }) => (
            <button
              key={key}
              type="button"
              className="btn"
              title={title}
              aria-label={`${label}のサンプルを挿入`}
              onClick={() => insertBlock(create())}
            >
              {label}
            </button>
          ))}
        </span>
      </div>
    </div>
  )
}
