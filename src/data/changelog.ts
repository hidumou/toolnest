/**
 * ToolNest 站点更新日志（单一数据源）。
 *
 * 维护规则（亦见 CLAUDE.md）：
 * - 每次重大 bug 修复 / 新功能上线，必须在本数组顶部新增一条记录。
 * - 数组首项视为「最新」，会在首页打绿底高亮。
 * - 首页只显示前 10 条；/changelog/ 列表页显示全部。
 *
 * 字段：
 *   version   语义化或递增版号（"v0.x"）
 *   date      绝对日期 "YYYY-MM-DD" 或人话描述
 *   title     一句话总结
 *   items     当次变更的逐条说明，简明扼要
 *   tag       可选徽标，如 "新功能" / "修复"；首项默认显示「最新」
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
  tag?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v0.8',
    date: '2026-05-22',
    title: 'JSON 工具体验升级',
    items: [
      '修复 1fr 1fr 网格在长 JSON 下被压扁的布局错位',
      '美化 / 排序结果支持逐节点折叠与展开，新增「全部展开 / 全部折叠」',
      '输出栏增加快速「复制」按钮，textContent 始终为干净 JSON',
      '输入框与输出框对齐到同一水平线',
    ],
    tag: '修复 + 新功能',
  },
  {
    version: 'v0.7',
    date: '2026-05-12',
    title: '站点清理与体验优化',
    items: [
      '移除全部失效链接（登录、社交、关于/隐私/条款占位页）',
      '删除 6 张「即将上线」占位卡片，避免误导',
      '分类筛选改造为真功能，点击即可过滤工具卡',
      'PICK 推荐区改为真实「更新日志」',
      '修正过期版权（2025 → 当前年份），删除内部版本标记',
    ],
  },
  {
    version: 'v0.6',
    date: 'JWT 上线',
    title: 'JWT 解码工具',
    items: [
      '本地拆解 JWT header / payload 三段',
      'iat / nbf / exp 自动换算为人类可读时间',
      '签名暂不校验，明确标注「未验证」状态',
    ],
  },
  {
    version: 'v0.5',
    date: 'URL 上线',
    title: 'URL 编解码工具',
    items: [
      'encodeURIComponent / encodeURI 双模式切换',
      '批量按行编解码，空行保留',
      '完整 URL 自动拆解为 protocol / host / path / query 表格',
    ],
  },
  {
    version: 'v0.4',
    date: 'Base64 上线',
    title: 'Base64 编解码工具',
    items: [
      '文本 ↔ Base64 双向转换，UTF-8 安全',
      'URL-safe 变体支持',
      '文件 → Base64 与 Base64 → 文件 双向直转，自动嗅探 MIME',
    ],
  },
  {
    version: 'v0.3',
    date: 'JSON 上线',
    title: 'JSON 格式化工具',
    items: [
      '美化 / 压缩 / 键排序 / 转义 / 反转义',
      '错误自动定位，可调缩进（2 / 4 / Tab）',
      '支持粘贴自动美化、⌘/Ctrl + B、⌘/Ctrl + M 快捷键',
    ],
  },
  {
    version: 'v0.2',
    date: '去水印上线',
    title: '豆包图片去水印',
    items: [
      '手动框选 / 自动扫描 / 灰白文字 三种擦除策略',
      '处理前后滑动对比，原始分辨率导出 PNG',
      '全程浏览器本地处理，不上传任何字节',
    ],
  },
  {
    version: 'v0.1',
    date: '首发',
    title: '站点脚手架与时间戳互转',
    items: [
      'Unix 时间戳 ↔ ISO 8601 ↔ 自然语言时间互转',
      '多时区切换、当前时间实时刷新',
      '建立站点视觉系统与工具页通用框架',
    ],
  },
];

const ESC_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]!);
}

/**
 * 渲染日志条目为 <li class="cl-entry"> 列表 HTML。
 * @param entries 待渲染条目（建议在调用前自行 slice）。
 * @param markFirstAsLatest 是否给数组第一项加上「最新」徽标 + .latest 高亮。
 */
export function renderChangelog(entries: ChangelogEntry[], markFirstAsLatest = true): string {
  return entries
    .map((e, i) => {
      const isLatest = markFirstAsLatest && i === 0;
      const tagText = e.tag ?? (isLatest ? '最新' : '');
      const tagHtml = tagText
        ? `<span class="cl-tag">${esc(tagText)}</span>`
        : '';
      const itemsHtml = e.items.map((it) => `<li>${esc(it)}</li>`).join('');
      return `
      <li class="cl-entry${isLatest ? ' latest' : ''}">
        <div class="cl-side">
          <div class="cl-ver">${esc(e.version)}</div>
          <div class="cl-date">${esc(e.date)}</div>
          ${tagHtml}
        </div>
        <div class="cl-body">
          <h3 class="cl-title">${esc(e.title)}</h3>
          <ul>${itemsHtml}</ul>
        </div>
      </li>`;
    })
    .join('');
}
