# コード表の横型化と左利き表示・開放弦選択の修正 — 実装タスク

対応 design: [design.md](design.md)

## Phase 1: モデル層

- [x] T-1: `types.ts` の `ChordBlock` に `mirrored?: boolean` を追加、`migrate.test.ts` に ChordBlock ケースを追記。完了条件: `npx vitest run src/model/migrate.test.ts` green

## Phase 2: レイアウト

- [x] T-2: `src/layout/chordLayout.ts` を新設(`chordGeometry` = fretboardGeometry ラッパー + `CHORD_ROWS` / `CHORD_NAME_H` / `nameX`)。テストを先に書く。完了条件: `npx vitest run src/layout/chordLayout.test.ts` green

## Phase 3: UI

- [x] T-3: `OrientationToggle.tsx` を新設し(共通ツールチップ文言)、`FretboardBlockView` のトグルを置き換え(OFF = undefined 規約は呼び出し側で維持)。完了条件: `npm run typecheck` green + 指板図の向き切替が従来どおり動く
- [x] T-4: `ChordBlockView.tsx` の SVG を横型に置換(コード名行、ナット/フレット番号/インレイ/弦太さグラデーション、バレー縦帯カプセル形 ±9、ドット r=9、○/×、反転時ヘッド側手がかりはコード名行右端、aria-label)。開放/ミュート域を全弦・常時クリック可能にし、クリックサイクル + fingers クリア + 次状態ツールチップ + ホバープレビューを実装。運指行に弦番号ラベル。CSS(共有セレクタ化・base-fret-label 廃止・preview・ラベル)を更新。完了条件: `npm run typecheck` green + AC-1〜6, 9, 10 目視確認

## Phase 4: 仕上げ

- [x] T-final: `npm run lint` / `npm run typecheck` / `npm test` すべて green、AC-7(既存データ)・AC-8(再生)を手動確認、spec.md の status を done に更新
