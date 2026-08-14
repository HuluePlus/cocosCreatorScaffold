import { defineConfig } from 'vitest/config';

/** 纯 TypeScript framework 测试配置，不依赖 Creator 编辑器运行时。 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
