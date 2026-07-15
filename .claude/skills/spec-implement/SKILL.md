---
name: spec-implement
description: spec/design/tasks が揃ったディレクトリを対象に、タスクを順に実装する。「/spec-implement NNN-slug」または「この spec を実装して」で起動。design.md が無い場合はまず /spec-plan を使う。
---

# /spec-implement — タスクの実装

引数の spec ディレクトリ(`docs/specs/NNN-slug/`)の `tasks.md` を上から順に消化する。

## 開始時

1. `spec.md` / `design.md` / `tasks.md` を読む。design.md が無ければ /spec-plan に誘導して終了
2. `spec.md` の status を `implementing` に更新
3. 作業ブランチを確認(master/main 直上での大きな変更なら `feat/NNN-slug` ブランチを切る)

## タスクごとのループ

1. **テストから書く**(model / layout のタスク): 受け入れ基準に対応するテストを先に書き、red を確認してから実装する。分数演算の厳密性・境界値(カポ、変拍子、連符、空小節)を含める
2. **実装する**: design.md の配置に従う。design と違う判断が必要になったら、**先に design.md を更新してから**コードを書く(コードと設計の乖離を作らない)
3. **ゲートを通す**: `npx vitest run <関連テスト>` → green になったら tasks.md のチェックボックスを `[x]` に更新
4. **タスク単位でコミットする**: 日本語のコミットメッセージで、spec 番号を含める(例: `spec-001: 指板図にスケール自動マーキングを追加`)

## 全タスク完了時(Definition of Done)

1. `npm run lint` / `npm run typecheck` / `npm test` をすべて実行し green を確認
2. 受け入れ基準を 1 つずつ照合(design.md の「受け入れ基準との対応」表に従い、手動確認分は verify スキルまたは `npm run dev` で実際に操作して確認)
3. code-review スキルを実行し、確認された指摘を修正
4. `spec.md` の status を `done` に更新
5. 結果を報告: 実装内容の要約、テスト結果、受け入れ基準の充足状況、残課題(あれば)

## してはいけないこと

- ゲート(lint / typecheck / test)が red のままタスクを完了扱いにする
- design.md に無い設計判断を無言でコードに入れる
- 不変条件(CLAUDE.md)に触れる実装 — 気づいたら手を止めて design に立ち戻る
- 複数タスクをまとめた巨大コミット
