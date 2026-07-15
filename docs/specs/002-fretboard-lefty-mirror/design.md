# 指板図の左利き(左右反転)表示 — 技術設計

対応 spec: [spec.md](spec.md)

## 方針概要

`FretboardBlock` に省略可能フィールド `mirrored?: boolean` を追加し(省略 = false = 従来表示)、描画座標の計算を新規モジュール `src/layout/fretboardLayout.ts`(純関数)に抽出して、反転はそこで一元処理する。コンポーネントはジオメトリ関数を呼ぶだけにし、**X 座標の直書きをコンポーネントに残さない**(反転漏れを構造的に防ぐ)。

採らなかった案:
- **SVG `transform="scale(-1,1)"` で丸ごと反転** — フレット番号・マーカーラベルの文字まで鏡像になるため不採用。文字ごとに再反転を重ねるのは要素ごとの座標反転より複雑
- **CSS/表示設定(データに保存しない)** — 画像出力・共有時に作者の意図した向きが再現されないため不採用(spec 要確認欄のとおり)

座標計算の layout 層への抽出は、TAB の `tabLayout.ts` と同じ理由(Phase 1 の画像出力で React 非依存に再利用)で、この機会に行う。

**並行 spec との関係**: `001-fretboard-scale-marking`(draft)も `FretboardBlockView` を変更する。本 spec のジオメトリ抽出を先に実装し、scale-marking の自動マーカー描画は `fretboardGeometry` を座標源にすること(それにより反転対応が自動で付いてくる)。

## 影響レイヤー

| レイヤー | 変更内容 | 新規/変更ファイル |
|---|---|---|
| model | `FretboardBlock.mirrored?: boolean` 追加 | `types.ts`(変更)、`migrate.test.ts`(新規) |
| layout | 指板図ジオメトリの純関数(反転対応)を新設 | `fretboardLayout.ts`(新規)、`fretboardLayout.test.ts`(新規) |
| store | 変更なし(既存の `updateBlock` を使用) | — |
| components | 座標計算をジオメトリ呼び出しに置換、向きセグメント+ヘッド側手がかり追加 | `FretboardBlockView.tsx`(変更)、`App.css`(ヘッド側手がかりのスタイル) |

## データモデル変更

- **保存形式の変更**: あり(省略可能フィールドの追加)
- **`schemaVersion` は 1 のまま**: 省略可能フィールドの追加は旧データの解釈を変えない(`undefined` = false = 従来表示)ため、バージョンを上げない。判断の根拠は [ADR 0001](../../adr/0001-additive-optional-fields-keep-schema-version.md)
- `migrate.ts` 変更なし(バージョン一致チェックのみで通過する)。ユニットテストで「`mirrored` 付き v1 ドキュメントが通る」「`mirrored` なしの旧ドキュメントが通る」を固定する
- CLAUDE.md の不変条件の文言を ADR 0001 準拠に更新する(T-final)

## 不変条件チェックリスト(CLAUDE.md)

- [x] 音高を保存しない — 表示のみの変更。`FretMarker` は従来どおり弦+フレット
- [x] リズム計算 — 該当なし
- [x] 永続化データは `migrate.ts` を通る — 経路変更なし。省略可能フィールドは v1 のまま通過(ADR 0001)
- [x] 拍子 — 該当なし
- [x] undo 粒度 = store 更新 1 回 — 向きの切替 1 回 = `updateBlock` 1 回
- [x] 弦番号規約 — `FretMarker.string`(1 = 1弦)は不変。反転は描画座標のみで、データの弦・フレットは変わらない
- [x] keymap 同期 — 該当なし(マウス操作のみのブロック)

## レイアウト設計(fretboardLayout.ts)

`FretboardBlockView` にある座標定数・計算(`INLAY_FRETS` 含む)を移設し、反転を内部の `flip(x) = mirrored ? width - x : x` で一元処理する:

