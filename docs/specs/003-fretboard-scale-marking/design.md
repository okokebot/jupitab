# 指板図のスケール自動マーキングと度数表示 — 技術設計

対応 spec: [spec.md](spec.md)

## 方針概要

導出表示方式。model 層に純関数 `scalePositions()` を追加し、`FretboardBlockView` が描画時に keyContext から構成音の位置(弦・フレット・ルート判定)を計算して SVG に重ねる。保存形式には既存の `FretboardBlock.keyContext` に加え、省略可能フィールド `labelMode` のみを追加する([ADR-0001](../../adr/0001-additive-optional-fields-keep-schema-version.md) に従い schemaVersion は 1 のまま)。

採らなかった案:
- **構成音を `markers` に一括書き込み** — スケール変更に追従せず譜面が古くなる。spec 要確認 1 で不採用
- **音楽計算を View 内に書く** — レイヤー方向違反。位置導出は theory.ts の純関数に置き、View は座標変換と描画だけ行う

実装順の前提: spec 002(左利き反転)が並行実装中で、`src/layout/fretboardLayout.ts`(`fretboardGeometry()`: markerX / stringY / hitRect / flip)が既に存在する。**自動マーカーの座標は必ず `fretboardGeometry` を通す**(独自の座標計算を持たない)ことで、反転表示時の鏡像(spec の「関連 spec との相互作用」)が自動的に満たされる。`FretboardBlockView.tsx` は 002 が改修中のため、本 spec の UI タスク(T-3〜T-6)は 002 の View 改修が落ち着いてから着手する(同一ファイルの同時編集を避ける)。

## 影響レイヤー

| レイヤー | 変更内容 | 新規/変更ファイル |
|---|---|---|
| model | `ScalePosition` 型と `scalePositions(tuning, fretStart, fretEnd, key)` 純関数を追加。`FretboardBlock` に `labelMode?: 'degree' \| 'name' \| 'none'` を追加(欠落 = 'degree' 扱い) | `theory.ts` / `types.ts` / `theory.test.ts` |
| layout | 変更なし | — |
| store | 変更なし(既存 `updateBlock` を使う) | — |
| components | 設定 UI(ルート/スケール select・ラベル切替・♯♭ トグル・ヒント)、自動マーカーの SVG 描画、マーカーエディタの度数併記 | `FretboardBlockView.tsx` / `App.css` |

### `scalePositions` の仕様

```
scalePositions(tuning: number[], fretStart: number, fretEnd: number, key: KeyContext): ScalePosition[]
// ScalePosition = { string: number; fret: number; pc: number; isRoot: boolean }
```

- 対象フレット範囲は**表示実態に合わせる**: `fretStart + 1 〜 fretEnd`、加えて `fretStart === 0` のとき開放弦(fret 0)。これは既存の `markerX` / クリック領域の実装(fret === fretStart の位置は描画範囲外)と一致させるため(AC-12)
- 音高判定は `pitchFromTab(tuning, string, fret)` → `pitchClass` → `scalePitchClasses(key).has(pc)`(音高は保存せず毎回導出 — 不変条件)
- `isRoot` は `pc === key.tonic`
- 弦番号は 1 始まり(index 0 = 1弦の tuning 規約に従う)

## データモデル変更

- **保存形式の変更**: あり(省略可能フィールド `FretboardBlock.labelMode` の追加のみ)
- [ADR-0001](../../adr/0001-additive-optional-fields-keep-schema-version.md) に従い **schemaVersion は 1 のまま、migrate.ts 変更なし**。欠落時は `'degree'` として扱い、従来データの見た目は keyContext 未設定なら完全に不変(欠落 = 従来挙動を型コメントに明記する)
- `keyContext` は既存フィールド(types.ts:131)で保存済み。JSON エクスポート/インポートは自動的に両フィールドを含む

## 不変条件チェックリスト(CLAUDE.md)

