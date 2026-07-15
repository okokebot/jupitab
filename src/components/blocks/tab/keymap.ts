// TAB エディタのキーボードショートカット定義。
// 実際のハンドリングは TabBlockView。ここは一覧(ツールチップ・ヘルプ表示)の単一情報源。

export interface KeyBinding {
  key: string
  label: string
}

export const KEYMAP: KeyBinding[] = [
  { key: '0-9', label: 'フレット入力(素早く2桁で 10〜24)' },
  { key: '← →', label: 'イベント移動' },
  { key: '↑ ↓', label: '弦移動' },
  { key: 'Space', label: '次へ(末尾なら音価ぶんイベント追加)' },
  { key: 'Enter', label: 'カーソル直後にイベントを挿入' },
  { key: '|', label: '小節を追加' },
  { key: 'Backspace', label: '音を削除(空になると休符)' },
  { key: '⌘Backspace', label: 'イベントを削除' },
  { key: '+ / -', label: '音価を倍 / 半分' },
  { key: '.', label: '付点(0→1→2 を循環)' },
  { key: 't', label: '連符(3連→5連→6連→なし)' },
  { key: 'y', label: 'タイ' },
  { key: 'x', label: 'デッドノート' },
  { key: 's', label: 'スタッカート' },
  { key: 'a', label: 'アクセント' },
  { key: 'h / p', label: 'ハンマリング / プリング' },
  { key: '/', label: 'スライド(次の音へ)' },
  { key: 'i / u', label: 'スライドイン(/5)/ スライドアウト(5\\)' },
  { key: 'b', label: 'ベンド(¼ → ½ → full → リリース → なし)' },
  { key: 'B', label: 'プリベンドをトグル' },
  { key: 'v', label: 'ビブラート' },
  { key: 'm', label: 'パームミュート' },
  { key: 'g', label: 'ゴーストノート' },
  { key: 'l', label: 'レットリング' },
  { key: 'e', label: 'テヌート' },
  { key: 'w', label: 'マルカート' },
  { key: 'f', label: '運指(1→2→3→4→T→なし)' },
  { key: 'o', label: 'ハーモニクス(自然 ◇ → 人工 A.H. → なし)' },
  { key: 'c', label: 'コード名を入力(譜の上。空で削除)' },
  { key: 'n', label: 'メモを入力(譜の下。空で削除)' },
]
