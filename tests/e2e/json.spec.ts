import { test, expect } from '@playwright/test';

/**
 * json.spec：JSON 美化 / 压缩 / 错误高亮 / 快捷键 / 语法高亮
 *
 * 选择器策略：role/text > testid > impl id
 *   #json-input   textarea
 *   #json-output  <pre>
 *   #btn-format   美化
 *   #btn-minify   压缩
 *   #err-banner   错误条
 *   语法高亮 token: .tk-key
 */

function input(page: import('@playwright/test').Page) {
  return page
    .getByRole('textbox', { name: /输入|input/i })
    .or(page.getByTestId('tn-input-textarea'))
    .or(page.locator('#json-input'));
}
function output(page: import('@playwright/test').Page) {
  return page.getByTestId('tn-output').or(page.locator('#json-output'));
}

test.describe('JSON (/json/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/json/');
  });

  test('压缩 JSON → 美化后输出包含换行', async ({ page }) => {
    await input(page).first().fill('{"a":1,"b":[2,3]}');
    const beautify = page
      .getByRole('button', { name: /美化|format/i })
      .or(page.locator('#btn-format'));
    await beautify.first().click();
    const text = (await output(page).first().textContent()) ?? '';
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  test('有效 JSON → 压缩后输出无多余空格', async ({ page }) => {
    await input(page).first().fill('{\n  "a": 1,\n  "b": [2, 3]\n}');
    const minify = page
      .getByRole('button', { name: /压缩|minify/i })
      .or(page.locator('#btn-minify'));
    await minify.first().click();
    const text = ((await output(page).first().textContent()) ?? '').trim();
    expect(text).toBe('{"a":1,"b":[2,3]}');
  });

  test('无效 JSON `{a:1}` → 错误条出现，提示行/列/位置信息', async ({ page }) => {
    await input(page).first().fill('{a:1}');
    const beautify = page
      .getByRole('button', { name: /美化|format/i })
      .or(page.locator('#btn-format'));
    await beautify.first().click();
    const err = page
      .getByTestId('tn-error-bar')
      .or(page.locator('#err-banner'))
      .or(page.locator('[role="alert"], .err-banner, .error'));
    await expect(err.first()).toBeVisible({ timeout: 5000 });
    const errText = ((await err.first().textContent()) ?? '').toLowerCase();
    expect(errText).toMatch(/行|列|position|line|column/);
  });

  test('Cmd+B (ControlOrMeta+B) 触发美化', async ({ page }) => {
    await input(page).first().fill('{"a":1,"b":2}');
    await input(page).first().focus();
    await page.keyboard.press('ControlOrMeta+KeyB');
    const text = (await output(page).first().textContent()) ?? '';
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  test('美化后输出包含 .tk-key 语法高亮节点', async ({ page }) => {
    await input(page).first().fill('{"a":1,"b":"x"}');
    const beautify = page
      .getByRole('button', { name: /美化|format/i })
      .or(page.locator('#btn-format'));
    await beautify.first().click();
    const keys = page.locator('.tk-key');
    await expect(keys.first()).toBeVisible({ timeout: 5000 });
    expect(await keys.count()).toBeGreaterThanOrEqual(1);
  });
});
