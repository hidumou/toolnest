import { test, expect } from '@playwright/test';

/**
 * url.spec：URL 编解码 + 批量 + 解析
 *
 * impl 设计：单个 #u-in / #u-out textarea，三个独立按钮：
 *   #u-encode      data-testid="tn-encode-btn"      encodeURIComponent
 *   #u-encode-uri  data-testid="tn-encode-uri-btn"  encodeURI
 *   #u-decode      data-testid="tn-decode-btn"      decode
 *   #batch-seg     data-testid="tn-batch-toggle"    单行/批量（子按钮 data-b="single|batch"）
 *   #parse-in      data-testid="tn-url-parse-input"
 *   #qtable        data-testid="tn-url-parse-table" 解析结果（默认 hidden）
 */

function input(page: import('@playwright/test').Page) {
  return page.getByTestId('tn-input-textarea').or(page.locator('#u-in'));
}
function output(page: import('@playwright/test').Page) {
  return page.getByTestId('tn-output').or(page.locator('#u-out'));
}
async function readOut(page: import('@playwright/test').Page): Promise<string> {
  const v = await output(page).first().inputValue().catch(() => null);
  if (v !== null) return v;
  return ((await output(page).first().textContent()) ?? '').trim();
}

test.describe('URL (/url/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/url/');
  });

  test('encodeURIComponent: "a b/c" → "a%20b%2Fc"', async ({ page }) => {
    await input(page).first().fill('a b/c');
    const enc = page.getByTestId('tn-encode-btn').or(page.locator('#u-encode'));
    await enc.first().click();
    expect(await readOut(page)).toBe('a%20b%2Fc');
  });

  test('encodeURI: "a b/c" → "a%20b/c"', async ({ page }) => {
    await input(page).first().fill('a b/c');
    const encUri = page.getByTestId('tn-encode-uri-btn').or(page.locator('#u-encode-uri'));
    await encUri.first().click();
    expect(await readOut(page)).toBe('a%20b/c');
  });

  test('解码: %E4%B8%AD → 中', async ({ page }) => {
    await input(page).first().fill('%E4%B8%AD');
    const dec = page.getByTestId('tn-decode-btn').or(page.locator('#u-decode'));
    await dec.first().click();
    expect(await readOut(page)).toBe('中');
  });

  test('批量模式：3 行分别编码，输出 3 行', async ({ page }) => {
    // 切换到批量
    const batchBtn = page.locator('#batch-seg [data-b="batch"]');
    await batchBtn.click();

    await input(page).first().fill('a b\nc/d\ne f');
    const enc = page.getByTestId('tn-encode-btn').or(page.locator('#u-encode'));
    await enc.first().click();

    const out = await readOut(page);
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines).toEqual(['a%20b', 'c%2Fd', 'e%20f']);
  });

  test('URL 解析：https://example.com/path?a=1&b=2 → 表格行包含 a / 1 / b / 2', async ({ page }) => {
    const parseIn = page.getByTestId('tn-url-parse-input').or(page.locator('#parse-in'));
    await parseIn.first().fill('https://example.com/path?a=1&b=2');

    const table = page.getByTestId('tn-url-parse-table').or(page.locator('#qtable'));
    await expect(table.first()).toBeVisible({ timeout: 5000 });
    await expect(table.first()).toContainText('a');
    await expect(table.first()).toContainText('1');
    await expect(table.first()).toContainText('b');
    await expect(table.first()).toContainText('2');
  });
});
