# 指板図のスケール自動マーキングと度数表示 — 実装タスク

対応 design: [design.md](design.md)

ルール:
- 1 タスク = 検証可能な単位。完了条件(テスト green・目視確認)を各タスクに書く
- 依存順に並べる。model → layout → store → components が基本
- 完了したら `[x]` にする。設計変更が起きたら design.md を直してからタスクを更新

## Phase 1: モデル層

- [x] T-1: `types.ts` に `FretboardBlock.labelMode?: 'degree' | 'name' | 'none'` を追加(欠落 = 'degree' 扱いをコメントに明記)。完了条件: `npm run typecheck` green
- [x] T-2: `theory.ts` に `ScalePosition` 型と `scalePositions(tuning, fretStart, fretEnd, key)` を実装し、`theory.test.ts` にテスト追加(A マイナーペンタ既知位置 / fretStart=5 の範囲境界 / ドロップ D / isRoot 判定)。完了条件: `npx vitest run src/model/theory.test.ts` green

## Phase 2: UI — 設定コントロール

- [ ] T-3: `FretboardBlockView.tsx` にルート select(異名同音併記・既定 A)・スケール select(「なし」+ 日本語名 optgroup)を追加し、`keyContext` を `updateBlock` 1 回で保存。keyContext 未設定時のヒント 1 行を表示。完了条件: 手動確認 — 設定/解除(AC-1, 2, 5, 9, 10 前半)、undo 1 回で巻き戻り(AC-15)

## Phase 3: UI — 自動マーカー描画

- [ ] T-4: 自動マーカーの SVG 描画(描画順: 格子 → ヒット領域 → 自動 → 手動、`pointer-events: none`、`<title>音名(度数)</title>`)+ `App.css` に `marker-auto` / `marker-auto-root` スタイル。完了条件: 手動確認 — 構成音表示・ルート強調・手動前面・自動位置クリックで手動マーカー生成(AC-1, 4, 6, 7 前半, 8, 12, 13 の目視分)
- [ ] T-5: ラベル切替(度数/音名/点のみ)セグメント + ♯/♭ トグル(音名時のみ)+ `labelMode` 保存。完了条件: 手動確認 — 3 モード切替・♯♭ 反映・1 クリック・Tab キー到達(AC-3, 11)、リロードで復元(AC-14)
- [ ] T-6: 手動マーカー連携 — 空ラベル手動マーカーの導出ラベル表示(AC-7 後半)、マーカーエディタの度数併記(AC-10 後半)、手動スタイル表記「ルート」→「強調」。完了条件: 手動確認

## Phase 4: 仕上げ

- [ ] T-final: `npm run lint` / `npm run typecheck` / `npm test` すべて green、受け入れ基準 AC-1〜15 を design の対応表どおり全確認(エクスポート/インポート含む)、spec.md の status を done に更新
