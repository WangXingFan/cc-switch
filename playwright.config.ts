import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置文件
 * 使用 D 盘的 Chrome 浏览器进行测试
 */
export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 测试匹配模式
  testMatch: '**/*.spec.ts',

  // 全局超时时间（30秒）
  timeout: 30 * 1000,

  // 断言超时时间（5秒）
  expect: {
    timeout: 5000,
  },

  // 失败时重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行执行的 worker 数量
  workers: process.env.CI ? 1 : undefined,

  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础 URL（如果需要测试 Web 应用）
    // baseURL: 'http://localhost:3000',

    // 操作超时时间
    actionTimeout: 10 * 1000,

    // 失败时截图
    screenshot: 'only-on-failure',

    // 失败时录制视频
    video: 'retain-on-failure',

    // 追踪配置（失败时保留）
    trace: 'retain-on-failure',
  },

  // 项目配置 - 使用 D 盘的 Chrome
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 指定使用 D 盘的 Chrome 浏览器
        channel: undefined, // 禁用自动检测
        launchOptions: {
          executablePath: 'D:\\Software\\Google Chrome\\App\\chrome.exe',
          // 可选：Chrome 启动参数
          args: [
            '--disable-dev-shm-usage', // 减少共享内存使用
            '--no-sandbox', // 禁用沙箱（如果需要）
          ],
        },
      },
    },
  ],

  // Web Server 配置（如果需要启动开发服务器）
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
