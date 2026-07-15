# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Fretpad — ギタリストの学習ノート Web アプリ(ローカルファースト SPA、サーバーなし)。「弾く手を止めて、書いて、分析する」がコンセプト。プロダクトビジョン・ロードマップ・非ゴールは `docs/vision.md` が正であり、機能判断はそこに従う。UI テキスト・コメント・コミットメッセージは日本語。

## コマンド

```bash
npm run dev        # 開発サーバー (Vite, localhost:5173)
npm run build      # tsc -b + vite build(型チェックを含む)
npm test           # 全ユニットテスト (vitest run)
npx vitest run src/model/duration.test.ts   # 単一ファイルのテスト
npx vitest -t 'テスト名'                     # 名前でフィルタ
npm run lint       # oxlint
npm run typecheck  # tsc -b(ビルドなしの型チェック)
```

## 開発ワークフロー(仕様駆動)

機能追加・振る舞い変更は **Spec → Plan → Implement** で進める。詳細は `docs/specs/README.md`。

- `/specify <要望>` → `docs/specs/NNN-slug/spec.md`(要求仕様。vision 整合・非ゴール判定を含む)
- `/spec-plan NNN-slug` → `design.md` + `tasks.md`(技術設計とタスク分解)
- `/spec-implement NNN-slug` → タスクを順に実装(テストファースト、タスク単位コミット)
- 数行の bugfix・リファクタは spec 不要。ただし保存形式・不変条件・キーバインドに触れる変更は必ず spec を書く
- **完了の定義**: `npm run lint` / `npm run typecheck` / `npm test` が green + 受け入れ基準充足 + 不変条件無傷
- レビュー用サブエージェント: `spec-reviewer`(仕様・設計の監査)、`invariant-guardian`(diff の不変条件監査。コミット前に使う)、`ux-designer`(操作フロー・学習体験のペルソナ視点レビュー)、`ui-designer`(見た目 — 配色・余白・譜面 SVG 描画・画像出力品質の評価と提案)
- アーキテクチャ判断(不変条件の増減・技術採用)は `docs/adr/` に記録してから CLAUDE.md へ反映

## アーキテクチャ

レイヤーは一方向: `model` ← `layout` ← `store`/`components`。

- **`src/model/`** — 純粋 TS(React 非依存)。データ型・音楽理論・音価計算・生成・スキーマ移行。テストはこの層と layout に集中させる
- **`src/layout/tabLayout.ts`** — TabBlock → 座標付きジオメトリの純関数。React 非依存なのは Phase 1 の画像出力(SVG→PNG)で再利用するため。描画位置の計算はここ、SVG 要素の生成は `TabSvg.tsx`
- **`src/audio/player.ts`** — Web Audio 再生(Karplus-Strong 合成)。再生計画の生成は `model/playback.ts`(純関数)にあり、音を鳴らす部分だけをここに隔離。同時再生は全体で 1 つ
- **`src/store/`** — zustand + zundo(undo/redo)。`persistence.ts` が IndexedDB(idb)と JSON 入出力
- **`src/components/blocks/`** — ブロック種別ごとの View。TAB の編集操作は `tab/tabOps.ts` の純関数群(immutable)に分離されており、コンポーネントは薄く保つ

## 設計上の不変条件(壊さないこと)

- **音高は保存しない**。音は「弦 + フレット」で保持し、実音高は `pitchFromTab(tuning, string, fret, capo)` で導出する(単一の真実源)
- **リズム計算に浮動小数点を使わない**。音価は `fraction.ts` の分数演算で厳密に扱う(連符でも誤差ゼロ)。合計・比較は `durationValue` / `measureUsed` / `measureCapacity` を使う
- **永続化データは必ず `migrate.ts` を通す**(IndexedDB 読込・JSON インポート共通)。旧データの解釈が変わる変更(必須フィールドの増減・型や意味の変更)では `schemaVersion` を上げて移行関数を足す。欠落 = 従来挙動となる省略可能フィールドの追加では上げない([ADR 0001](docs/adr/0001-additive-optional-fields-keep-schema-version.md))
- **拍子は小節ごとの省略可能フィールド**で、`effectiveTimeSignature()` により前小節から継承される。小節の拍子を直接読まないこと
- **undo の粒度 = store 更新 1 回**。テキストブロックが下書きをローカル state に持ち blur で 1 回だけ commit するのは意図的(キーストロークごとに履歴を作らない)

## 紛らわしい規約

- 弦番号は **1 = 1弦(高音 E)**。`TabBlock.tuning` は index 0 = 1弦(MIDI 番号)
- ただし **`ChordBlock.frets` は index 0 = 6弦**(ダイアグラムの左端)で逆順。`null` = ミュート、`0` = 開放
- TAB エディタのキーバインドは `tab/keymap.ts` の表が単一情報源。実際のハンドラは `TabBlockView.tsx` の `handleKeyDown` にあり、両方を同期させること

## TypeScript 設定の注意

`erasableSyntaxOnly` が有効(enum・namespace・parameter properties 禁止、union 型を使う)。`verbatimModuleSyntax` のため型は `import type`。`strict` + `noUncheckedIndexedAccess` 有効(配列アクセスは undefined チェックが必要)。
