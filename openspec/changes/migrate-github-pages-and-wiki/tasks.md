# Tasks: migrate-github-pages-and-wiki

> 官网部署维持 Cloudflare Pages 现状，全部任务仅涉及文档 wiki 镜像轨。

## 1. Wiki 导出器（scripts/export-wiki.mjs）

- [x] 1.1 侧边栏数据抽为 `astro.sidebar.mjs` 单一来源，`astro.sidebar.ts` 改为 re-export，`pnpm build` 验证侧边栏渲染不变
- [x] 1.2 实现导出骨架：读取 `src/content/docs` 清单，按 slug 映射到导出目录（`developer/errors.mdx` → `developer/errors.md`）
- [x] 1.3 frontmatter 剥离：YAML 全部移除，`title` 渲染为首行 H1
- [x] 1.4 `Tabs`/`TabItem` 降级为 `### <标签名>` 分节（子内容保留）；遇到其他 JSX 组件以非零码报错并指明文件与行号
- [x] 1.5 链接改写：文档页根相对链接 → wiki 相对链接（去前导/尾斜杠）；非文档路径（如 `/contact-us/`）→ `https://codingas.com/` 绝对 URL
- [x] 1.6 生成 `_Sidebar.md`（源自 sidebar 单一来源，5 分组 31 条目）、`_Footer.md`（标注"文档以 https://codingas.com 为准"）、`Home.md`（产品简介 + 文档入口）
- [x] 1.7 实现产物自校验：扫描产物内 wiki 内部链接，断链时非零退出并列出来源与目标；通过时输出页面数统计
- [x] 1.8 `package.json` 登记导出脚本；对全部 31 篇执行导出并人工抽查代表页：3 个含 Tabs 的 API 文档、`quickstart`、`reference/roadmap`（含 `/contact-us/` 链接）
- [x] 1.9 侧栏优化（用户反馈）：页面按侧边栏分组目录 + 中文 title 命名（Gitee 页面树显示中文）；链接 target 空格编码 `%20`；`_Sidebar.md` 改用 wikilink 绝对引用；Gitee 落点排除 `_Sidebar.md`/`_Footer.md`
- [x] 1.10 aside 降级（代码审查后补）：Starlight aside（`:::`/`::::`）降级为 blockquote（标题行 `**<标题>**` + 块内容 `>` 前缀，嵌套叠加深度；无标题按类型映射，未闭合/孤立闭行/未知类型报错）；同步补 wiki-export spec 的 Requirement 与 Scenario

## 2. 本地双路同步

- [x] 2.1 推送封装（`pnpm wiki:push`）：将导出目录内容以单个同步 commit 推送到 `stvliu/llm-gateway.wiki.git` 与 `gitee.com/ezxbao_liuye/llm-gateway.wiki.git`；产物无差异时跳过（无空 commit）；任一落点失败以非零码退出并指明落点，两落点结果独立报告
- [x] 2.2 更新 `CLAUDE.md`：新增 wiki 同步流程章节（文档变更后执行 `pnpm wiki:push`；脚本落点、凭据要求、断链自检说明）

## 3. 一次性操作（非代码）

- [ ] 3.1 GitHub `stvliu/llm-gateway` 网页端初始化 Wiki（创建标题为 `Home` 的首页面激活 `.wiki.git`）——Gitee 侧已激活（`master` = `6650c96`），无需操作
- [ ] 3.2 准备本地推送凭据：GitHub（`stvliu` 对 `llm-gateway.wiki.git` 的 PAT 或 SSH）与 Gitee（`ezxbao_liuye` 勾选 `projects` scope 的 PAT 或 SSH），配置到本地 git 凭据管理器

## 4. 首推与验证

- [ ] 4.1 首次 `pnpm wiki:push` 并验证：GitHub 与 Gitee 的 wiki 页面渲染、`_Sidebar.md` 生效、文档间链接跳转、`_Footer.md` 展示、Home 入口
- [ ] 4.2 人工抽查双平台渲染一致性（代表页：含 Tabs 降级的 API 文档、含表格的页面、含代码块的页面）
