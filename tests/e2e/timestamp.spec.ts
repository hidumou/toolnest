import { test, expect } from '@playwright/test';
import { readClipboard } from '../helpers';

/**
 * timestamp.spec：Unix 时间戳互转
 *
 * 选择器策略（按 Playwright 官方推荐：role/text > testid > impl id）：
 *   - 优先 getByRole / getByLabel / getByText / aria-label
 *   - 其次 getByTestId('tn-*')（forward-compatible 契约）
 *   - 最后 #id / [data-*] 匹配 tools-developer 当前实现
 *
 * 当前 impl ID 参考：
 *   #unix-input    Unix 输入
 *   #human-line    人类可读输出
 *   #unit-seg      ms/s 切换 (button[data-unit="s"|"ms"])
 *   #tz-select     时区 <select>（IANA 名称为 option value，含 UTC）
 *   #now-toggle    实时刷新按钮（"⏵ 实时刷新"）
 *   button[data-copy="unix"]  复制按钮
 */

test.describe('Timestamp (/timestamp/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/timestamp/');
  });

  function unixInput(page: import('@playwright/test').Page) {
    return page
      .getByRole('textbox', { name: /Unix|时间戳/i })
      .or(page.getByTestId('tn-unix-input'))
      .or(page.locator('#unix-input'));
  }
  function humanOut(page: import('@playwright/test').Page) {
    return page
      .getByTestId('tn-date-output')
      .or(page.locator('#human-line'));
  }

  test('输入 1700000000（秒），右侧应显示 2023 年的日期', async ({ page }) => {
    await unixInput(page).first().fill('1700000000');
    await expect(humanOut(page).first()).toContainText('2023', { timeout: 5000 });
  });

  test('切换单位 (s ↔ ms) 后日期解读改变', async ({ page }) => {
    await unixInput(page).first().fill('1700000000');
    const out = humanOut(page).first();
    const before = (await out.textContent()) ?? '';
    expect(before).toContain('2023');

    // 切到 ms：1700000000 ms ≈ 1970 年（毫秒解读）
    const msBtn = page
      .getByRole('button', { name: /毫秒|^ms$/i })
      .or(page.locator('#unit-seg [data-unit="ms"]'));
    await msBtn.first().click();

    await expect(out).not.toContainText('2023', { timeout: 5000 });
  });

  test('点击"复制"，剪贴板包含输出片段', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await unixInput(page).first().fill('1700000000');
    // 等 humanLine 更新
    await expect(humanOut(page).first()).toContainText('2023');

    const copyBtn = page
      .getByRole('button', { name: /^复制$/ })
      .or(page.locator('button[data-copy="unix"]'));
    await copyBtn.first().click();

    const cb = (await readClipboard(page)).trim();
    expect(cb.length).toBeGreaterThan(0);
    // 输入是 1700000000，复制按钮 data-copy="unix" → 剪贴板应含数字本体
    expect(cb).toContain('1700000000');
  });

  test('点击"实时刷新"两次（间隔 > 1 秒），Unix 显示发生变化', async ({ page }) => {
    // impl 用的是 #now-toggle 启动实时时钟，显示在 #now-clock；
    // 我们以 #now-clock 文本变化为判定标准。
    const toggle = page
      .getByRole('button', { name: /实时刷新|Now|现在/i })
      .or(page.getByTestId('tn-now-btn'))
      .or(page.locator('#now-toggle'));
    const clock = page.locator('#now-clock').or(page.getByTestId('tn-now-clock'));

    await toggle.first().click();
    // 等首次 tick
    await expect(clock.first()).not.toContainText('—', { timeout: 3000 });
    const v1 = ((await clock.first().textContent()) ?? '').trim();
    expect(v1.length).toBeGreaterThan(0);

    // 等到下一秒
    await expect
      .poll(async () => ((await clock.first().textContent()) ?? '').trim(), { timeout: 3000 })
      .not.toBe(v1);
  });

  test('切换时区，ISO 输出发生变化', async ({ page }) => {
    await unixInput(page).first().fill('1700000000');
    const iso = page.locator('#iso-out').or(page.getByTestId('tn-iso-out'));
    const before = ((await iso.first().textContent()) ?? '').trim();
    expect(before.length).toBeGreaterThan(0);

    const tz = page.getByTestId('tn-tz-select').or(page.locator('#tz-select'));

    // chromium 的 Intl.supportedValuesOf('timeZone') 用规范 IANA 名（"Etc/UTC" 不是 "UTC"），
    // 所以从 select 实际 options 里挑一个跟当前不同的 zone，更鲁棒
    const currentVal = await tz.first().inputValue();
    const altVal: string = await tz.first().evaluate((sel: HTMLSelectElement, currentValue: string) => {
      const candidates = ['Etc/UTC', 'UTC', 'Pacific/Honolulu', 'Pacific/Auckland', 'Europe/London', 'America/Los_Angeles', 'America/New_York'];
      for (const c of candidates) {
        const opt = Array.from(sel.options).find((o) => o.value === c);
        if (opt && opt.value !== currentValue) return opt.value;
      }
      // 退路：随便挑一个非当前的 option
      const other = Array.from(sel.options).find((o) => o.value !== currentValue);
      return other ? other.value : currentValue;
    }, currentVal);

    expect(altVal).not.toBe(currentVal);
    await tz.first().selectOption(altVal);

    await expect
      .poll(async () => ((await iso.first().textContent()) ?? '').trim(), { timeout: 3000 })
      .not.toBe(before);
  });
});
