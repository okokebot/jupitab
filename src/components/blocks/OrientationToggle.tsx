/** 「向き: 右利き | 左利き」セグメント。指板図・コード表で共通(spec 004)。
 * 選択中の側を再クリックしても onChange は呼ばない(無駄な undo 履歴を作らない)。
 * OFF(右利き)時に mirrored を undefined に戻す規約は呼び出し側の責務。 */
export function OrientationToggle({
  mirrored,
  onChange,
}: {
  mirrored: boolean
  onChange: (mirrored: boolean) => void
}) {
  return (
    <span className="orientation-toggle">
      向き
      <button
        type="button"
        className={`btn btn-sm ${!mirrored ? 'btn-active' : ''}`}
        aria-pressed={!mirrored}
        title="一般的な図の向き(ヘッドが左)"
        onClick={() => {
          if (mirrored) onChange(false)
        }}
      >
        右利き
      </button>
      <button
        type="button"
        className={`btn btn-sm ${mirrored ? 'btn-active' : ''}`}
        aria-pressed={mirrored}
        title="左右反転して表示します(ヘッドが右)。弦の並びは変わりません"
        onClick={() => {
          if (!mirrored) onChange(true)
        }}
      >
        左利き
      </button>
    </span>
  )
}
