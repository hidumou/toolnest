import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置（Phase 2B）：
 * - testDir: tests/e2e
 * - 启动一个 `vite preview` 子进程，端口 4173
 * - chromium 项目；剪贴板读写权限默认开启（用于 timestamp / base64 等复制断言）
 */
export default defineConfig({
  testDir: './tests/e2e',
  // smoke.spec.ts 仅在 `pnpm test:smoke`（设置 SMOKE=1）显式调用时执行，
  // 不进入默认 `pnpm test` 集合。
  // 注意：Playwright 的 testIgnore 即使对显式传入的文件参数也生效，
  // 所以这里用环境变量做条件开关。
  testIgnore: process.env.SMOKE ? undefined : '**/smoke.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
