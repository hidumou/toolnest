import { test, expect } from '@playwright/test';

/**
 * home.spec：首页是 6 张工具卡片的入口。
 * 这是 sync gate —— 如果这里跑不过，路由/构建就有大问题，应立即上报 team-lead。
 */

const TOOL_LINKS: ReadonlyArray<{ href: string; title: string }> = [
  { href: '/timestamp/', title: 'Unix 时间戳' },
  { href: '/watermark/', title: '去水印' },
  { href: '/json/', title: 'JSON' },
  { href: '/base64/', title: 'Base64' },
  { href: '/url/', title: 'URL' },
  { href: '/jwt/', title: 'JWT' },
];

test.describe('Home (/)', () => {
  test('页面加载且 <title> 含 ToolNest', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ToolNest/);
  });

  test('展示 6 张工具卡片，链接覆盖全部 6 路由', async ({ page }) => {
    await page.goto('/');
    for (const { href } of TOOL_LINKS) {
      const card = page.locator(`a.card[href="${href}"], a[href="${href}"]`).first();
      await expect(card, `expected to find card for ${href}`).toBeVisible();
    }
  });

  test('点击 timestamp 卡片导航到 /timestamp/，<title> 含工具名', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/timestamp/"]').first().click();
    await expect(page).toHaveURL(/\/timestamp\/?$/);
    await expect(page).toHaveTitle(/时间戳|Unix/);
  });

  test('点击 jwt 卡片导航到 /jwt/，<title> 含 JWT', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/jwt/"]').first().click();
    await expect(page).toHaveURL(/\/jwt\/?$/);
    await expect(page).toHaveTitle(/JWT/);
  });
});
