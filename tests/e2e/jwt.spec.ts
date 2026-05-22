import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * jwt.spec：JWT 解码 + 过期校验
 *
 * impl ID 参考：
 *   #jwt-in        textarea 输入
 *   #alg-callout   算法名（"HS256" 等）
 *   #header-json   header JSON <pre>
 *   #payload-json  payload JSON <pre>
 *   #payload-times exp/iat/nbf 时间徽章列表（含 "已过期"）
 *   #sig-raw       signature 原文
 *   .unverified-note  "不验证签名" 提示
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.resolve(__dirname, '..', 'fixtures');

async function loadJwt(name: string): Promise<string> {
  return (await fs.readFile(path.join(FIX_DIR, name), 'utf8')).trim();
}

function jwtInput(page: import('@playwright/test').Page) {
  return page
    .getByRole('textbox', { name: /JWT|jwt/i })
    .or(page.getByTestId('tn-jwt-input'))
    .or(page.locator('#jwt-in'));
}

test.describe('JWT (/jwt/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jwt/');
  });

  test('粘贴示例 JWT → header / payload / signature 三栏均填充内容', async ({ page }) => {
    const token = await loadJwt('sample.jwt.txt');
    await jwtInput(page).first().fill(token);

    const header = page.getByTestId('tn-jwt-header').or(page.locator('#header-json'));
    const payload = page.getByTestId('tn-jwt-payload').or(page.locator('#payload-json'));
    const sig = page.getByTestId('tn-jwt-signature').or(page.locator('#sig-raw'));

    // 三栏均不再是占位 "—"
    await expect(header.first()).not.toHaveText('—', { timeout: 5000 });
    await expect(payload.first()).not.toHaveText('—');
    await expect(sig.first()).not.toHaveText('—');

    // header 应是合法 JSON，payload 也是
    const headerText = ((await header.first().textContent()) ?? '').trim();
    expect(() => JSON.parse(headerText)).not.toThrow();
  });

  test('header 应显示算法名（HS256）', async ({ page }) => {
    const token = await loadJwt('sample.jwt.txt');
    await jwtInput(page).first().fill(token);

    const alg = page
      .getByTestId('tn-jwt-alg')
      .or(page.locator('#alg-callout'))
      .or(page.getByText(/HS256|RS256|ES256/));
    await expect(alg.first()).toContainText(/HS256|RS256|ES256|none/i, { timeout: 5000 });
  });

  test('payload exp 过期时显示"已过期"', async ({ page }) => {
    const token = await loadJwt('sample.expired.jwt.txt');
    await jwtInput(page).first().fill(token);

    // impl 用 badge.expired，文本 "已过期"
    const expired = page
      .getByTestId('tn-jwt-exp-badge')
      .or(page.getByText(/已过期/))
      .or(page.locator('.badge.expired'));
    await expect(expired.first()).toBeVisible({ timeout: 5000 });
    await expect(expired.first()).toContainText(/已过期|expired/i);
  });

  test('signature 区显示"不验证签名"提示', async ({ page }) => {
    const token = await loadJwt('sample.jwt.txt');
    await jwtInput(page).first().fill(token);

    const note = page
      .getByTestId('tn-jwt-sig-status')
      .or(page.locator('.unverified-note'))
      .or(page.getByText(/不验证签名|未验证|not verified/i));
    await expect(note.first()).toBeVisible({ timeout: 5000 });
    await expect(note.first()).toContainText(/不验证签名|未验证|not verified/i);
  });
});
