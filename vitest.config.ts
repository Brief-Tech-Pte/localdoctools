import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const r = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      app: r('./'),
      src: r('./src'),
      components: r('./src/components'),
      layouts: r('./src/layouts'),
      pages: r('./src/pages'),
      assets: r('./src/assets'),
      boot: r('./src/boot'),
      router: r('./src/router'),
      tools: r('./src/tools'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
})
