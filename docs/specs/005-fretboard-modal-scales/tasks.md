# 指板図のモーダルスケール拡充(フリジアン/リディアン/ロクリアン) — 実装タスク

対応 design: [design.md](design.md)

ルール:
- 1 タスク = 検証可能な単位。完了条件(テスト green・目視確認)を各タスクに書く
- 依存順に並べる。model → layout → store → components が基本
- 完了したら `[x]` にする。設計変更が起きたら design.md を直してからタスクを更新

## Phase 1: モデル層

- [x] T-1: `src/model/types.ts` の `ScaleType` に `'phrygian' | 'lydian' | 'locrian'` を追加。完了条件: `npm run typecheck` green(既存 `Record<ScaleType, ...>` を使う箇所でコンパイルエラーが出る場合は T-2 と併せて解消)
- [x] T-2: `src/model/theory.ts` の `SCALE_INTERVALS` に `phrygian: [0,1,3,5,7,8,10]` / `lydian: [0,2,4,6,7,9,11]` / `locrian: [0,1,3,5,6,8,10]` を追加。`MODAL_CHARACTERISTIC_INTERVAL` の型を `Partial<Record<ScaleType, number[]>>` に変更し、既存の `dorian: 9` / `mixolydian: 10` を `dorian: [9]` / `mixolydian: [10]` に書き換え、`phrygian: [1]` / `lydian: [6]` / `locrian: [1, 6]` を追加。`isCharacteristicTone` を配列の `includes` 判定に変更。完了条件: `npx vitest run src/model/theory.test.ts` で既存テストが green のまま通る
- [x] T-3: `src/model/theory.test.ts` に フリジアン・リディアン・ロクリアンの `isCharacteristicTone` テストと `scalePositions` テスト(design.md のテスト戦略節のとおり。ロクリアンは特徴音ピッチクラスが 2 種類であることを検証)を追加。既存の「モーダル以外のスケールでは常に false」テスト(`theory.test.ts:98-113`)の対象 `scales` 配列には新設 3 モードを含めないこと(AC-5 は「元々仕組みが無い 7 種」の回帰確認であり、新設 3 モードを混ぜると意図が崩れる)。完了条件: `npx vitest run src/model/theory.test.ts` green

## Phase 2: UI

- [ ] T-4: `src/components/blocks/FretboardBlockView.tsx` の `SCALE_GROUPS`「慣れてきたら」グループに `phrygian` / `lydian` / `locrian` を日本語ラベルで追加し、モード系(ドリアン/フリジアン/リディアン/ミクソリディアン/ロクリアン)が隣接する並び順に変更。完了条件: `npm run dev` でスケール選択肢に 3 モードが表示され、並び順が design.md のとおりであることを目視確認
- [ ] T-5: `hoverTitle` のシグネチャを `pc: number` から `p: ScalePosition` に変更し、`p.isCharacteristic` が true のとき文言に「・特徴音」を付与。呼び出し側(`hoverTitle(auto.pc)` → `hoverTitle(auto)`)を更新。完了条件: `npm run dev` でフリジアン/リディアン/ロクリアンそれぞれを選択し、特徴音位置のホバーで「・特徴音」が表示されることを目視確認(ロクリアンは ♭2・♭5 の両方とも確認)
- [ ] T-5b(ux-designer 指摘反映): `hasCharacteristicTones = autoPositions.some((p) => p.isCharacteristic)` を算出し、true のとき `fretboard-lens` ツールバーに常時ヒント文言(`lens-hint characteristic-hint`)を表示。ホバーという操作に気づけない初見のユーザーでも紫の意味に到達できるようにする(spec.md AC-8)。完了条件: `npm run dev` で特徴音を含むスケール選択時にホバーせずともヒント文言が表示され、特徴音の無いスケール(例: メジャー)では表示されないことを目視確認

## Phase 3: 手動確認(design.md のテスト戦略節に対応)

- [ ] T-6: `npm run dev` で以下を確認: (1) フリジアン選択で♭2 が紫になり常時ヒントが出る (2) リディアン選択で増4度が紫になり度数表示は `♭5` になる (3) ロクリアン選択で♭2・♭5 に該当する複数箇所が紫になり、異なる位置のホバーで異なる音名・度数が確認できる (4) ラベル表示「点のみ」でも常時ヒントとホバーの「特徴音」文言がどちらも出る (5) 左利きミラー表示(002)をオンにした状態でも上記が鏡像位置で成立する (6) スケール選択の「慣れてきたら」グループでモード系が隣接して並んでいる。完了条件: 6 項目すべて目視確認

## Phase 4: 仕上げ

- [ ] T-final: `npm run lint` / `npm run typecheck` / `npm test` すべて green、spec.md の受け入れ基準(AC-1〜AC-12)を全確認、spec.md の status を `done` に更新
