---
title: 指板図のモーダルスケール拡充(フリジアン/リディアン/ロクリアン) — 技術設計
---

# 指板図のモーダルスケール拡充(フリジアン/リディアン/ロクリアン) — 技術設計

対応 spec: [spec.md](spec.md)

## 方針概要

既存の自動マーキング機構(003 spec、`scalePositions()` / `isCharacteristicTone()`)は 1 スケールにつき 1 つの特徴音しか表現できない(`MODAL_CHARACTERISTIC_INTERVAL: Partial<Record<ScaleType, number>>`)。ロクリアンは特徴音が♭2・♭5 の 2 つあるため、この値を単一の `number` から `number[]` に変える。この型変更さえ行えば、`scalePositions()` はフレット位置ごとに独立して `isCharacteristicTone()` を呼んでいるため(`theory.ts:114`)、複数ピッチクラスが特徴音になっても呼び出し側のロジック変更は不要 — 各構成音位置がそれぞれ判定されるだけで自然に両方フラグが立つ。UI 側の変更は SCALE_GROUPS への選択肢追加と、ホバーツールチップへの「特徴音」文言追加の 2 点のみで、描画ロジック(`marker-auto-characteristic` クラス付与)は変更しない。

検討した代替案:
- **モードごとに別配列(`CHARACTERISTIC_INTERVALS_LOCRIAN` 等)を用意** — 採らず。既存の `Partial<Record<ScaleType, number>>` を `Partial<Record<ScaleType, number[]>>` に変えるだけで済み、`isCharacteristicTone` の呼び出し側 API(`pc`, `key` を渡して bool を返す)は変わらないため影響範囲が最小
- **`isCharacteristicTone` の返り値を `boolean` から特徴音の種類を返す型に変える** — 採らず。現状 UI は「特徴音かどうか」の bool だけで十分描画・ツールチップを組み立てられ、種類分けの要求(spec 非スコープ: 詳細な理論解説)が無い

## 影響レイヤー

| レイヤー | 変更内容 | 新規/変更ファイル |
|---|---|---|
| model | `ScaleType` に 3 モード追加。`SCALE_INTERVALS` に構成音追加。`MODAL_CHARACTERISTIC_INTERVAL` を `number` → `number[]` に変更し `isCharacteristicTone` を配列対応に | `src/model/types.ts`, `src/model/theory.ts` |
| layout | 変更なし(`scalePositions()` はシグネチャ・ロジックとも変更不要) | — |
| store | 変更なし(`ScaleType` は既存 `keyContext.scale` フィールドの許容値が増えるだけ) | — |
| components | `SCALE_GROUPS` に 3 選択肢追加・並び順調整。`hoverTitle` が特徴音の場合に文言を追加するようシグネチャ変更 | `src/components/blocks/FretboardBlockView.tsx` |

## データモデル変更

- **保存形式の変更**: なし
- `ScaleType` は TS のコンパイル時 union であり、JSON/IndexedDB 上は単なる文字列。`migrate.ts` や `persistence.ts` に `ScaleType` の値を検証するコードは存在しない(grep 確認済み)ため、許容する文字列を増やしても schemaVersion は上げない(ADR 0001: 追加的な変更で旧データの解釈は変わらない)
- 旧データ(3 モードを未使用のデータ)は読み込み時に何も変わらず、そのまま開ける
- JSON エクスポート/インポートへの影響: なし(値が増えるだけで形式は同じ)

## 不変条件チェックリスト(CLAUDE.md)

- [x] 音高を保存しない — 影響なし。`scalePositions()` は従来どおり `pitchFromTab` から都度導出する
- [x] リズム計算は `fraction.ts` の分数演算 — 本 spec はリズムに触れない
- [x] 永続化データは `migrate.ts` を通る — `ScaleType` の値追加は形状変更ではないため `migrate.ts` 変更不要(上記のとおり)
- [x] 拍子は `effectiveTimeSignature()` 経由 — 本 spec は拍子に触れない
- [x] undo 粒度 = store 更新 1 回 — スケール変更は既存の `setScale()`(`FretboardBlockView.tsx:93-106`)をそのまま使い、`apply()` 経由で 1 回の `updateBlock` 呼び出しに収まる(変更なし)
- [x] 弦番号規約 — 本 spec は弦番号の扱いに触れない
- [x] キーバインド変更なし — `keymap.ts` / `handleKeyDown` は無関係

