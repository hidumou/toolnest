import { mountShell } from '../../lib/shell';
import { icon } from '../../lib/icons';
import { CHANGELOG, renderChangelog } from '../../data/changelog';

function hydrateIcons(): void {
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((node) => {
    const name = node.dataset.icon;
    if (!name) return;
    const svg = icon(name);
    if (svg) node.innerHTML = svg;
  });
}

function init(): void {
  mountShell('#site-header', '#site-footer', 'changelog');
  const list = document.querySelector<HTMLOListElement>('#cl-list-all');
  if (list) list.innerHTML = renderChangelog(CHANGELOG);
  hydrateIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
