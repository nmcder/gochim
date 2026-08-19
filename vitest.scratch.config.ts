import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/core/test/_scratch_sigan4.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})
