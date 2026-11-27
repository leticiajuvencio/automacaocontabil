import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // os testes da API usam o mesmo banco de teste, então rodam um de cada vez
    fileParallelism: false,
  },
})
