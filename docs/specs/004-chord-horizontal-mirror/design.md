# コード表の横型化と左利き表示・開放弦選択の修正 — 技術設計

対応 spec: [spec.md](spec.md)(レビュー反映済み: spec-reviewer / ux-designer / ui-designer 2026-07-14)

## 方針概要

`ChordBlock` に省略可能フィールド `mirrored?: boolean` を追加し(ADR 0001 の適用第 3 例。`schemaVersion` は 1 のまま)、描画を横型に置き換える。座標計算は spec 002 で抽出済みの `fretboardGeometry` を薄いラッパー `chordGeometry`(新規 `src/layout/chordLayout.ts`)経由で再利用する — コード表は「開始フレットから 5 フレット分の指板図 + コード名 + バレー + ○/×」なので、`fretStart = baseFret - 1, fretEnd = baseFret - 1 + 5` の指板図ジオメトリがそのまま使える。

「向き」セグメントは共通コンポーネント `OrientationToggle` に抽出し、`FretboardBlockView` も置き換える。

採らなかった案:
- **縦型のまま反転対応** — 図法が指板図と 90° 違う問題が残るため不採用
- **コード表専用ジオメトリの新規実装** — fretboardGeometry と実質同一計算の重複になり反転バグの再発点になるため不採用

**データの弦順規約は変えない**: `ChordBlock.frets` は index 0 = 6弦のまま。描画時の写像 `弦番号 = stringCount - index` は View の責務(`playback.ts` の既存写像と同型)。`chordGeometry` は弦番号(1 = 1弦 = 上)ベースのまま公開する。

**並行 spec**: 003(scale-marking, implementing)が同じ `FretboardBlockView.tsx` を触る。T-3(トグル共通化)は差分が小さいので通常のマージで解決可能だが、実装時点の作業ツリーを正とする。

## 影響レイヤー

| レイヤー | 変更内容 | 新規/変更ファイル |
|---|---|---|
| model | `ChordBlock.mirrored?: boolean` 追加 | `types.ts`(変更)、`migrate.test.ts`(ケース追加) |
| layout | `chordGeometry` 新設 | `chordLayout.ts`(新規)、`chordLayout.test.ts`(新規) |
| store | 変更なし | — |
| components | SVG 横型化、開放/ミュート域の常時化、トグル共通化、運指行ラベル | `ChordBlockView.tsx`、`OrientationToggle.tsx`(新規)、`FretboardBlockView.tsx`、`App.css` |
| audio/playback | 変更なし(`planChordPlayback` は frets のみ参照 = AC-8) | — |

## データモデル変更

- 省略可能フィールド `mirrored` の追加のみ。**`schemaVersion` は 1 のまま**([ADR 0001](../../adr/0001-additive-optional-fields-keep-schema-version.md))
- **OFF 時は `undefined` を保存**(`false` を書かない)— 002 の規約を両ブロックで統一。共通トグルの `onChange(false)` を呼び出し側で `mirrored: undefined` に写す
- **運指の残留処理**: 開放化・ミュート化(頭部クリック)および ● 再クリックでの解除時に、その弦の `fingers[i]` を `null` にクリアする。押弦がないのに運指だけ JSON に残る状態を作らない(spec-reviewer 指摘)

## 不変条件チェックリスト(CLAUDE.md)

- [x] 音高を保存しない — 表示のみ。再生は既存 `planChordPlayback` のまま
- [x] リズム計算 / 拍子 — 該当なし
- [x] migrate.ts — 経路変更なし(ADR 0001)
- [x] undo 粒度 — クリック 1 回・トグル 1 回 = `updateBlock` 1 回(fingers クリアも同一 update 内で行う)
- [x] 弦番号規約 — `frets` index 0 = 6弦は不変。写像は View 内限定
- [x] keymap 同期 — 該当なし

## レイアウト設計(chordLayout.ts)

```
CHORD_ROWS = 5                    // 表示フレット数(現行踏襲)
CHORD_NAME_H = 22                 // コード名行の高さ
chordGeometry({ stringCount, baseFret, mirrored }) → {
  ...fretboardGeometry({ stringCount, fretStart: baseFret - 1, fretEnd: baseFret - 1 + CHORD_ROWS, mirrored }),
  boardHeight,                    // 指板部分の高さ(= fretboardGeometry の height)
  height: boardHeight + CHORD_NAME_H,   // SVG 全体の最終高さ(責務は chordGeometry に一本化)
  boardOffsetY: CHORD_NAME_H,     // 指板部分の <g transform> オフセット
  nameX: width / 2,               // コード名中心(反転の影響なし)
}
```

