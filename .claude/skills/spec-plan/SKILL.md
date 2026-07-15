---
name: spec-plan
description: 承認済み spec から技術設計 (design.md) と実装タスク (tasks.md) を作成する。「/spec-plan NNN-slug」または「この spec の設計をして」で起動。spec が無い場合はまず /specify を使う。
---

# /spec-plan — 技術設計とタスク分解

引数の spec ディレクトリ(`docs/specs/NNN-slug/`)を対象に、`design.md` と `tasks.md` を作成する。

## 手順

1. **spec を読む**: 対象の `spec.md`。status が draft のまま「要確認」が残っていれば、先にユーザーに確認する
2. **関連コードを読む**: 影響しそうなファイルを実際に読み、既存の型・関数・規約を確認する。特に:
   - `src/model/types.ts`(データ型)、`src/model/theory.ts` / `duration.ts`(理論・音価の既存関数 — 車輪の再発明をしない)
   - `src/model/migrate.ts`(保存形式に触れるか)
   - `src/components/blocks/tab/keymap.ts`(キーバインドに触れるか)
3. **design.md を書く**: `docs/specs/templates/design-template.md` に従う。必須の観点:
   - レイヤー方向(`model` ← `layout` ← `store`/`components`)を守る配置。ロジックは可能な限り model / layout の純関数に置き、コンポーネントは薄く保つ
   - 保存形式に触れるなら `schemaVersion` 繰り上げ + 移行関数を設計に含める
   - CLAUDE.md の不変条件チェックリストを 1 項目ずつ確認して埋める
   - 検討した代替案と採らなかった理由を短く残す(将来のアーキテクチャ判断は docs/adr/ にも記録)
4. **tasks.md を書く**: `docs/specs/templates/tasks-template.md` に従う。1 タスク = テストまたは目視で検証可能な単位。model → layout → store → components の依存順
5. **レビューエージェントにかける**: `spec-reviewer` に design が spec の受け入れ基準を全てカバーしているか、不変条件を壊さないかを確認させる。UI 設計セクションがある場合は `ux-designer`(操作フロー・ペルソナ視点)を、外観・描画・配色に触れる場合は `ui-designer`(見た目・具体的なスタイル値)も並行して起動する。指摘を反映する
6. **報告する**: 設計の要点・リスク・タスク数を要約し、承認されれば /spec-implement に進むよう案内する

## してはいけないこと

- このスキル内でプロダクトコードを書き始める
- 既存の model 関数を確認せずに新しい理論計算・音価計算を設計する
- 浮動小数点でのリズム計算、音高の保存、migrate.ts を通らない読み込みを含む設計
