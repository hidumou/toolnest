import { icon } from './icons';

const NAV_LINKS: Array<{ key: string; label: string; href: string }> = [
  { key: 'tools', label: '工具库', href: '/#tools' },
  { key: 'categories', label: '分类', href: '/#categories' },
  { key: 'changelog', label: '更新日志', href: '/#changelog' },
];

export function renderHeader(activeRoute?: string): string {
  const linksHtml = NAV_LINKS.map(
    (l) => `<a href="${l.href}"${activeRoute === l.key ? ' aria-current="page"' : ''}>${l.label}</a>`,
  ).join('');

  return `
  <div class="nav-wrap">
    <nav class="nav" data-route="${activeRoute ?? ''}">
      <a class="brand" href="/">
        <span class="brand-mark">${icon('bolt')}</span>
        ToolNest
      </a>
      <div class="nav-links">
        ${linksHtml}
      </div>
      <div class="nav-cta">
        <a class="btn btn-primary" href="/#tools">开始使用 <span class="arrow">→</span></a>
      </div>
    </nav>
  </div>`;
}

export function renderFooter(): string {
  return `
  <footer>
    <div class="wrap">
      <div class="foot-grid">
        <div>
          <div class="foot-brand">
            <span class="brand-mark">${icon('bolt')}</span>
            ToolNest
          </div>
          <p class="foot-desc">把每天都会用到的小工具整理成一个温暖的窝。免费、即开即用、本地处理。</p>
        </div>
        <div>
          <h5>常用工具</h5>
          <ul>
            <li><a href="/timestamp/">日期 / 时间戳转换</a></li>
            <li><a href="/json/">JSON 格式化</a></li>
            <li><a href="/watermark/">豆包图片去水印</a></li>
            <li><a href="/base64/">Base64 编解码</a></li>
            <li><a href="/url/">URL 编解码</a></li>
            <li><a href="/jwt/">JWT 解码</a></li>
          </ul>
        </div>
      </div>
      <div class="foot-bot">
        <span>© ${new Date().getFullYear()} ToolNest · 浏览器即开即用的小工具集合</span>
      </div>
    </div>
  </footer>`;
}

/**
 * 把 Header / Footer 注入页面对应锚点。
 */
export function mountShell(
  headerSelector: string = '#site-header',
  footerSelector: string = '#site-footer',
  active?: string,
): void {
  const head = document.querySelector<HTMLElement>(headerSelector);
  const foot = document.querySelector<HTMLElement>(footerSelector);
  if (head) head.innerHTML = renderHeader(active);
  if (foot) foot.innerHTML = renderFooter();
}
