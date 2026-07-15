---
name: verify
description: Fretpad の変更を実アプリ(Vite dev サーバー + headless Chrome)で end-to-end に検証する手順
---

# Fretpad の実機検証手順

## 起動

```bash
npm run dev > /tmp/vite.log 2>&1 &   # ポートは 5173 が既定だが埋まっていると 5174, 5175… にずれる。ログで確認すること
```

## 駆動

Claude in Chrome 拡張が未接続の環境でも、システム Chrome + playwright-core(ブラウザ DL 不要)で駆動できる:

```bash
cd <scratchpad> && npm i playwright-core
```

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
```

## 知っておくと速いセレクタ・挙動

- ノートエディタ: `.doc-title`(タイトル入力)、`.block-list > *`(ブロック数)、`.add-block-menu`(追加メニュー)
- headless の新規プロファイルでは IndexedDB が空 → 初回ロードで新規ノートが自動で開く(一覧画面は出ない)
- 指板図: 自動マーカー `.marker-auto`、手動マーカー `.marker`。コード表: `.barre`、`.chord-dot`、`.open-mute`
- グローバル undo/redo(Cmd+Z / Cmd+Shift+Z)は **input/textarea フォーカス中はネイティブ動作を優先**して発火しない。undo を試すときは先に `body` をクリックしてフォーカスを外すこと
- スクリーンショットは `locator.screenshot()` / `page.screenshot({ fullPage: true })` で取得し、Read で目視確認する