## UI 設計

### 1. `src/model/types.ts`

```ts
export type ScaleType =
  | 'major'
  | 'naturalMinor'
  | 'harmonicMinor'
  | 'melodicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'phrygian'
  | 'lydian'
  | 'locrian'
```

### 2. `src/model/theory.ts`

```ts
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  // ...既存...
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
}

/** モーダルスケールの特徴音(親スケールとの差分となる度数の半音距離。複数ありうる) */
const MODAL_CHARACTERISTIC_INTERVAL: Partial<Record<ScaleType, number[]>> = {
  dorian: [9], // 6(長6度) — ナチュラルマイナーの ♭6 との差
  mixolydian: [10], // ♭7 — メジャーの 7 との差
  phrygian: [1], // ♭2 — ナチュラルマイナーの 2 との差
  lydian: [6], // #4(ラベル表示は ♭5) — メジャーの 4 との差
  locrian: [1, 6], // ♭2 と ♭5 — ナチュラルマイナーの 2・5 との差
}

export function isCharacteristicTone(pc: number, key: KeyContext): boolean {
  const intervals = MODAL_CHARACTERISTIC_INTERVAL[key.scale]
  if (intervals === undefined) return false
  const dist = (((pc - key.tonic) % 12) + 12) % 12
  return intervals.includes(dist)
}
```

`scalePositions()`(`theory.ts:94-119`)は変更不要。フレット位置ごとに `isCharacteristicTone(pc, key)` を呼ぶだけなので、ロクリアンで 2 つのピッチクラスが該当すれば、該当する位置がそれぞれ独立して `isCharacteristic: true` になる。

### 3. `src/components/blocks/FretboardBlockView.tsx`

`SCALE_GROUPS` の「慣れてきたら」グループを、モード系(ドリアン/フリジアン/リディアン/ミクソリディアン/ロクリアン)が隣接するように並べ替えて追加する:

```ts
{
  heading: '慣れてきたら',
  scales: [
    { value: 'harmonicMinor', label: 'ハーモニックマイナー' },
    { value: 'melodicMinor', label: 'メロディックマイナー' },
    { value: 'dorian', label: 'ドリアン' },
    { value: 'phrygian', label: 'フリジアン' },
    { value: 'lydian', label: 'リディアン' },
    { value: 'mixolydian', label: 'ミクソリディアン' },
    { value: 'locrian', label: 'ロクリアン' },
  ],
},
```

`hoverTitle` は `pc: number` 単体ではなく `ScalePosition` を受け取るように変更し(`isCharacteristic` は既に `ScalePosition` に含まれているため追加の判定呼び出しは不要)、特徴音のときは末尾に「・特徴音」を付与する(AC-8, AC-9, AC-10 — 色だけに依存させない、ロクリアンの 2 音が独立した音だと判別できるようにする):

```ts
const hoverTitle = (p: ScalePosition) =>
  key
    ? `${pitchClassName(p.pc, key.preferFlats)}(${degreeInKey(p.pc, key)})${p.isCharacteristic ? '・特徴音' : ''}`
    : ''
```

呼び出し側(`FretboardBlockView.tsx:373`)は `hoverTitle(auto.pc)` → `hoverTitle(auto)` に変更する(`auto` は既に `ScalePosition | undefined` でガード済み)。

CSS(`App.css` の `.marker-auto-characteristic`)は変更不要 — 既にクラスの有無で紫色にするだけの実装であり、1 スケールに複数の特徴音位置があっても各 `<g>` に個別にクラスが付くだけで済む。

**常時表示のヒント(design.md レビューで ux-designer から追加を指摘、spec.md AC-8 に反映済み)**: ホバーという操作自体に初見のユーザーが気づけない可能性があるため、特徴音を含むスケールを選択している間は `fretboard-lens` ツールバー行に短い案内文を常時表示する。既存の `autoPositions` から追加の判定関数なしで導出できる:

```tsx
const hasCharacteristicTones = autoPositions.some((p) => p.isCharacteristic)
```

```tsx
{key && hasCharacteristicTones && (
  <span className="lens-hint characteristic-hint">
    紫の点はこのモードを特徴づける音です(ホバーで音名・度数を確認できます)
  </span>
)}
```

