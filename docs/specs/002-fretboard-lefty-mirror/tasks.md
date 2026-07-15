# 指板図の左利き(左右反転)表示 — 実装タスク

対応 design: [design.md](design.md)

## Phase 1: モデル層

- [x] T-1: `types.ts` の `FretboardBlock` に `mirrored?: boolean` を追加(コメントで「省略 = false = 右利き表示」を明記)。完了条件: `npm run typecheck` green
- [x] T-2: `src/model/migrate.test.ts` を新設(mirrored 付き v1 通過 / mirrored なし通過 / 不正バージョン例外)。完了条件: `npx vitest run src/model/migrate.test.ts` green

## Phase 2: レイアウト

- [x] T-3: `src/layout/fretboardLayout.ts` を新設し、`FretboardBlockView` の座標計算(定数・`INLAY_FRETS` 含む)を移設、`mirrored` 対応の `flip` と `stringX1/X2`・`hitRect` を実装。テストを先に書く。完了条件: `npx vitest run src/layout/fretboardLayout.test.ts` green

## Phase 3: UI

- [x] T-4: `FretboardBlockView.tsx` をジオメトリ関数利用に置換(X 座標の直書きを残さない)。「向き」セグメント(右利き|左利き、ツールチップ付き)、反転時の「ヘッド側 ▷」表示、`aria-label` 更新を実装。App.css にヘッド側手がかりのスタイルを追加。完了条件: `npm run typecheck` green + `npm run dev` で AC-1/2/5/6/7/8 目視確認

## Phase 4: 仕上げ

- [x] T-final: `npm run lint` / `npm run typecheck` / `npm test` すべて green、AC-3(保存/入出力)・AC-4(既存データ)を手動確認、CLAUDE.md の不変条件の文言を ADR 0001 準拠に更新、spec.md の status を done に更新
