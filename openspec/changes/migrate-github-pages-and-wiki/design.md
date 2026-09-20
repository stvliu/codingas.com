# Design: migrate-github-pages-and-wiki

## Context

现状：官网主托管 Gitee（`stvliu/codingas.com`），部署走 Cloudflare Pages；GitHub Actions workflow 文件保留备用。探索阶段实测事实：

- 31 个文档全部 `.mdx`，仅 3 个使用 Starlight 组件（且只有 `Tabs`/`TabItem` 语言切换一种模式）；0 处图片/相对资源引用；约 40+ 处根相对站内链接（含 1 处指向营销页 `/contact-us/`）。
- **用户决策：官网源码不上 GitHub，官网部署维持 Cloudflare Pages 现状** —— 本变更聚焦文档 Wiki 镜像轨。
- GitHub `stvliu/llm-gateway` 公开、Wiki 未初始化（`.wiki.git` 尚不存在）；Gitee `ezxbao_liuye/llm-gateway` 已存在（与 GitHub 同提交的产品代码镜像），Wiki 已激活（`master` = `6650c96`）。
- GitHub Wiki 与 Gitee Wiki 同宗 Gollum：均支持子目录页面、根级 `_Sidebar.md`、默认首页 `Home`、相对 markdown 链接解析为同 wiki 页面。

## Goals / Non-Goals

**Goals:**

- 文档双路镜像到 GitHub 与 Gitee 的 `llm-gateway` Wiki：开发者就近阅读、Gitee 轨兜底大陆可达性、承接搜索引擎收录。
- 导出确定性、可校验（断链即失败）；同步幂等（无差异不推送）。
- 官网（codingas.com）与主站部署链路零改动。

**Non-Goals:**

- 不迁移官网部署（Cloudflare Pages / DNS / GitHub Pages 均不动）。
- 不改造文档内容格式（MDX 源保持现状，转换只在导出层发生）。
- 本期不做 CI 自动化同步（先本地手动跑通，自动化为后续独立需求）。
- 不做产品代码仓库的任何变更。

## Decisions

1. **官网源码不上 GitHub，Pages 轨放弃（用户决策）。**
   官网部署与源码托管维持现状。备选"仅推送构建产物到 GitHub Pages 分支"因每次发布依赖 GitHub 网络可达（实测存在断连时段）而被排除。
2. **Wiki 落点选产品仓库 `llm-gateway`（GitHub `stvliu` / Gitee `ezxbao_liuye`，用户决策）。**
   文档语义上属于产品；开发者浏览仓库时点 Wiki 就地阅读，无需跳站。两侧仓库同名，认知一致。
3. **同步执行模型：本地手动脚本（用户决策）。**
   导出（`export-wiki.mjs`，含断链自校验）与推送（单 commit 覆盖式推送双 wiki）封装为 pnpm 脚本，文档变更后一步执行。凭据走本地 git 凭据管理器（GitHub 用 `stvliu` 凭据，Gitee 用 `ezxbao_liuye` 的 PAT/SSH）。备选 Gitee Go 自动化：免费构建时长有限，且其 runner 推 GitHub wiki 同样受网络影响，本期排除、后续可再评估。
4. **一份导出逻辑、按落点差异化过滤，链接采用"标准 markdown 相对链接"公分母格式。**
   页面按侧边栏分组入目录、文件名用中文 title（Gitee 页面树直接显示中文导航，用户反馈驱动）；正文链接为相对当前页的 markdown 链接（跨目录带 `../`，target 空格编码 `%20` —— CommonMark destination 不允许空格，Gollum 标准解码）；`_Sidebar.md` 为 GitHub 侧栏机制专用、用不随当前页漂移的 wikilink，Gitee 落点排除 `_Sidebar.md`/`_Footer.md`（其页面树会将其显示为噪音且渲染支持未证实）。
5. **`Tabs`/`TabItem` 降级为 `### <标签名>` 分节标题，代码块原样保留。**
   三个 API 文档中的 Tabs 仅用于语言切换（cURL/Python/JS），分节标题是最贴近原文结构的无损降级；Wiki 场景下读者全量浏览而非切换，无需交互。
6. **侧边栏数据抽为 Node 可直接加载的单一来源 `astro.sidebar.mjs`。**
   `astro.sidebar.ts` 是无类型标注的纯数据数组，可安全抽为 `.mjs`；`astro.sidebar.ts` 保留为 re-export（`astro.config.ts` import 路径不变），`export-wiki.mjs` 直接 `import` 该 `.mjs` 生成 `_Sidebar.md` —— 避免 regex 解析 TS 的脆弱方案，保证"改一处、两侧同步"。
7. **链接改写规则（转换器内实现）：**
   - 指向文档页的根相对链接 `](/developer/errors/` → `](developer/errors`（去前导斜杠与尾斜杠，映射为 wiki 相对链接）。
   - 指向营销页等非文档路径（如 `/contact-us/`）→ 改写为 `https://codingas.com/contact-us/` 绝对 URL。判定依据：目标 slug 是否存在于文档集（以 `src/content/docs` 文件清单为准），不在则视为站外页面。
8. **frontmatter 处理：剥离全部 YAML，`title` 转为文档首个 H1，`description` 丢弃。**
   两侧 Wiki 都会把 YAML frontmatter 当正文渲染，必须剥离；title 是页面名与导航依据，落为 H1 保证无头文档可读。
9. **幂等推送。**
   推送脚本以产物 diff 为准：无差异跳过（不产生空 commit）；有差异以单个同步 commit 覆盖推送；任一落点失败非零退出并指明落点，另一落点成败独立呈现。

## Risks / Trade-offs

- [手动同步可能被遗忘，文档更新后 wiki 漂移] → `pnpm wiki:push` 一步脚本降低执行成本；CLAUDE.md 写入流程约定；`_Footer.md` 标注"文档以 https://codingas.com 为准"；后续可升级为 CI 自动化。
- [本地推送 GitHub wiki 依赖网络可达（实测存在断连时段）] → 推送失败重试/换时段执行；两落点独立呈现，Gitee 轨不受影响。
- [双平台 Wiki 渲染差异（表格/代码高亮细节）] → 转换器只输出 GFM 公共子集；首推后人工抽查代表页。
- [Wiki 可被有权限者误编辑造成漂移] → 流程约定：wiki 只读，改动一律回主仓文档源；同步脚本下次运行覆盖。
- [Gitee PAT 为本地凭据] → 最小权限（`projects` scope），存本地凭据管理器，不进仓库、不进代码。

## Migration Plan

1. 本地实现：`astro.sidebar.mjs` 抽取 → `export-wiki.mjs` 导出器与自校验 → 推送封装（全部在本仓库，不影响主站）。
2. 一次性操作：GitHub `llm-gateway` 网页端初始化 Wiki（创建 `Home` 页激活 `.wiki.git`）；准备两落点本地凭据。
3. 首次同步推送 → 人工抽查两平台代表页渲染。
4. 无回滚需求（主站零改动）；wiki 漂移时重跑同步即可恢复。

## Open Questions

- wiki 同步自动化（Gitee Go 或其他执行位置）留待后续独立需求，先以本地手动脚本验证导出质量与维护成本。