既存の「keyContext 未設定時ヒント」(`lens-hint`, `FretboardBlockView.tsx:293-297`)と同じ `lens-hint` クラスを土台にし、常時表示の案内文という扱いを揃える。理論解説(非スコープ)ではなく「どこを見ればいいか・何をすればいいか」という操作案内に留める。

## テスト戦略

- **model**(`src/model/theory.test.ts`、テストの主戦場):
  - `isCharacteristicTone` に `describe` ブロックを追加: フリジアン(♭2 のみ true)、リディアン(増4度 = 半音 6 のみ true、ラベルが `♭5` になることも確認)、ロクリアン(♭2 と♭5 の両方が true、それ以外は false)
  - 既存のドリアン・ミクソリディアンのテスト(`theory.test.ts:59-122` の `describe('isCharacteristicTone(モーダル特徴音)')` ブロック)は型変更後もそのまま green であることを回帰確認として実行(API 変更なしなのでテストコード自体の変更は不要)
  - 「モーダル以外のスケールでは常に false」テスト(`theory.test.ts:98-113`)は対象 7 種のみのため変更不要。新規 3 モードを誤って false 判定してしまう回帰がないことは新設の describe で担保する
  - `scalePositions` に describe ブロックを追加: フリジアン・リディアンで特徴音のピッチクラスが 1 種類、ロクリアンで特徴音のピッチクラスが **2 種類**(`charPcs` の `Set` サイズが 2)であることを検証(既存の「特徴音のピッチクラスは 1 種類だけ」テストと対になる新パターン)
- **手動確認**(`npm run dev`):
  1. 指板図ブロックでスケールに「フリジアン」を選択 → ♭2 の位置が紫になり、常時ヒント文言(「紫の点は…」)が表示されることを目視
  2. 「リディアン」→ 増4度の位置が紫になり、ラベル表示「度数」で `♭5` と表示されることを確認
  3. 「ロクリアン」→ ♭2・♭5 に該当する複数箇所(複数フレット・複数弦にわたりうる)が紫になることを確認。異なる位置をいくつかホバーし、ツールチップに ♭2 と ♭5 の 2 種類の異なる音名・度数 + 「・特徴音」が出ることを確認(表示不具合ではないことの確認)
  4. ラベル表示を「点のみ」にしても、常時ヒントとホバーの「特徴音」文言がどちらも出ることを確認
  5. 左利きミラー表示(002)をオンにした状態で上記を再確認し、鏡像位置でも強調表示されることを確認
  6. スケール選択の「慣れてきたら」グループでモード系が隣接して並んでいることを目視

## 受け入れ基準との対応

| AC | 検証方法(テスト名 or 手動手順) |
|---|---|
| AC-1 | 手動確認 6(SCALE_GROUPS の並び順・選択肢表示) |
| AC-2 | `theory.test.ts` フリジアン特徴音テスト + 手動確認 1 |
| AC-3 | `theory.test.ts` リディアン特徴音テスト(度数ラベルが `♭5` になることを含む)+ 手動確認 2 |
| AC-4 | `theory.test.ts` ロクリアン特徴音テスト(2 ピッチクラス)+ 手動確認 3 |
| AC-5 | 既存の「モーダル以外のスケールでは常に false」テスト(回帰確認、変更不要) |
| AC-6 | 既存のドリアン・ミクソリディアンの特徴音テスト(`theory.test.ts:59-122` の `isCharacteristicTone` ブロック、`164-212` の `scalePositions` ブロック)がそのまま green であることを確認(型変更後の回帰確認) |
| AC-7 | `theory.test.ts` の `derivedLabel`/`degreeInKey` 経由の確認(度数・音名ラベルは `scalePositions`/`derivedLabel` の既存経路をそのまま使うため新規テスト不要、手動確認 2 でも兼ねる) |
| AC-8 | 手動確認 1・3(ホバーツールチップの「特徴音」文言 + 常時ヒント文言の表示) |
| AC-9 | 手動確認 3(ロクリアンの複数箇所がそれぞれ ♭2・♭5 いずれかの独立した音名・度数を示す) |
| AC-10 | 手動確認 4(ラベル「点のみ」でもホバーで特徴音と分かる) |
| AC-11 | 永続化は `ScaleType` 文字列が増えるだけで既存の保存・読込経路をそのまま通るため新規テスト不要(データモデル変更なしの設計根拠を参照) |
| AC-12 | 手動確認 5(左利きミラー表示との併用) |
