# wiki-export 规格增量

## ADDED Requirements

### Requirement: 目录与文件映射
导出器 SHALL 将 `src/content/docs/` 下所有 `.mdx`/`.md` 映射为 wiki 页面：目录 = 该文档在侧边栏数据中的分组名（去空格），文件名 = frontmatter `title`（中文页面名，保留空格，强制全局唯一且不含文件名非法字符）；slug 到 wiki 路径的映射以侧边栏数据为单一来源。

#### Scenario: 分组目录与中文页面名
- **WHEN** 对含 `api/chat-completions.mdx`（title "对话补全 API"，属 "API 参考" 组）的文档集执行导出
- **THEN** 产物中存在 `API参考/对话补全 API.md`；全部页面落在其分组目录下，无英文 slug 文件名

#### Scenario: title 冲突报错
- **WHEN** 两篇文档的 title 相同
- **THEN** 导出以非零码失败并指明冲突的来源文件

### Requirement: frontmatter 剥离与标题转换
导出器 SHALL 剥离全部 YAML frontmatter，并将 frontmatter 的 `title` 值渲染为文档第一个 H1 标题。

#### Scenario: frontmatter 剥离
- **WHEN** 导出含 `title`/`description` frontmatter 的文档
- **THEN** 产物正文不含 YAML 分隔块，首行为 `# <title>`，`description` 不出现在产物中

### Requirement: MDX 组件降级
导出器 SHALL 将 `Tabs`/`TabItem` 结构降级为按 `TabItem` 标签划分的 `### <标签名>` 分节标题（子内容原样保留）；遇到其他 JSX 组件或无法识别的 MDX 语法 MUST 以非零码报错退出，SHALL NOT 静默输出损坏内容。

#### Scenario: Tabs 降级
- **WHEN** 导出含 `<Tabs>`/`<TabItem label="Python">` 的文档
- **THEN** 产物以 `### Python` 分节，节内为原 TabItem 内容，无 JSX 残留

#### Scenario: 未知组件报错
- **WHEN** 文档中出现导出器不支持的 JSX 组件
- **THEN** 导出以非零码失败，错误信息指明文件与行号

### Requirement: 站内链接改写
导出器 SHALL 将指向文档页的根相对链接（`](/developer/errors/` 形式）改写为相对当前页的 wiki 链接（跨目录带 `../` 前缀，target 中空格编码为 `%20`）；指向非文档站内路径（如 `/contact-us/`）MUST 改写为 `https://codingas.com/` 前缀的绝对 URL。判定依据为该 slug 是否存在于文档集。

#### Scenario: 文档间链接改写
- **WHEN** `管理员指南/渠道管理` 页面含 `](/developer/errors/)`
- **THEN** 产物中为 `](../开发者指南/错误码与重试)`，且目标 wiki 页面存在

#### Scenario: 链接 target 空格编码
- **WHEN** 改写后的目标页面名含空格（如 `Provider 管理`）
- **THEN** 产物链接 target 中空格呈现为 `%20`（如 `](Provider%20管理)`）

#### Scenario: 营销页链接改写
- **WHEN** 文档含 `](/contact-us/)`
- **THEN** 产物中为 `](https://codingas.com/contact-us/)`

### Requirement: 导航与包装页生成
导出器 SHALL 依据侧边栏数据单一来源生成：`_Sidebar.md`（GitHub 侧栏机制，条目用 `[[wiki路径|label]]` wikilink 绝对引用，不随当前页漂移）、`_Footer.md`（标注"文档以 https://codingas.com 为准"及主站链接）与 `Home.md`（文档首页入口，链接用页面路径）。

#### Scenario: 侧边栏生成
- **WHEN** 对现有 5 分组 31 条目的侧边栏数据执行导出
- **THEN** `_Sidebar.md` 包含全部分组标题与 31 个 wikilink，且每个链接目标存在于产物中

### Requirement: 导出产物自校验
导出完成时 SHALL 扫描产物内所有 wiki 内部链接，任一断链 MUST 以非零码退出并列出断链清单；全部通过时输出产物统计（页面数、生成文件清单）。

#### Scenario: 断链检测
- **WHEN** 产物中存在指向不存在页面的相对链接
- **THEN** 导出命令以非零码退出，输出列出该链接的来源文件与目标
