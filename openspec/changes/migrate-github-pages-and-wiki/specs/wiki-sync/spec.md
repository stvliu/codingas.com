# wiki-sync 规格增量

## ADDED Requirements

### Requirement: 单向镜像
两处 Wiki（GitHub 与 Gitee 的 `llm-gateway`）的内容 SHALL 仅由同步脚本从官网文档源（本仓库 `src/content/docs/`）导出的产物生成；Wiki 定位为只读镜像，内容变更一律回到文档源。

#### Scenario: 源变更传导
- **WHEN** 修改任一文档并运行同步脚本
- **THEN** 两处 Wiki 与导出产物一致，人工对 wiki 的直接编辑被覆盖

### Requirement: 双落点推送
同步脚本 SHALL 将导出产物推送到 `stvliu/llm-gateway.wiki.git`（GitHub）与 `gitee.com/ezxbao_liuye/llm-gateway.wiki.git`（Gitee），并按落点差异化过滤：GitHub 全量（含 `_Sidebar.md`/`_Footer.md`，依赖其侧栏/页脚机制）；Gitee 排除 `_Sidebar.md` 与 `_Footer.md`（其页面树会将其显示为噪音）。推送凭据来自本地 git 凭据（GitHub 为 `stvliu` 凭据，Gitee 为 `ezxbao_liuye` 的 PAT/SSH）；任一落点推送失败 MUST 使脚本以非零码退出并指明失败落点，另一落点的推送结果独立呈现。

#### Scenario: Gitee 落点不含系统页
- **WHEN** 同步完成
- **THEN** Gitee wiki 中不存在 `_Sidebar`、`_Footer` 页面，GitHub wiki 中存在

#### Scenario: Gitee 推送失败可见
- **WHEN** Gitee wiki 推送被拒绝（如 token 失效）
- **THEN** 脚本以非零码退出并输出失败落点为 Gitee；GitHub 落点的推送结果独立报告

### Requirement: 幂等推送
同步 SHALL 以产物 diff 为准：导出结果与 wiki 当前内容无差异时 MUST NOT 产生新 commit 或空推送；有差异时以单个同步 commit 覆盖更新。

#### Scenario: 无变更不推送
- **WHEN** 文档未变更的情况下运行同步脚本
- **THEN** 两处 wiki 均无新 commit，脚本成功结束