- [x] 音高を保存しない — `scalePositions` は表示のたびに `pitchFromTab` で導出。保存するのは keyContext(tonic のピッチクラス)と labelMode のみ
- [x] リズム計算は分数演算 — 本機能はリズムに触れない
- [x] 永続化データは `migrate.ts` を通る — 読込経路は変更なし。フィールド追加は ADR-0001 の範囲内
- [x] 拍子は `effectiveTimeSignature()` 経由 — 触れない
- [x] undo 粒度 = store 更新 1 回 — ルート変更・スケール変更・ラベル切替・♯♭ 切替はいずれも `updateBlock` 1 回(AC-15)
- [x] 弦番号規約 — `ScalePosition.string` は FretMarker と同じ 1 始まり。tuning は index 0 = 1弦
- [x] keymap.ts 同期 — キーバインドは追加しない(spec 非スコープ)

## UI 設計

ツールバーは **2 クラスタに分ける**(ux-designer 指摘: 既存の「向き」トグルやマーカーエディタと合わせると 1 行ではコントロール過多)。①ブロック属性(既存: ラベル・フレット範囲・向き)/ ②理論レンズ(新設: ルート・スケール・表示・♯/♭)を視覚的に分離する(2 行目または区切り付きグループ。UI テキストは日本語):

```
[ラベル ______] [フレット 0〜12] [向き 右|左]
ルート:[A ▼] スケール:[マイナーペンタトニック ▼] 表示:[度数|音名|点のみ] [♯/♭]
```

- **ルート select**: 12 音。異名同音は併記(`C# / D♭` の形式)。value はピッチクラス数値。keyContext 未設定時の表示値は A(9)— 最初の一歩の定番(A マイナーペンタ)に合わせ、スケール選択 1 操作で図が出るようにする
- **スケール select**: 先頭に「なし(自動表示オフ)」。以降は日本語慣用名で `<optgroup>` グルーピング(見出しは学習経路の言葉にする):
  - まずはこれ: マイナーペンタトニック / メジャーペンタトニック
  - 次のステップ: メジャー(長調) / ナチュラルマイナー(短調) / ブルース
  - 慣れてきたら: ハーモニックマイナー / メロディックマイナー / ドリアン / ミクソリディアン
- **設定の流れ**: スケールを「なし」以外にした時点で `keyContext` を `updateBlock` で保存。**既存フィールドを保持するため必ずスプレッドで更新**(`{ ...b.keyContext, tonic, scale }` — `preferFlats` をリセットしない)。「なし」で `keyContext: undefined`(AC-5)。ルートだけ触っても keyContext 未設定なら何も起きない(ローカル state で選択値のみ保持)
- **ヒント(AC-9)**: keyContext 未設定のとき、ツールバー下に 1 行「**スケールを選ぶと、その音が指板に自動表示されます(ルートは A から変更できます)**」— 必須操作が 1 つであることが伝わる文言。設定されたら消える
- **ラベル切替(AC-3, 11)**: 3 ボタンのセグメント(既存 `STYLE_LABELS` と同じ btn パターン)。keyContext 設定中のみ表示。クリックで `labelMode` を保存。「なし」の UI 表記は **「点のみ」**(スケール select の「なし(自動表示オフ)」との意味衝突を避ける。内部値は `'none'`)。♯/♭ トグルは **スケール設定中は常に表示**し、`keyContext.preferFlats` を反転する(当初は「音名」モード限定としたが、preferFlats はツールチップとマーカーエディタの音名表示にも常時作用するため、「度数」「点のみ」モードで切替手段が到達不能になる — code-review 指摘で変更)。既にアクティブな表示ボタンの再クリックは store 更新しない(無変化の undo エントリを積まない)
- **自動マーカー描画**: SVG 内の描画順を「格子 → クリック領域 → **自動マーカー** → 手動マーカー」とし、手動が常に前面(AC-6)。自動マーカーのグループは `pointer-events: none` にして、クリックは既存のヒット領域に落とす(→ 従来どおり手動マーカー新規作成、AC-7)
  - スタイル: `marker-auto` は **破線ストローク + 手動より小さい半径**で区別する。「輪郭のみ実線」は既存の手動「弱」(`marker-muted` が fill:none・細線)と視覚言語が衝突するため使わない(ux-designer must)。ルートは `marker-auto-root`(二重円。塗りは手動との区別を弱めるので不採用)とし、選択リング `marker-selected` と紛れない見た目を実装時に確認する。具体的な色・線幅は既存パレットに合わせる(細部は ui-designer 案件)
  - ホバーツールチップ「音名(度数)」(例: `C(♭3)`)は、**スケール構成音位置のヒット領域 `rect` に `<title>` を付けて**実現する。自動マーカー本体は `pointer-events: none` のためホバーを受けられない(spec-reviewer must)。ラベル「点のみ」でも度数を調べる手段が残る