```
fretboardGeometry({ stringCount, fretStart, fretEnd, mirrored }) → {
  width, height,           // 余白規則(ナット側 40 / 反対側 20、上 24 / 下 36)を内包
  stringY(string),         // 弦の Y(反転の影響なし)
  stringX1, stringX2,      // 弦線の水平範囲 = fretLineX(0) と fretLineX(fretCount) の min/max
  fretLineX(i),            // i 本目のフレット線 X(i = 0 がナット側)
  fretNumberX(fret),       // フレット番号ラベルの中心 X
  inlayX(fret),            // ポジションマークの中心 X
  markerX(fret),           // マーカー中心 X(fret 0 = 開放弦はナットの外側 16px)
  hitRect(string, fret),   // クリック領域。通常セル幅 42、開放弦セルは幅 28(ナット手前で止め、第 1 セルと重ねない)
}
```

- 文字は `text-anchor: middle`(既存 CSS)なので中心座標の反転だけで正しく描画される
- クリック領域・マーカー・番号・ポジションマークはすべて同じ座標源(`markerX` 系)から導出し、反転時のズレを構造的に防ぐ
- `INLAY_FRETS`(ポジションマーク対象フレット)も本モジュールに移設し export する

## UI 設計

- ツールバー(フレット範囲入力の隣)に**「向き」セグメント**を追加: `右利き | 左利き` の 2 ボタン(`btn btn-sm`、選択中は `btn-active` + `aria-pressed`)。ON/OFF トグルではなく 2 択にすることで、現在の向きが常に読める(AC-8)
- ツールチップ(`title`): 左利き側に「左右反転して表示します(ヘッドが右)。弦の並びは変わりません」、右利き側に「一般的な指板図の向き(ヘッドが左)」
- **ヘッド側の手がかり**(AC-7): `mirrored` のとき、フレット番号行の右端(ヘッド側)に `ヘッド側 ▷` を淡色(`--text-dim`、10.5px)で描画する。通常表示は世間の慣習どおりなので表示しない(譜面が主役の原則によりノイズを増やさない)
- SVG の `aria-label` を `「{ラベル}(左利き表示)」` とし、支援技術にも向きを伝える
- `mirrored` を OFF に戻すときはフィールドを `undefined` にする(保存 JSON を汚さない)

## テスト戦略

- **layout**(`fretboardLayout.test.ts`):
  - 通常時: ナット X = 左端(40)、`markerX` がフレット間中央、開放弦がナット左外側(24)、弦線範囲 = ナット〜最終フレット線
  - 反転時: すべての X が `width - 通常時X` と一致(対称性)、ナットが右端、開放弦がナット右外側、`stringX1/X2` が反転後も min/max を保つ
  - `fretStart > 0`(ハイポジション図)での番号・マーカー位置
  - 12F を含む範囲のポジションマーク位置(`INLAY_FRETS`)
  - `hitRect`: 通常セルが `markerX` 中心・幅 42、開放弦セルが幅 28 でナットを跨がない(通常・反転両方)
- **model**(`migrate.test.ts`): `mirrored: true` 付き v1 ドキュメントが `migrateDoc` を通る / `mirrored` なしでも通る / 不正バージョンは従来どおり例外
- **手動確認**: `npm run dev` で向き切替 → AC-1/2/5/6/7/8 を目視、保存 → リロードで AC-3、既存ノートを開いて AC-4

## 受け入れ基準との対応

| AC | 検証方法 |
|---|---|
| AC-1 | layout テスト(対称性)+ 手動確認 |
| AC-2 | layout テスト(hitRect 中心 = markerX)+ 手動確認 |
| AC-3 | migrate テスト(mirrored 透過)+ 手動確認(保存 → リロード、エクスポート → インポート) |
| AC-4 | migrate テスト(mirrored なしで通過)+ 手動確認(既存ノート読込) |
| AC-5 | layout テスト(開放弦 X の反転)+ 手動確認 |
| AC-6 | layout テスト(inlayX の反転) |
| AC-7 | 手動確認(fretStart > 0 の反転図でヘッド側表示を目視) |
| AC-8 | 手動確認(セグメントの状態表示とツールチップ) |
