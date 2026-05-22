/**
 * 共用测试辅助函数。spec 通过 `import { ... } from '../helpers'` 引入。
 *
 * 设计原则：
 * - 不做任何"业务推断"，仅封装 DOM/浏览器交互；
 * - 失败抛错让 Playwright 自然记录 trace，不吞异常；
 * - 不对 impl 选择器做硬编码假设 —— spec 中根据需要传入 selector。
 */
import type { Page } from '@playwright/test';

/** 读剪贴板文本（依赖 playwright.config.ts 的 `clipboard-read` 权限） */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(async () => {
    return navigator.clipboard.readText();
  });
}

/** 上传文件到 <input type="file">。filePath 为绝对路径或相对当前 cwd 的路径。 */
export async function uploadFile(
  page: Page,
  inputSelector: string,
  filePath: string,
): Promise<void> {
  await page.locator(inputSelector).setInputFiles(filePath);
}

/**
 * 取 canvas 上 (x, y) 位置的像素 RGBA。
 * canvas 内部坐标系 = canvas.width / canvas.height 像素，不等于 DOM box 大小。
 * 测试 watermark 时传的 (x, y) 应为图像内部像素坐标。
 */
export async function pixelAt(
  page: Page,
  canvasSelector: string,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  return page.evaluate(
    ({ sel, px, py }: { sel: string; px: number; py: number }) => {
      const el = document.querySelector(sel) as HTMLCanvasElement | null;
      if (!el) throw new Error(`canvas not found: ${sel}`);
      const ctx = el.getContext('2d');
      if (!ctx) throw new Error('2d context not available');
      const d = ctx.getImageData(px, py, 1, 1).data;
      return [d[0], d[1], d[2], d[3]] as [number, number, number, number];
    },
    { sel: canvasSelector, px: x, py: y },
  );
}

/**
 * 等待全局 toast 出现。若传入 text，则要求 toast 文本包含 text。
 * 注意：toast 的具体 DOM 结构由 src/lib/toast.ts 决定 —— 这里用一个宽松匹配：
 *   优先匹配 [data-toast]、其次 .toast、最后纯文本可见。
 */
export async function waitToast(page: Page, text?: string): Promise<void> {
  const selectors = ['[data-toast]', '.toast', '[role="status"]'];
  if (text) {
    // 任一 toast 容器内出现指定文本即可
    const candidates = selectors.map((s) => page.locator(`${s}:has-text("${text}")`));
    await Promise.race(candidates.map((loc) => loc.first().waitFor({ state: 'visible', timeout: 5000 })));
  } else {
    const candidates = selectors.map((s) => page.locator(s).first());
    await Promise.race(candidates.map((loc) => loc.waitFor({ state: 'visible', timeout: 5000 })));
  }
}
