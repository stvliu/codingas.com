# Proposal: migrate-github-pages-and-wiki

> 范围调整记录：原名中的 GitHub Pages 迁移部分经决策移除（官网源码不上 GitHub，主站部署维持 Cloudflare Pages 现状），本 change 聚焦文档 Wiki 双路镜像轨。

## Why

当前文档只存在于 codingas.com 主站（Cloudflare Pages 托管），存在三个未解决的问题：

1. **大陆可达性无兜底**：主站走 Cloudflare 网络，境内访问质量一般，文档场景没有国内可达的替代入口。
2. **百度 SEO 缺失**：主站难以被百度收录，中文文档搜索流量无法承接。
3. **文档与产品仓库割裂**：开发者在 GitHub/Gitee 浏览 `llm-gateway` 产品仓库时，无法就近阅读文档，只能跳转主站。

官网源码与部署维持现状（主托管 Gitee + Cloudflare Pages，**源码不上 GitHub —— 用户决策**）。本变更聚焦文档轨：将 Starlight 文档转换为 Gollum Wiki 格式，双路镜像到 GitHub 与 Gitee 的 `llm-gateway` 产品仓库 Wiki —— Gitee Wiki 轨兜底大陆可达性与百度收录，GitHub Wiki 轨让开发者就近阅读。

关键事实（已验证）：Gitee Pages 自 2024-05 起实质下线且未恢复，Gitee 侧建站仅剩 Wiki 一条路；GitHub `stvliu/llm-gateway` 公开、Wiki 未初始化；Gitee `ezxbao_liuye/llm-gateway` 已存在（与 GitHub 同提交的产品代码镜像），Wiki 已激活。

## What Changes

- 新增 `scripts/export-wiki.mjs`：将 `src/content/docs/` 的 31 个 `.mdx` 确定性转换为 Gollum Wiki `.md` —— `Tabs`/`TabItem` 降级为分节标题、frontmatter 剥离且 `title` 转 H1、根相对链接改写为 wiki 相对链接、程序化生成 `_Sidebar.md`（源自侧边栏数据单一来源）、`_Footer.md`、`Home.md`，并内置产物断链自校验。
- 侧边栏数据抽为 Node 可直接加载的 `astro.sidebar.mjs` 单一来源（`astro.sidebar.ts` 改 re-export，`astro.config.ts` 引用路径不变）。
- 新增本地同步脚本（pnpm 封装）：将导出产物以单个同步 commit 双路推送到 `stvliu/llm-gateway.wiki.git`（GitHub）与 `gitee.com/ezxbao_liuye/llm-gateway.wiki.git`（Gitee）；产物无差异时跳过，任一落点失败非零退出。
- 更新 `CLAUDE.md`：新增 wiki 同步流程章节。
- 一次性操作：GitHub `llm-gateway` 网页端初始化 Wiki（Gitee 侧已完成）；准备两个落点的本地推送凭据。
- **明确不做**：官网部署、DNS、`astro.config.ts` 站点配置、Cloudflare Pages 均保持现状，本变更不涉及主站发布链路。

## Capabilities

### New Capabilities

- `wiki-export`: 将 `src/content/docs/` 的 Starlight 文档确定性转换为 Gollum Wiki 格式；覆盖目录映射、MDX 组件降级、frontmatter 处理、链接改写、侧边栏/页脚/首页生成与产物校验。
- `wiki-sync`: 本地同步脚本将导出产物单向推送至 GitHub 与 Gitee 的 `llm-gateway` Wiki；wiki 为只读镜像，内容变更一律回到文档源。

### Modified Capabilities

（无 —— `openspec/specs/` 当前为空，本项目首次建立规格。）

## Impact

- **代码**：`scripts/`（新增 `export-wiki.mjs` 与推送封装）、`astro.sidebar.mjs`（新增）、`astro.sidebar.ts`（改 re-export）、`package.json`（脚本登记）、`CLAUDE.md`（wiki 同步章节）。
- **外部系统**：GitHub/Gitee 两处 wiki 仓库（GitHub 侧待网页初始化）；本地推送凭据（GitHub 用 `stvliu` 凭据，Gitee 用 `ezxbao_liuye` 的 PAT/SSH）。
- **知情接受的风险**：手动同步可能被遗忘（文档更新后 wiki 漂移）→ 一步脚本 + CLAUDE.md 流程约定缓解，后续可自动化；本地推送 GitHub 依赖网络可达 → 失败重试、双落点独立呈现，`_Footer.md` 标注"以主站为准"。
- **不涉及**：主站部署、DNS、Cloudflare Pages、GitHub Actions、产品代码仓库。
