/**
 * 图片去水印的核心算法，移植自 remove_watermark.py。
 * 全部操作在 ImageData 上，不依赖任何 DOM / Canvas API（UI 层负责包装）。
 */

export type Mode = 'box' | 'auto' | 'grey';
export type Corner = 'br' | 'bl' | 'tr' | 'tl';

export interface ProcessOpts {
  mode: Mode;
  corner: Corner;
  pct: number;
  /** box 模式的矩形（图像坐标） */
  box?: { x: number; y: number; w: number; h: number };
  /** auto 模式：颜色差阈值 */
  threshold?: number;
  /** grey 模式：最小亮度 */
  minBright?: number;
  /** grey 模式：最大饱和度 */
  maxSat?: number;
}

interface RGBA { r: number; g: number; b: number; a: number; }

function cloneImageData(src: ImageData): ImageData {
  // 不要直接 new ImageData(data, w, h)，浏览器对 detached buffer 处理不一致
  const out = new ImageData(src.width, src.height);
  out.data.set(src.data);
  return out;
}

function getPx(d: Uint8ClampedArray, i: number): RGBA {
  return { r: d[i]!, g: d[i + 1]!, b: d[i + 2]!, a: d[i + 3]! };
}

function setPx(d: Uint8ClampedArray, i: number, c: RGBA): void {
  d[i] = c.r; d[i + 1] = c.g; d[i + 2] = c.b; d[i + 3] = c.a;
}

export function cornerBox(
  w: number, h: number, corner: Corner, pct: number,
): { x: number; y: number; w: number; h: number } {
  const bw = Math.max(1, Math.floor(w * pct));
  const bh = Math.max(1, Math.floor(h * pct));
  if (corner === 'br') return { x: w - bw, y: h - bh, w: bw, h: bh };
  if (corner === 'bl') return { x: 0, y: h - bh, w: bw, h: bh };
  if (corner === 'tr') return { x: w - bw, y: 0, w: bw, h: bh };
  return { x: 0, y: 0, w: bw, h: bh };
}

function otherCornerBoxes(
  w: number, h: number, corner: Corner, pct: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  const bw = Math.max(1, Math.floor(w * pct * 0.3));
  const bh = Math.max(1, Math.floor(h * pct * 0.3));
  const all: Record<Corner, { x: number; y: number; w: number; h: number }> = {
    tl: { x: 0, y: 0, w: bw, h: bh },
    tr: { x: w - bw, y: 0, w: bw, h: bh },
    bl: { x: 0, y: h - bh, w: bw, h: bh },
    br: { x: w - bw, y: h - bh, w: bw, h: bh },
  };
  return (Object.keys(all) as Corner[]).filter((k) => k !== corner).map((k) => all[k]);
}

/** 5-bit 量化后取众数，模拟 Python Counter.most_common */
export function sampleBgColor(
  img: ImageData,
  boxes: Array<{ x: number; y: number; w: number; h: number }>,
): RGBA {
  const counts = new Map<number, { count: number; sumR: number; sumG: number; sumB: number; sumA: number }>();
  const d = img.data;
  const W = img.width;
  for (const b of boxes) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const i = (y * W + x) * 4;
        const r = d[i]!, g = d[i + 1]!, bl = d[i + 2]!, a = d[i + 3]!;
        // 量化到 5 bit 增加聚类强度
        const key = ((r >> 3) << 18) | ((g >> 3) << 13) | ((bl >> 3) << 8) | (a >> 3);
        let entry = counts.get(key);
        if (!entry) { entry = { count: 0, sumR: 0, sumG: 0, sumB: 0, sumA: 0 }; counts.set(key, entry); }
        entry.count++;
        entry.sumR += r; entry.sumG += g; entry.sumB += bl; entry.sumA += a;
      }
    }
  }
  if (counts.size === 0) return { r: 0, g: 0, b: 0, a: 0 };
  let best: { count: number; sumR: number; sumG: number; sumB: number; sumA: number } | undefined;
  for (const e of counts.values()) {
    if (!best || e.count > best.count) best = e;
  }
  const b = best!;
  return {
    r: Math.round(b.sumR / b.count),
    g: Math.round(b.sumG / b.count),
    b: Math.round(b.sumB / b.count),
    a: Math.round(b.sumA / b.count),
  };
}

function clampBox(
  w: number, h: number, box: { x: number; y: number; w: number; h: number },
): { x0: number; y0: number; x1: number; y1: number } {
  const x0 = Math.max(0, Math.min(w, Math.floor(box.x)));
  const y0 = Math.max(0, Math.min(h, Math.floor(box.y)));
  const x1 = Math.max(0, Math.min(w, Math.floor(box.x + box.w)));
  const y1 = Math.max(0, Math.min(h, Math.floor(box.y + box.h)));
  return { x0, y0, x1, y1 };
}

export function processImageData(src: ImageData, opts: ProcessOpts): ImageData {
  const out = cloneImageData(src);
  const W = out.width, H = out.height;
  const d = out.data;
  const samples = otherCornerBoxes(W, H, opts.corner, opts.pct);
  const bg = sampleBgColor(out, samples);
  const fill: RGBA = bg.a === 0 ? { r: 0, g: 0, b: 0, a: 0 } : bg;

  if (opts.mode === 'box') {
    const box = opts.box ?? cornerBox(W, H, opts.corner, opts.pct);
    const { x0, y0, x1, y1 } = clampBox(W, H, box);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        setPx(d, (y * W + x) * 4, fill);
      }
    }
    return out;
  }

  if (opts.mode === 'auto') {
    const threshold = opts.threshold ?? 30;
    const region = cornerBox(W, H, opts.corner, opts.pct);
    const { x0, y0, x1, y1 } = clampBox(W, H, region);
    const transparentBg = bg.a === 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        const px = getPx(d, i);
        if (transparentBg && px.a < 5) continue;
        if (!transparentBg) {
          const diff = Math.abs(px.r - bg.r) + Math.abs(px.g - bg.g) + Math.abs(px.b - bg.b);
          if (diff <= threshold && Math.abs(px.a - bg.a) < 10) continue;
        }
        setPx(d, i, fill);
      }
    }
    return out;
  }

  // grey
  const minBright = opts.minBright ?? 30;
  const maxSat = opts.maxSat ?? 40;
  const region = cornerBox(W, H, opts.corner, opts.pct);
  const { x0, y0, x1, y1 } = clampBox(W, H, region);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      const px = getPx(d, i);
      if (px.a === 0) continue;
      const brightness = (px.r + px.g + px.b) / 3;
      const sat = Math.max(px.r, px.g, px.b) - Math.min(px.r, px.g, px.b);
      if (brightness > minBright && sat < maxSat) {
        setPx(d, i, fill);
      }
    }
  }
  return out;
}
