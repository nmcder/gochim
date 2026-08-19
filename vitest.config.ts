import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    // 밑줄로 시작하는 파일은 손으로 만든 임시 검증판이다.
    // 정식 스위트에 섞이면 통과 여부가 의미를 잃는다.
    exclude: ['**/node_modules/**', '**/dist/**', '**/_*.test.ts'],
    reporters: ['default'],
  },
})