- **ラベルテキスト**: 度数 = `degreeInKey(pc, key)`、音名 = `pitchClassName(pc, key.preferFlats)`
- **空ラベル手動マーカーの導出表示(AC-7 後半)**: 手動マーカー描画時、`label` が空 AND keyContext 設定中 AND その位置がスケール構成音なら、導出ラベルを表示する(スタイルは手動マーカーのまま)
- **マーカーエディタの度数併記(AC-10)**: 既存の `tab-status`(音名表示)を keyContext 設定中は「C3 ・ 度数 ♭3」の形式に拡張
- **用語衝突の解消(spec 要確認 5)**: 手動マーカースタイルのボタン表記「ルート」を **「強調」** に変更する(`MarkerStyle` の値 `'root'` は保存データなので変えない。表示ラベルのみ)。自動表示側の「ルート」と意味が衝突しなくなる
- **002(左利き反転)との相互作用**: 自動マーカーの座標は 002 が新設した `fretboardGeometry()`(`markerX` / `stringY` / `hitRect`)を通す。`flip` がジオメトリ側で一元処理されるため鏡像は自動的に成立する。独自の座標計算を持たないこと
- **将来メモ(本 spec ではやらない)**: 自動マーカーを「調べるため」にクリックすると手動マーカーが生まれ、スケール解除後に無ラベルの点として残る(AC-7 で承認済みの挙動)。非破壊で調べる手段はホバーのみで発見しづらいため、修飾キー+クリック等の調査操作は柱 A(ヘルプ整備)の際の改善候補とする(ux-designer idea)

## テスト戦略

- **model(主戦場)**: `theory.test.ts` に `scalePositions` のテストを追加
  - A マイナーペンタ・標準チューニング・0〜12F: 既知の位置(6弦5F = A がルート、1弦開放 E は構成音・非ルート、2弦1F C は構成音、6弦1F F は非構成音)を検証
  - `fretStart = 5`(5〜12F 表示): 開放弦と 5F 以下が含まれないこと(AC-12)
  - 変則チューニング(ドロップ D): 6弦の構成音位置が標準とずれること(AC-13)
  - ルート判定: 全 `isRoot` 位置のピッチクラスが tonic に一致すること
- **手動確認**(`npm run dev`): 下記対応表の AC-2, 5〜11, 14, 15
- 永続化(AC-14)は JSON エクスポート → 再インポートと、リロード(IndexedDB)の両方で確認

## 受け入れ基準との対応

| AC | 検証方法 |
|---|---|
| AC-1 | テスト(scalePositions の網羅性)+ 手動(表示確認) |
| AC-2 | 手動: ルート/スケール変更で即時更新 |
| AC-3 | テスト(degreeInKey/pitchClassName は既存テスト)+ 手動: 3 モード切替と ♯/♭ |
| AC-4 | テスト(isRoot)+ 手動(スタイル差の目視) |
| AC-5 | 手動: 「なし」選択で自動マーカー全消滅・手動マーカー残存 |
| AC-6 | 手動: 重なり位置で手動が前面、クリックで手動の編集 |
| AC-7 | 手動: 自動マーカー位置クリック → 手動マーカー生成 + 導出ラベル継続表示 |
| AC-8 | 手動: 目視で一目区別(ui 細部は実装時判断) |
| AC-9 | 手動: 新規指板図ブロックでヒント文言が見える |
| AC-10 | 手動: select の日本語名、エディタの度数併記 |
| AC-11 | 手動: 1 クリック切替・選択状態維持・Tab キー到達 |
| AC-12 | テスト(fretStart 境界)+ 手動 |
| AC-13 | テスト(変則チューニング) |
| AC-14 | 手動: リロード + エクスポート/インポートで復元。labelMode 欠落データが度数表示になる |
| AC-15 | 手動: 各操作 1 回 → undo 1 回で巻き戻る |
