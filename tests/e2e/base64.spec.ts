import { test, expect } from '@playwright/test';

/**
 * base64.spec：Base64 编解码（UTF-8 / URL-safe）
 *
 * impl ID 参考：
 *   #t-in / #t-out 文本输入/输出 textarea
 *   #t-encode / #t-decode 按钮
 *   #urlsafe       URL-safe checkbox
 */

function input(page: import('@playwright/test').Page) {
  return page
    .getByTestId('tn-input-textarea')
    .or(page.locator('#t-in'))
    .or(page.getByRole('textbox').first());
}
function output(page: import('@playwright/test').Page) {
  return page.getByTestId('tn-output').or(page.locator('#t-out'));
}
async function readOutput(page: import('@playwright/test').Page): Promise<string> {
  const v = await output(page).first().inputValue().catch(() => null);
  if (v !== null) return v;
  return ((await output(page).first().textContent()) ?? '').trim();
}

test.describe('Base64 (/base64/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/base64/');
  });

  test('文本编码：Hello → SGVsbG8=', async ({ page }) => {
    await input(page).first().fill('Hello');
    const enc = page
      .getByRole('button', { name: /^编码$|encode/i })
      .or(page.locator('#t-encode'));
    await enc.first().click();
    expect(await readOutput(page)).toBe('SGVsbG8=');
  });

  test('文本解码：SGVsbG8= → Hello', async ({ page }) => {
    await input(page).first().fill('SGVsbG8=');
    const dec = page
      .getByRole('button', { name: /^解码$|decode/i })
      .or(page.locator('#t-decode'));
    await dec.first().click();
    expect(await readOutput(page)).toBe('Hello');
  });

  test('UTF-8 往返：你好 → 编码 → 解码 === 你好', async ({ page }) => {
    await input(page).first().fill('你好');
    const enc = page.getByRole('button', { name: /^编码$|encode/i }).or(page.locator('#t-encode'));
    await enc.first().click();
    const encoded = await readOutput(page);
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded).not.toBe('你好');

    await input(page).first().fill(encoded);
    const dec = page.getByRole('button', { name: /^解码$|decode/i }).or(page.locator('#t-decode'));
    await dec.first().click();
    expect(await readOutput(page)).toBe('你好');
  });

  test('URL-safe 开启后：+→-、/→_', async ({ page }) => {
    // ">>>?" 标准 base64 = "Pj4+Pw==" 含 +
    await input(page).first().fill('>>>?');
    const enc = page.getByRole('button', { name: /^编码$|encode/i }).or(page.locator('#t-encode'));
    await enc.first().click();
    const before = await readOutput(page);
    expect(before).toContain('+');

    const toggle = page
      .getByRole('checkbox', { name: /URL-?safe/i })
      .or(page.getByLabel(/URL-?safe/i))
      .or(page.locator('#urlsafe'));
    await toggle.first().check();
    // 再编码
    await input(page).first().fill('>>>?');
    await enc.first().click();
    const after = await readOutput(page);
    expect(after).not.toContain('+');
    expect(after).toContain('-');
  });
});
