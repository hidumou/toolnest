import { test, expect } from '@playwright/test';

/**
 * smoke.spec：部署后公网冒烟测试。
 *
 * 用法：
 *   TOOLNEST_PROD_URL=https://toolnest.pages.dev pnpm test:smoke
 *
 * 不设置 TOOLNEST_PROD_URL 时回落到 playwright.config.ts 的 baseURL
 * （http://localhost:4173），用于本地预演 smoke 流程。
 *
 * 本文件已在 playwright.config.ts 的 testIgnore 中排除，
 * 不会被默认的 `pnpm test` 收集，只在显式 `pnpm test:smoke` 时执行。
 */

const PROD_URL = process.env.TOOLNEST_PROD_URL?.replace(/\/+$/, '');

// 6 个工具页面（路径 + 期望出现在 <title> 中的关键词）
const TOOL_PAGES: Array<{ path: string; titleIncludes: string }> = [
  { path: '/timestamp/', titleIncludes: 'Unix 时间戳互转' },
  { path: '/watermark/', titleIncludes: '豆包图片去水印' },
  { path: '/json/', titleIncludes: 'JSON 格式化' },
  { path: '/base64/', titleIncludes: 'Base64 编解码' },
  { path: '/url/', titleIncludes: 'URL 编解码' },
  { path: '/jwt/', titleIncludes: 'JWT 解码' },
];

function urlFor(path: string): string {
  if (PROD_URL) return `${PROD_URL}${path}`;
  return path; // 让 Playwright 的 baseURL 接管
}

test.describe('Smoke (生产部署冒烟)', () => {
  test('根页面 200 且标题含 ToolNest', async ({ page }) => {
    const resp = await page.goto(urlFor('/'));
    expect(resp, 'page.goto returned null').not.toBeNull();
    expect(resp!.status(), `home not 200: ${resp!.status()}`).toBe(200);
    await expect(page).toHaveTitle(/ToolNest/);
  });

  for (const { path, titleIncludes } of TOOL_PAGES) {
    test(`工具页 ${path} 200 且标题含「${titleIncludes}」`, async ({ page }) => {
      const resp = await page.goto(urlFor(path));
      expect(resp, `page.goto returned null for ${path}`).not.toBeNull();
      expect(resp!.status(), `${path} not 200: ${resp!.status()}`).toBe(200);
      await expect(page).toHaveTitle(new RegExp(titleIncludes));
      // 同时确认页面包含 ToolNest 品牌词，证明拿到了正确的 HTML
      await expect(page).toHaveTitle(/ToolNest/);
    });
  }
});
