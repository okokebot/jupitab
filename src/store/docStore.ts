import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Block, BlockType, FretpadDoc } from '../model/types.ts'
import { createBlock } from '../model/factory.ts'

export interface DocState {
  doc: FretpadDoc | null
  setDoc: (doc: FretpadDoc | null) => void
  setTitle: (title: string) => void
  updateDoc: (fn: (doc: FretpadDoc) => FretpadDoc) => void
  updateBlock: <B extends Block>(id: string, fn: (block: B) => B) => void
  addBlock: (type: BlockType, afterId?: string) => string
  removeBlock: (id: string) => void
  moveBlock: (id: string, dir: -1 | 1) => void
}

export const useDocStore = create<DocState>()(
  temporal(
    (set, get) => ({
      doc: null,

      setDoc: (doc) => {
        set({ doc })
        // 別ドキュメントの履歴を持ち越さない
        useDocStore.temporal.getState().clear()
      },

      updateDoc: (fn) => {
        const doc = get().doc
        if (!doc) return
        set({ doc: { ...fn(doc), updatedAt: new Date().toISOString() } })
      },

      setTitle: (title) => get().updateDoc((doc) => ({ ...doc, title })),

      updateBlock: (id, fn) =>
        get().updateDoc((doc) => ({
          ...doc,
          blocks: doc.blocks.map((b) => (b.id === id ? fn(b as never) : b)),
        })),

      addBlock: (type, afterId) => {
        const block = createBlock(type)
        get().updateDoc((doc) => {
          const i = afterId ? doc.blocks.findIndex((b) => b.id === afterId) : doc.blocks.length - 1
          const blocks = [...doc.blocks]
          blocks.splice((i < 0 ? doc.blocks.length - 1 : i) + 1, 0, block)
          return { ...doc, blocks }
        })
        return block.id
      },

      removeBlock: (id) =>
        get().updateDoc((doc) => ({ ...doc, blocks: doc.blocks.filter((b) => b.id !== id) })),

      moveBlock: (id, dir) =>
        get().updateDoc((doc) => {
          const i = doc.blocks.findIndex((b) => b.id === id)
          const j = i + dir
          if (i < 0 || j < 0 || j >= doc.blocks.length) return doc
          const blocks = [...doc.blocks]
          const [b] = blocks.splice(i, 1)
          if (!b) return doc
          blocks.splice(j, 0, b)
          return { ...doc, blocks }
        }),
    }),
    {
      partialize: (state) => ({ doc: state.doc }),
      limit: 200,
    },
  ),
)

export function undo() {
  useDocStore.temporal.getState().undo()
}

export function redo() {
  useDocStore.temporal.getState().redo()
}
