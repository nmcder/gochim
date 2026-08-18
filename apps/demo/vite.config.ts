import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // 데모는 코어의 소스를 직접 본다. 빌드 없이 고치자마자 반영되고,
      // 배포 빌드에서는 어차피 같은 코드가 번들된다.
      '@gochim/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@gochim/morph': fileURLToPath(new URL('../../packages/morph/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    // garu-ko는 WASM과 모델을 new URL(..., import.meta.url)로 찾는다.
    // 사전 번들에 들어가면 그 경로가 깨진다.
    exclude: ['garu-ko'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})
