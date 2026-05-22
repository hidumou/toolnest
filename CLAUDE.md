# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ToolNest（工具巢）：一个中文（zh-CN）静态站点，展示浏览器端小工具，分为开发、文本、图片、设计、安全、生成、生活等分类。所有处理在客户端完成，无后端。

## 更新日志维护规则（重要）

**每一次重大 bug 修复或新功能上线，都必须在站点更新日志中记录。**

- 数据源：`src/data/changelog.ts` 中的 `CHANGELOG` 数组（**唯一来源**，不要直接改 HTML）。
- 新增方式：在数组**顶部**插入一条新的 `ChangelogEntry`，字段：
  - `version`：递增到下一个 `v0.x`
  - `date`：绝对日期 `"YYYY-MM-DD"`（不要用「明天 / 上周」等相对描述）
  - `title`：一句话总结
  - `items`：当次变更，每条简明扼要
  - `tag`：可选徽标（如 `"修复"`、`"新功能"`、`"修复 + 新功能"`）；若省略，首项会自动标「最新」
- 首页 `/#changelog` 只渲染前 10 条，超出时显示「查看全部」按钮跳到 `/changelog/`。
- `/changelog/` 页面渲染全部条目。
- 改了 `changelog.ts` 后，记得 `pnpm build` + 部署，不然线上看不到。

什么算「重大」：用户能感知的修复 / 新工具上线 / 现有工具能力扩展 / 重要的视觉或交互调整。纯粹的 lint、依赖升级、文档调整、内部重构不计入。
