import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import {
  processImageData, type Mode, type Corner, type ProcessOpts,
} from '../../core/watermark';

mountShell(undefined, undefined, 'watermark');

function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing: ' + sel);
  return el;
}

interface State {
  origin: ImageData | null;
  scale: number; // preview / origin
  mode: Mode;
  corner: Corner;
  pct: number; // 0.05-0.5
  threshold: number;
  minBright: number;
  maxSat: number;
  box: { x: number; y: number; w: number; h: number } | null; // 原图坐标
  fileName: string;
}

export function init(): void {
  const state: State = {
    origin: null,
    scale: 1,
    mode: 'box',
    corner: 'br',
    pct: 0.2,
    threshold: 30,
    minBright: 30,
    maxSat: 40,
    box: null,
    fileName: 'image.png',
  };

  const empty = $('#wm-empty');
  const wrap = $('#wm-canvas-wrap');
  const compareWrap = $('#compare-wrap');
  const before = $<HTMLCanvasElement>('#wm-before');
  const after = $<HTMLCanvasElement>('#wm-after');
  const beforeCtx = before.getContext('2d', { willReadFrequently: true, alpha: true })!;
  const afterCtx = after.getContext('2d', { willReadFrequently: true, alpha: true })!;
  const handle = $('#compare-handle');
  const sel = $('#sel-overlay');
  const busy = $('#busy');
  const dlBtn = $<HTMLButtonElement>('#wm-download');
  const processBtn = $<HTMLButtonElement>('#wm-process');
  const fileInput = $<HTMLInputElement>('#wm-file');
  const zone = $('#wm-zone');

  // 全分辨率隐藏 canvas：读原图像素 + 写处理结果（结果 canvas 直接放在 DOM 里，
  // 用 testid 暴露给 e2e，使其能在原图坐标上做 getImageData 断言）。
  const fullBefore = document.createElement('canvas');
  const fullAfter = $<HTMLCanvasElement>('#wm-result-canvas');
  const fullBeforeCtx = fullBefore.getContext('2d', { willReadFrequently: true, alpha: true })!;
  const fullAfterCtx = fullAfter.getContext('2d', { willReadFrequently: true, alpha: true })!;

  // ----------- file load -----------
  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const f = e.dataTransfer?.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) loadFile(f);
  });
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) { loadFile(f); break; }
      }
    }
  });

  async function loadFile(file: File) {
    state.fileName = file.name.replace(/\.[^.]+$/, '');
    try {
      // 关键：禁用浏览器的色彩管理 + 预乘 alpha，保证 getImageData 拿到的就是源文件像素
      // 否则 PNG 透明区采样到的颜色可能被浏览器"乘进"alpha 失真。
      const bmp = await createImageBitmap(file, {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
        imageOrientation: 'from-image',
      });
      const w = bmp.width, h = bmp.height;
      fullBefore.width = w; fullBefore.height = h;
      fullAfter.width = w; fullAfter.height = h;
      fullBeforeCtx.clearRect(0, 0, w, h);
      fullBeforeCtx.drawImage(bmp, 0, 0);
      state.origin = fullBeforeCtx.getImageData(0, 0, w, h);

      // 预览缩放：限制最大宽度
      const maxW = Math.min(900, compareWrap.parentElement?.clientWidth ?? 800);
      const scale = Math.min(1, maxW / w);
      state.scale = scale;
      const pw = Math.round(w * scale);
      const ph = Math.round(h * scale);
      before.width = pw; before.height = ph;
      after.width = pw; after.height = ph;
      beforeCtx.imageSmoothingEnabled = true;
      beforeCtx.drawImage(fullBefore, 0, 0, pw, ph);

      empty.style.display = 'none';
      wrap.style.display = 'block';
      state.box = null;
      sel.hidden = true;
      schedule();
    } catch (e) {
      toast('图片读取失败：' + (e as Error).message, 'err');
    }
  }

  // ----------- controls -----------
  $('#mode-seg').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      $('#mode-seg').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.mode = (b as HTMLButtonElement).dataset.mode as Mode;
      $('#auto-row').hidden = state.mode !== 'auto';
      $('#grey-row1').hidden = state.mode !== 'grey';
      $('#grey-row2').hidden = state.mode !== 'grey';
      schedule();
    });
  });
  $('#corner-grid').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      $('#corner-grid').querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.corner = (b as HTMLButtonElement).dataset.c as Corner;
      schedule();
    });
  });
  const pct = $<HTMLInputElement>('#pct');
  const pctV = $('#pct-v');
  pct.addEventListener('input', () => {
    state.pct = Number(pct.value) / 100;
    pctV.textContent = `${pct.value}%`;
    schedule();
  });
  const th = $<HTMLInputElement>('#th');
  const thV = $('#th-v');
  th.addEventListener('input', () => {
    state.threshold = Number(th.value);
    thV.textContent = th.value;
    schedule();
  });
  const mb = $<HTMLInputElement>('#mb');
  const mbV = $('#mb-v');
  mb.addEventListener('input', () => {
    state.minBright = Number(mb.value);
    mbV.textContent = mb.value;
    schedule();
  });
  const ms = $<HTMLInputElement>('#ms');
  const msV = $('#ms-v');
  ms.addEventListener('input', () => {
    state.maxSat = Number(ms.value);
    msV.textContent = ms.value;
    schedule();
  });

  // ----------- selection (box mode) -----------
  let dragStart: { x: number; y: number } | null = null;
  compareWrap.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'box' || !state.origin) return;
    // 仅当不是在 handle 上
    const target = e.target as HTMLElement;
    if (target === handle || target.classList.contains('compare-handle')) return;
    (compareWrap as HTMLElement).setPointerCapture(e.pointerId);
    const rect = compareWrap.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    sel.hidden = false;
    sel.style.left = `${dragStart.x}px`;
    sel.style.top = `${dragStart.y}px`;
    sel.style.width = `0px`;
    sel.style.height = `0px`;
    e.preventDefault();
  });
  compareWrap.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const rect = compareWrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = Math.min(dragStart.x, x);
    const top = Math.min(dragStart.y, y);
    const w = Math.abs(x - dragStart.x);
    const h = Math.abs(y - dragStart.y);
    sel.style.left = `${left}px`;
    sel.style.top = `${top}px`;
    sel.style.width = `${w}px`;
    sel.style.height = `${h}px`;
  });
  compareWrap.addEventListener('pointerup', () => {
    if (!dragStart) return;
    // 把预览坐标转回原图
    const left = parseFloat(sel.style.left);
    const top = parseFloat(sel.style.top);
    const w = parseFloat(sel.style.width);
    const h = parseFloat(sel.style.height);
    dragStart = null;
    if (w < 4 || h < 4) {
      sel.hidden = true;
      state.box = null;
      schedule();
      return;
    }
    state.box = {
      x: left / state.scale,
      y: top / state.scale,
      w: w / state.scale,
      h: h / state.scale,
    };
    schedule();
  });

  // ----------- compare slider -----------
  let sliderDrag = false;
  handle.addEventListener('pointerdown', (e) => {
    sliderDrag = true;
    (handle as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!sliderDrag) return;
    const rect = compareWrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = (x / rect.width) * 100;
    handle.style.left = `${pct}%`;
    after.style.clipPath = `inset(0 0 0 ${pct}%)`;
  });
  handle.addEventListener('pointerup', () => { sliderDrag = false; });

  // ----------- process pipeline -----------
  let pending: number | null = null;
  function schedule() {
    if (!state.origin) return;
    if (pending !== null) window.clearTimeout(pending);
    pending = window.setTimeout(run, 150);
  }
  // 手动触发（绕过 debounce），用于按钮 + e2e
  processBtn.addEventListener('click', () => {
    if (!state.origin) { toast('请先选择图片', 'err'); return; }
    if (pending !== null) { window.clearTimeout(pending); pending = null; }
    run();
  });
  function buildOpts(): ProcessOpts {
    const opts: ProcessOpts = {
      mode: state.mode,
      corner: state.corner,
      pct: state.pct,
      threshold: state.threshold,
      minBright: state.minBright,
      maxSat: state.maxSat,
    };
    if (state.mode === 'box' && state.box) {
      opts.box = state.box;
    }
    return opts;
  }
  function run() {
    if (!state.origin) return;
    busy.hidden = false;
    // 同步处理（小图够快；大图也可接受 < 1s）
    setTimeout(() => {
      try {
        const out = processImageData(state.origin!, buildOpts());
        fullAfterCtx.putImageData(out, 0, 0);
        // 缩放绘到预览
        afterCtx.clearRect(0, 0, after.width, after.height);
        afterCtx.drawImage(fullAfter, 0, 0, after.width, after.height);
        dlBtn.disabled = false;
      } catch (e) {
        toast('处理失败：' + (e as Error).message, 'err');
      } finally {
        busy.hidden = true;
      }
    }, 0);
  }

  // ----------- download -----------
  dlBtn.addEventListener('click', () => {
    fullAfter.toBlob((blob) => {
      if (!blob) { toast('导出失败', 'err'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}_clean.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('已开始下载', 'ok');
    }, 'image/png');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
