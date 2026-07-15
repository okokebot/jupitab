# Architecture Decision Records (ADR)

アーキテクチャ上の意思決定(採用/不採用の理由が将来問われるもの)を 1 決定 = 1 ファイルで記録する。spec の design.md より寿命が長い横断的な判断が対象。

- 命名: `NNNN-slug.md`(4 桁連番)
- テンプレート: [template.md](template.md)
- 一度 accepted にした ADR は書き換えない。覆すときは新しい ADR で supersede する

## いつ書くか

- ライブラリ・技術の採用/不採用(例: VexFlow を使わず自前 SVG 描画にした判断)
- レイヤー構成・データモデルの原則の追加・変更
- CLAUDE.md の「設計上の不変条件」を増減させる判断(ADR で理由を残してから CLAUDE.md を更新)

## 一覧

- [0001](0001-additive-optional-fields-keep-schema-version.md) — 省略可能フィールドの追加では schemaVersion を上げない