- View は指板部分を `<g transform="translate(0, boardOffsetY)">` に入れる。`stringY` 等の Y はグループ内座標のまま使う(フレット番号は `boardHeight - 8`)
- **ナット**: `baseFret === 1` のとき fret 0 の線を太線(fretboardGeometry の条件分岐がそのまま成立)
- **フレット番号**: 指板図と同様に各フレットへ表示(従来の開始フレット数字のみ表示 + `.base-fret-label` は廃止)
- **インレイ(ポジションマーク)**: **描く**(指板図と同じ 3/5/7/9/12…F、r=3.5、`--border`)。コード表を「ポジション」として読めるようにする(ui-designer 指摘)
- **弦線の太さ**: 指板図と同じグラデーション(`0.8 + (弦番号 - 1) × 0.25`、6弦側が太い)。反転時にも上下の向きが分かる冗長な手がかり
- **開放/ミュート域**: `markerX(0)` / `hitRect(string, 0)` は `fretStart` 非依存(002 実装済み)。**全弦・常時**ヒット領域を置く
- **バレー(縦帯)**: ドットと同じ太さのカプセル形に修正(ui-designer must)—
  `x = markerX(fret) - 9, width = 18, rx = 9, y = stringY(toString) - 9, height = stringY(fromString) - stringY(toString) + 18`。範囲外フレットは非表示(現行踏襲)
- **ドット**: `r = 9`、運指数字 10px(指板図マーカーと同値に統一。現行の r7.5/9.5px から変更)
- **○/×**: `x = markerX(0)`、`y = stringY(弦) + 4`(12px フォントの視覚センタリング。dominant-baseline は SVG→PNG 互換性のため使わない)
- **ヘッド側手がかり**: 反転時のみ「ヘッド側 ▷」を**コード名行の右端**(`x = width - 2, y = 16`、translate 外)に置く。指板図の位置(番号行の右端)だと 2 桁フレット番号と重なるため(ui-designer 指摘)

## UI 設計

- **OrientationToggle**(新規 `src/components/blocks/OrientationToggle.tsx`): props = `{ mirrored, onChange }`。ツールチップは両ブロック共通の文言に調整: 右利き「一般的な図の向き(ヘッドが左)」/ 左利き「左右反転して表示します(ヘッドが右)。弦の並びは変わりません」
- **開放/ミュート域のクリック**(AC-4/5/9): 押弦中 → `0`(開放)、`0` → `null`(×)、`null` → `0`。● 再クリック = 解除(× へ)は現行維持。いずれも fingers を同時クリア
- **ツールチップで次の状態を告げる**(AC-10, ux-designer must)。ヒット領域の SVG `<title>`:
  - 押弦中: 「クリックで開放 ○(押さえずに鳴らす)」
  - ○: 「○ = 開放弦。クリックでミュート ×(鳴らさない)」
  - ×: 「× = ミュート。クリックで開放 ○」
- **ホバープレビュー**: 押弦中の弦の開放域ホバーで薄い ○(`.open-mute-preview`: 通常 `opacity: 0` + `pointer-events: none`、`.chord-head:hover` で `opacity: 0.4`。デフォルト 0 なので画像出力に混入しない)
- **運指セレクト行**: 各セレクトの上に可視の弦番号ラベル(`6弦 5弦 … 1弦`)を付ける(ux-designer 指摘: 横型化で図との空間対応が消えるため)
- `aria-label`: `コード {name || '未設定'}(左利き表示)` — 現行のフォールバック維持

## CSS 変更(App.css)

- **共有化**: `.fret-number` / `.head-cue` / `.nut` の指板図ルールをセレクタ併記で `.chord-svg` にも適用(`.fretboard-svg .fret-number, .chord-svg .fret-number { … }` 形式)。コピペで乖離させない(ui-designer 指摘)。ナットの `stroke-width: 4` は JSX 属性から CSS へ移す
- **廃止**: `.chord-svg .base-fret-label`
- **新設**: `.open-mute-preview`、運指行ラベル(`.finger-cell` / `.finger-string-label`)
- **流用**: `.chord-name`、`.chord-svg .fret-line` / `.string-line`、`.hit-area`、`.chord-dot`、`.barre`、`.open-mute`

## テスト戦略

- **layout**(`chordLayout.test.ts`):
  - `baseFret = 1`: fret 0 線がナット位置(40)、`markerX(1)` がフレット間中央、開放域(24)がその外側
  - `baseFret = 5`: フレット番号 5〜9 の位置、開放域が baseFret 非依存で 24(AC-4 の座標的根拠)
  - 反転: すべての X が `width - 通常X`、`nameX` は不変
  - `height = boardHeight + CHORD_NAME_H` の一本化(off-by-CHORD_NAME_H の回帰防止)
- **model**(`migrate.test.ts` 追記): `mirrored: true` 付き ChordBlock を含む v1 ドキュメントが通る
- **手動確認**: AC-1〜10(横型描画、向き切替、ナット有無、開放直接選択、○↔×、バレー反転、既存データ、再生、● 解除、ホバープレビュー+ツールチップ)

## 受け入れ基準との対応

| AC | 検証方法 |
|---|---|
| AC-1 | 手動確認(横型・各要素) |
| AC-2 | layout テスト(対称性)+ 手動確認 |
| AC-3 | layout テスト(fret 0 線)+ 手動確認 |
| AC-4 | layout テスト(開放域が baseFret 非依存)+ 手動確認 |
| AC-5 | 手動確認 |
| AC-6 | 手動確認(バレー帯の反転位置・カプセル形) |
| AC-7 | migrate テスト + 手動確認 |
| AC-8 | 手動確認(反転状態で ▶ 鳴らす) |
| AC-9 | 手動確認(● 再クリック → ×、fingers クリア) |
| AC-10 | 手動確認(プレビュー + ツールチップ文言) |
