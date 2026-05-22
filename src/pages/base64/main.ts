import { mountShell } from '../../lib/shell';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import {
  encodeText, decodeText, isLikelyBase64, encodeFile, decodeFile,
} from '../../core/base64';

mountShell(undefined, undefined, 'base64');

function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('missing: ' + sel);
  return el;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function init(): void {
  const modeSeg = $('#mode-seg');
  const paneText = $('#pane-text');
  const paneFile = $('#pane-file');
  const urlsafe = $<HTMLInputElement>('#urlsafe');

  modeSeg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      modeSeg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const m = (b as HTMLButtonElement).dataset.mode;
      paneText.hidden = m !== 'text';
      paneFile.hidden = m !== 'file';
    });
  });

  // 文本面板
  const tIn = $<HTMLTextAreaElement>('#t-in');
  const tOut = $<HTMLTextAreaElement>('#t-out');

  function tEncode() {
    try {
      tOut.value = encodeText(tIn.value, urlsafe.checked);
      toast('已编码', 'ok');
    } catch (e) { toast('编码失败：' + (e as Error).message, 'err'); }
  }
  function tDecode() {
    try {
      tOut.value = decodeText(tIn.value, urlsafe.checked);
      toast('已解码', 'ok');
    } catch (e) { toast('解码失败：' + (e as Error).message, 'err'); }
  }
  function tAuto() {
    if (isLikelyBase64(tIn.value)) tDecode();
    else tEncode();
  }
  $('#t-encode').addEventListener('click', tEncode);
  $('#t-decode').addEventListener('click', tDecode);
  $('#t-auto').addEventListener('click', tAuto);
  $('#t-swap').addEventListener('click', () => {
    const a = tIn.value;
    tIn.value = tOut.value;
    tOut.value = a;
  });
  $('#t-copy').addEventListener('click', async () => {
    if (!tOut.value) { toast('暂无内容', 'err'); return; }
    const ok = await copyText(tOut.value);
    toast(ok ? '已复制' : '复制失败', ok ? 'ok' : 'err');
  });
  $('#t-clear').addEventListener('click', () => { tIn.value = ''; tOut.value = ''; });
  $('#t-example').addEventListener('click', () => {
    tIn.value = '你好世界🌏';
    tOut.value = encodeText(tIn.value, urlsafe.checked);
    toast('已注入示例并编码', 'ok');
  });

  // 文件 → Base64
  const fIn = $<HTMLInputElement>('#f-in');
  const zoneEnc = $('#zone-enc');
  const fMeta = $('#f-meta');
  const fName = $('#f-name');
  const fSize = $('#f-size');
  const fType = $('#f-type');
  const fOut = $<HTMLTextAreaElement>('#f-out');
  let currentFile: File | null = null;

  zoneEnc.addEventListener('click', () => fIn.click());
  zoneEnc.addEventListener('dragover', (e) => { e.preventDefault(); zoneEnc.classList.add('drag'); });
  zoneEnc.addEventListener('dragleave', () => zoneEnc.classList.remove('drag'));
  zoneEnc.addEventListener('drop', (e) => {
    e.preventDefault();
    zoneEnc.classList.remove('drag');
    const f = e.dataTransfer?.files[0];
    if (f) setFile(f);
  });
  fIn.addEventListener('change', () => {
    const f = fIn.files?.[0];
    if (f) setFile(f);
  });

  function setFile(f: File) {
    currentFile = f;
    fMeta.hidden = false;
    fName.textContent = f.name;
    fSize.textContent = formatBytes(f.size);
    fType.textContent = f.type || 'unknown';
  }
  $('#f-encode').addEventListener('click', async () => {
    if (!currentFile) { toast('请先选择文件', 'err'); return; }
    try {
      const b64 = await encodeFile(currentFile, urlsafe.checked);
      fOut.value = b64;
      const ok = await copyText(b64);
      toast(ok ? '已编码并复制' : '已编码，复制失败', ok ? 'ok' : 'err');
    } catch (e) {
      toast('编码失败：' + (e as Error).message, 'err');
    }
  });

  // Base64 → 文件
  const dIn = $<HTMLTextAreaElement>('#d-in');
  const dDecode = $<HTMLButtonElement>('#d-decode');
  const dDownload = $<HTMLButtonElement>('#d-download');
  const dMeta = $('#d-meta');
  const dName = $('#d-name');
  const dSize = $('#d-size');
  const dMime = $('#d-mime');
  let decoded: { bytes: Uint8Array; mime: string; ext: string } | null = null;

  dDecode.addEventListener('click', async () => {
    if (!dIn.value.trim()) { toast('请粘贴 Base64', 'err'); return; }
    try {
      decoded = await decodeFile(dIn.value, urlsafe.checked);
      dMeta.hidden = false;
      dName.textContent = `guess.${decoded.ext}`;
      dSize.textContent = formatBytes(decoded.bytes.length);
      dMime.textContent = decoded.mime;
      dDownload.disabled = false;
      toast('已解码，可下载', 'ok');
    } catch (e) {
      toast('解码失败：' + (e as Error).message, 'err');
    }
  });
  dDownload.addEventListener('click', () => {
    if (!decoded) return;
    const blob = new Blob([decoded.bytes as BlobPart], { type: decoded.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guess.${decoded.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
