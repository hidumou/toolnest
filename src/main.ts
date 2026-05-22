import { mountShell } from './lib/shell';
import { icon } from './lib/icons';
import { CHANGELOG, renderChangelog } from './data/changelog';

/** 首页最多显示的更新日志条数；超过则显示「查看全部」入口。 */
const HOME_CHANGELOG_LIMIT = 10;

function renderHomeChangelog(): void {
  const list = document.querySelector<HTMLOListElement>('#cl-list');
  if (!list) return;
  list.innerHTML = renderChangelog(CHANGELOG.slice(0, HOME_CHANGELOG_LIMIT));
  // 「查看全部」入口始终可见——既为今后超过 10 条做铺垫，
  // 也作为日志归档页的稳定入口（便于分享 / 收藏）。
}

function hydrateIcons(): void {
  const nodes = document.querySelectorAll<HTMLElement>('[data-icon]');
  nodes.forEach((node) => {
    const name = node.dataset.icon;
    if (!name) return;
    const svg = icon(name);
    if (!svg) return;
    node.innerHTML = svg;
  });
}

function bindCategoryFilter(): void {
  const cats = document.querySelectorAll<HTMLButtonElement>('.cats .cat');
  const cards = document.querySelectorAll<HTMLElement>('.grid .card');
  if (cats.length === 0 || cards.length === 0) return;

  cats.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.cat ?? 'all';
      cats.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cards.forEach((card) => {
        const cat = card.dataset.category ?? '';
        const visible = target === 'all' || cat === target;
        card.style.display = visible ? '' : 'none';
      });
    });
  });
}

function init(): void {
  mountShell('#site-header', '#site-footer', 'tools');
  renderHomeChangelog();
  hydrateIcons();
  bindCategoryFilter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
