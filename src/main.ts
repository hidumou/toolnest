import { mountShell } from './lib/shell';
import { icon } from './lib/icons';

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
  hydrateIcons();
  bindCategoryFilter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
