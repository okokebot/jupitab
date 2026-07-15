#!/bin/sh
# PostToolUse フック: Edit/Write された TS ファイルを oxlint で即時チェックする。
# 違反があれば exit 2 で Claude にフィードバックし、その場で修正させる(Kiro の hooks パターン)。
input=$(cat)
file=$(printf '%s' "$input" | node -e "
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    console.log(j.tool_input?.file_path ?? '');
  } catch {}
});
")

case "$file" in
  *.ts|*.tsx)
    [ -f "$file" ] || exit 0
    cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
    out=$(npx oxlint "$file" 2>&1)
    if [ $? -ne 0 ]; then
      printf 'oxlint が編集ファイルで違反を検出しました。修正してください:\n%s\n' "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
