# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

codingas.com 官网与文档站，基于 Astro 6 + Starlight 0.40 + SCSS 构建，部署到 Cloudflare Pages。品牌正由 `LLM-Gateway` 切换为 `codingas.com`，代码中大量 `P0 占位` 注释标记了"域名/截图确定后需改"的位置——改动品牌相关内容时先全局搜 `P0 占位` 与 `LLM-Gateway`。

## 常用命令

```bash
pnpm install          # 安装依赖（pnpm 11，需 Node 20，见 .nvmrc）
pnpm dev              # 本地开发（默认 http://localhost:4321）
pnpm build            # 生产构建，产物输出到 dist/
pnpm preview          # 预览构建产物
pnpm lint:slugcheck   # 校验文档文件名/slug 是否英文 kebab-case（不依赖 build）
pnpm lint:linkcheck   # 扫描 dist/ 下 HTML 内部链接是否断链（必须先 pnpm build）
```

本仓库无单元测试框架，质量保障依赖上述两个 lint 脚本。CI（`.github/workflows/deploy-site.yml`）在 build 后依次跑 slugcheck 与 linkcheck，本地提交前应同样跑一遍。

构建时站点 URL 由 `PUBLIC_SITE_URL` 环境变量控制，默认 `https://codingas.com`。

## 架构

### 双轨 i18n（核心，易踩坑）

国际化分两条独立轨道，**不要混用**：

- **文档站**（`src/content/docs/`）：走 Starlight 原生 locale。`astro.config.ts` 当前**只配 `root`（简体中文）**，刻意不配 `en`，以避免未翻译内容产生 fallback 噪音。新增文档语种需在 `astro.config.ts` 的 `starlight.locales` 注册。
- **营销页**（`src/pages/`）：手动双轨。中文页在 `src/pages/`，英文页在 `src/pages/en/`（目录结构镜像）。文案集中在 `src/data/i18n/*.ts`，导出 `{ zh, en }` 对象，页面用 `const t = home.zh` / `home.en` 取值。结构化数据（如 `src/data/editionDiff.ts`、`src/data/homeFeatures.ts`）不带 i18n，中英共用。

新增营销页时记得**同时建中文与 `/en/` 英文两份**，否则会造成语言缺口。

### 两套 Header/Footer（不可互换）

- **Starlight 文档页**用 `src/components/starlight/{Header,Footer,SiteTitle}.astro`，这些组件依赖 Starlight 运行时数据 `Astro.locals.starlightRoute`，仅在文档页可用。
- **营销页**是 `src/pages/` 下的普通 Astro 页面，**没有**该运行时，复用 Starlight 组件会抛 `locals.starlightRoute is not defined`。因此 `src/layouts/BaseLayout.astro` 内联了营销页专用的 Header/Footer。

两套导航共用 `src/data/navigation.ts` 数据源以保持链接统一。语言判断统一基于路径是否以 `/en/` 开头。

### 文档内容与侧边栏

- 文档为 `.mdx`/`.md`，frontmatter 只需 `title` 与 `description`（Starlight schema，见 `src/content.config.ts`，Astro 6 Content Layer API）。
- 侧边栏在 `astro.sidebar.ts` 用 `slug`（不带前导斜杠）引用文档。新增文档后必须在此登记，否则不会出现在导航。
- 企业版专属条目附 `badge: enterpriseBadge`（绿色"企业版"标签）。全部条目均渲染，不做条件隐藏。
- 旧 `docs/` 链接重定向映射在 `astro.redirects.ts`（当前为空，按需追加）。

### Slug 约定（强制）

`src/content/docs/` 下所有文件名与目录名必须匹配 `^[a-z0-9-]+$`（英文 kebab-case，禁中文/大写），由 `pnpm lint:slugcheck` 强制。子目录如 `features/`、`api/`、`reference/` 用于分组。

### URL 尾斜杠

`astro.config.ts` 配置 `trailingSlash: 'always'`，所有 URL 以 `/` 结尾。`linkcheck` 据此把以 `/` 结尾的 href 解析为对应目录的 `index.html`。内部链接书写时保持带尾斜杠。

### 品牌样式变量

营销页品牌色单一来源在 `src/styles/global.scss` 的 `:root`：`--brand-primary`、`--brand-bg`、`--brand-text`、`--enterprise-badge`。组件以 `var(--brand-primary, #6653e3)` 形式引用，改品牌色只需改这一处。注意样式分层：营销页用 `--brand-*`，Starlight 文档页用 Starlight 自带的 `--sl-color-*` 体系（`global.scss` 不影响文档页）--两套变量不要混用。

## 部署备注

部署 workflow 监听 `master` 分支 push 触发 Cloudflare Pages 生产部署，PR 触发预览。注意当前默认开发分支为 `main`，且仓库主托管在 Gitee（Gitee 不运行 GitHub Actions）——该 workflow 文件保留以备镜像到 GitHub 后复用，Gitee 侧需改用 Gitee Go 或 Cloudflare Pages 直连。

`pnpm-workspace.yaml` 的 `allowBuilds` 白名单（`@parcel/watcher`、`esbuild`、`sharp`）是 pnpm 11 构建脚本放行配置，缺失会导致 `ERR_PNPM_IGNORED_BUILDS` 中断 `astro dev`。新增需要构建脚本的依赖时在此登记。
