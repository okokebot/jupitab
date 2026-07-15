# 仕様駆動開発ワークフロー

Fretpad の機能追加・変更は **Spec → Plan → Implement** の 3 段階で行う。各段階が Markdown 成果物を生み、次の段階の入力になる(GitHub Spec Kit / Kiro の SDD パターンを本プロジェクト規模に簡約したもの)。

## 全体フロー

```
/specify <要望>            → docs/specs/NNN-slug/spec.md      (何を・なぜ)
/spec-plan NNN-slug        → design.md + tasks.md             (どう作るか・作業分解)
/spec-implement NNN-slug   → 実装 + テスト + タスク消し込み     (作る)
```

- **spec.md** — 要求仕様。背景、vision との対応、スコープ/非スコープ、受け入れ基準(EARS 形式)。実装方法は書かない
- **design.md** — 技術設計。影響レイヤー、データモデル変更(schemaVersion / migration の要否)、不変条件チェック、テスト戦略
- **tasks.md** — 実装タスクのチェックリスト。1 タスク = 検証可能な単位(テスト green で完了)

テンプレートは [templates/](templates/) にある。

## いつ spec を書くか

| 変更の種類 | spec |
|---|---|
| 新機能・既存機能の振る舞い変更 | **必須** |
| 保存形式 (`schemaVersion`)・不変条件・キーバインドに触れる変更 | **必須**(規模が小さくても) |
| 数行の bugfix、リファクタ、typo、依存更新 | 不要(通常のコミットで) |

## 原則

1. **vision.md が憲法**。spec は必ず vision の柱・非ゴールとの対応を明記する。非ゴールに近づく仕様は書かない(`docs/improvement-policy.md` の優先順位も参照)
2. **受け入れ基準はテスト可能に**。「使いやすくする」ではなく「WHEN X THEN Y」で書く
3. **不明点は仮置きしない**。spec 内に `[要確認]` と明記し、ユーザーに質問してから実装に進む
4. **spec は生きた文書**。実装中に判断が変わったら spec/design を更新してから進む(コードと仕様の乖離が最大の技術的負債)
5. **完了の定義 (DoD)**: `npm run lint` / `npm run typecheck` / `npm test` がすべて green、受け入れ基準を満たす、CLAUDE.md の不変条件を壊していない

## ディレクトリ命名

`docs/specs/NNN-slug/`(NNN は 3 桁連番、slug は英小文字ケバブケース)。例: `001-fretboard-scale-marking/`

## ステータス管理

spec.md の frontmatter でステータスを管理する:

```
status: draft → approved → implementing → done(または rejected)
```
