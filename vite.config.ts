/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages (プロジェクトページ) は /<リポジトリ名>/ 配下で配信されるため
  // ビルド時のみ base を付ける。dev サーバーは従来どおり / のまま
  base: command === 'build' ? '/jupitab/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
