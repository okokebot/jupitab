# Jupitab

ギタリストのための学習ノートアプリ。「弾く手を止めて、書いて、分析する」ための道具です。

Notion 風のドキュメントに、テキスト(Markdown)・TAB 譜・指板図・コード表のブロックを混在させて書けます。データはブラウザの IndexedDB にローカル保存され、JSON で書き出し/読み込みできます。

プロダクトビジョンとロードマップは [docs/vision.md](docs/vision.md) を参照。

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # モデル層・レイアウト層のユニットテスト
npm run build    # 型チェック + プロダクションビルド
npm run lint     # oxlint
```

## アーキテクチャ

- `src/model/` — データモデルと音楽理論の純粋 TS 層(React 非依存)。音価は分数(`fraction.ts`)で厳密計算。音高は「弦 + フレット + チューニング」から導出
- `src/layout/` — TAB 譜のジオメトリ計算(純関数)。将来の画像出力でも再利用する
- `src/store/` — zustand + zundo(undo/redo)、IndexedDB 永続化
- `src/components/` — React コンポーネント。描画は全て SVG

## TAB エディタのキー操作

譜面をクリックしてカーソルを置き、数字キーでフレット入力。`Space` で進む、`+`/`-` で音価、`.` で付点、`t` で3連符、`s` スタッカート、`h`/`p`/`/` でハンマリング/プリング/スライドなど。ツールバーの「⌨ キー操作」で一覧が見られます。
