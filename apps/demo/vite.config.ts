import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // 데모는 코어의 소스를 직접 본다. 빌드 없이 고치자마자 반영되고,
      // 배포 빌드에서는 어차피 같은 코드가 번들된다.
      '@gochim/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
