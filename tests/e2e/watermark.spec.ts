import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pixelAt } from '../helpers';

/**
 * watermark.spec：图片去水印
 *
 * impl 已暴露的测试钩子（data-testid）：
 *   tn-file-input        #wm-file        <input type=file hidden>
 *   tn-mode-segmented    #mode-seg       模式 segmented（button[data-mode="box|auto|grey"]）
 *   tn-process-btn       #wm-process     "立即处理"
 *   tn-download-btn      #wm-download    "下载 PNG"（disabled 直到处理完成；文件名 *_clean.png）
 *   tn-result-canvas     #wm-result-canvas  原图分辨率的 canvas，专供 e2e 在原始坐标做 getImageData
 *
 * 默认 mode=box，corner=br，pct=20% —— 对 200×150 + 右下水印的 fixture，
 * box 模式无显式 box 时会用 corner-default 矩形，刚好覆盖水印区域。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PNG = path.resolve(__dirname, '..', 'fixtures', 'sample.png');

test.describe('Watermark (/watermark/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/watermark/');
  });

  function fileInput(page: import('@playwright/test').Page) {
    return page.getByTestId('tn-file-input').or(page.locator('#wm-file'));
  }

  test('上传 + 处理后 result-canvas (180,130) 像素应接近背景 #DDD6FE 而远离水印 #0F1E2E', async ({ page }) => {
    await fileInput(page).first().setInputFiles(FIXTURE_PNG);

    const processBtn = page.getByTestId('tn-process-btn').or(page.locator('#wm-process'));
    await expect(processBtn.first()).toBeVisible({ timeout: 5000 });
    await processBtn.first().click();

    // 等到处理完成（download 按钮从 disabled 变为 enabled 是稳定信号）
    const downloadBtn = page.getByTestId('tn-download-btn').or(page.locator('#wm-download'));
    await expect(downloadBtn.first()).toBeEnabled({ timeout: 15_000 });

    const canvasSel = '[data-testid="tn-result-canvas"]';
    const [r, g, b] = await pixelAt(page, canvasSel, 180, 130);
    const dBg = Math.abs(r - 221) + Math.abs(g - 214) + Math.abs(b - 254);
    const dWm = Math.abs(r - 15) + Math.abs(g - 30) + Math.abs(b - 46);
    expect(dBg, `expected pixel near background, got rgb(${r},${g},${b})`).toBeLessThan(200);
    expect(dWm, `expected pixel away from watermark color, got rgb(${r},${g},${b})`).toBeGreaterThan(50);
  });

  test('切换到 grey 模式：模式按钮存在并可点击', async ({ page }) => {
    await fileInput(page).first().setInputFiles(FIXTURE_PNG);

    const modeSeg = page.getByTestId('tn-mode-segmented').or(page.locator('#mode-seg'));
    const greyBtn = modeSeg.first().getByRole('button', { name: /灰白|灰度|grey/i })
      .or(modeSeg.first().locator('[data-mode="grey"]'));
    await expect(greyBtn.first()).toBeVisible();
    await greyBtn.first().click();
    await expect(greyBtn.first()).toHaveClass(/active/);
  });

  test('点击"下载 PNG"触发下载，文件名包含 _clean', async ({ page }) => {
    await fileInput(page).first().setInputFiles(FIXTURE_PNG);

    const processBtn = page.getByTestId('tn-process-btn').or(page.locator('#wm-process'));
    await processBtn.first().click();

    const downloadBtn = page.getByTestId('tn-download-btn').or(page.locator('#wm-download'));
    await expect(downloadBtn.first()).toBeEnabled({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      downloadBtn.first().click(),
    ]);
    expect(download.suggestedFilename()).toContain('_clean');
  });
});
