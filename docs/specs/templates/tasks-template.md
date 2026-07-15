# <機能名> — 実装タスク

対応 design: [design.md](design.md)

ルール:
- 1 タスク = 検証可能な単位。完了条件(テスト green・目視確認)を各タスクに書く
- 依存順に並べる。model → layout → store → components が基本
- 完了したら `[x]` にする。設計変更が起きたら design.md を直してからタスクを更新

## Phase 1: モデル層

- [ ] T-1: <内容>。完了条件: `npx vitest run src/model/<file>.test.ts` green
- [ ] T-2: <スキーマ変更があれば migrate.ts + テスト>

## Phase 2: レイアウト / ストア

- [ ] T-3: <内容>。完了条件: <テスト>

## Phase 3: UI

- [ ] T-4: <内容>。完了条件: <手動確認手順>
- [ ] T-5: <キーバインド変更があれば keymap.ts と handleKeyDown の同期>

## Phase 4: 仕上げ

- [ ] T-final: `npm run lint` / `npm run typecheck` / `npm test` すべて green、受け入れ基準を全確認、spec.md の status を done に更新
