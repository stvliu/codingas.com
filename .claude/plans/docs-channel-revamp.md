# 文档频道结构与内容优化计划

## 一、背景与目标

codingas.com 官网文档频道（Astro 6 + Starlight 0.40）当前 23 篇文档存在信息架构混乱、内容失真、样式偏离、核心内容缺失等问题。基于对 `E:\workspace\llm-gateway` 源码的交叉验证、硅基流动文档 IA、Astro/Starlight 官网样式的分析，**一次性**完成以下目标：

1. **样式对齐**：文档页回归 Starlight 默认主题，与 docs.astro.build 视觉一致（修复 dark mode 失效）
2. **IA 重组**：参照硅基流动五段式 + 管理员/开发者双视角分轨
3. **API 文档重构**：参照硅基流动按端点分页、场景×语言代码示例、端点页模板化
4. **内容优化**：修正硬伤、清理品牌、清理错位文档、新建缺失文档、扩充 stub
5. **品牌统一**：`LLM-Gateway` → `codingas.com`
6. **未实现功能**：集中移至"产品路线图"页，各功能清单移除 ✅ 误导

## 二、现状核心问题（已源码验证）

**样式**：`global.scss` 经 `customCss` 注入文档页，其 `body` 规则（白底深字）覆盖 Starlight reset，**dark mode 失效**；`astro.config.ts` title 仍为 `LLM-Gateway`。

**IA**：8 分组中多个仅 1 篇（分组层失效）；管理员/开发者视角未分轨；`astro.sidebar.ts:30` "代理配置" slug 重复指向 `provider-management`；"高级能力"全是未实现 stub 却只标企业版 badge；`features/model-plaza.mdx` 是含工时估算的内部设计稿；`features/index.mdx` 是行业科普+竞品列表。

**内容硬伤**：
- `api/api-spec.mdx` 1800 行结构崩坏（第七章管理 API 范畴错位、附录位置颠倒、JSON 缩进错位、章节编号与标题不符、与 provider-management 重复）
- Anthropic 端点路径错：文档写 `/v1/messages`，源码实际为 `/anthropic/v1/messages`（`ApiKeyAuthInterceptor.isProxyPath()` 验证）
- `priority` 语义矛盾：routing.mdx 说"数值越小越优先"，api-spec 第七章说"数值越大优先级越高"（源码 `PriorityRouter` 升序排序，待最终核对）
- `deploy.mdx` Docker 多模块路径警告**已过时**（Dockerfile 已是单模块 `gateway-boot` + `/actuator/health`）
- `token-quota.mdx` 自曝"配额扣减尚未接入请求链路"、`security.mdx` 自曝"PII 脱敏未接入"，但功能清单标 ✅
- 多处宣称未实现功能标 ✅：语义缓存、MCP、OAuth、模型智能降级（L2 已删除）、场景路由、模型别名、embeddings/images/audio/moderations 端点

**缺失**：无应用管理（Application 是 Key+渠道枢纽）、渠道管理（Channel 控制台 20+ 子功能）、模型清单/定价、控制台指南、错误码专页、产品路线图。

## 三、源码核对的关键事实（供内容撰写依据）

- **实际调用端点仅 3 个**：`/v1/chat/completions`、`/anthropic/v1/messages`、`/v1/models`；`/v1/completions`、`/v1/embeddings`、`/v1/images/*`、`/v1/audio/*`、`/v1/moderations` 均未实现
- **路由策略硬编码 `WEIGHTED`**（`OpenAIController`/`AnthropicController`），调用方无法选策略；`RoutingStrategy` 5 枚举中 `COST_OPTIMIZED`/`LATENCY_OPTIMIZED` 未启用
- **容灾三层 L0/L1/L3**（L2 模型降级已删除）；失败策略 `FAIL_FAST`/`FAIL_RETRY`/`FAIL_OVER`
- **应用是枢纽**：`ApplicationController` 提供 CRUD + `listApiKeys` + `listChannels`/`updateChannels`，承载 Key 归属、渠道可见性、`timeout`、`failureStrategy`
- **渠道功能极丰富**：`ChannelController`/`ChannelCredentialController`/`ChannelProvisionController` + 控制台 `Channels/` 20+ 子组件（创建向导、详情抽屉、熔断器、连通性测试、批量导入导出、模型映射、配额设置）
- **21 个内置供应商**：`data/builtin/vendors/`（openai/anthropic/google/deepseek/qwen/moonshot/zhipu/baichuan/minimax/tencent/volcengine/wenxin/xunfei/huawei/azure/aws-bedrock/360zhinao/lingyiwanwu/mistral/stepfun/xai）
- **管理 API 20 个 Controller**：Application/Channel/ChannelCredential/ChannelProvision/Provider/Model/ModelInstance/ModelDiscovery/PlanCatalog/User/UserApiKey/TokenLimit/Stats/ResilienceEvent/Auth/Me/Protocol/Experience/OpenAI/Anthropic
- **配置 6 Profile**：local(默认 H2 文件)/dev/prod/postgresql/standalone；Actuator 暴露 health/info/prometheus/metrics/traces
- **部署**：Docker（单模块正确路径）+ jlink 二进制（`deployments/package/`，jreleaser）
- **OpenAI 请求限制**：`OpenAIChatRequest.Message.content` 是 String（不支持 image_url 多模态）；无 `top_p`/`n`/`logit_bias`/`user` 字段；`tool_choice` 是 String
- **错误格式不一致**：协议端点错误返回 OpenAI/Anthropic 格式，其他异常返回 `ApiResponse` 格式
- **未实现**：语义缓存（无 pgvector）、MCP、OAuth、官方 SDK、LangChain4j（README 宣称但 pom 无依赖）

## 四、方案总览（5 部分，按依赖顺序）

| 部分 | 内容 | 依赖 |
|------|------|------|
| A | 样式对齐 Starlight 默认主题 | 无 |
| B | 信息架构重组（sidebar + redirects + 文件迁移） | A |
| C | 现有文档修正与品牌清理 | B |
| D | API 文档按端点拆分重构 | B、C |
| E | 新建缺失文档 + stub 扩充 + 路线图页 | C、D |

## 五、详细任务

### A. 样式对齐 Starlight 默认主题（与 docs.astro.build 一致）

**A1. `astro.config.ts`**
- 移除 `customCss: ['./src/styles/global.scss']`（解除文档页 body 污染，修复 dark mode）
- `title: 'LLM-Gateway'` → `'codingas.com'`
- 引入 `astro.redirects.ts` 到 Astro 原生 `redirects` 配置（当前 redirects.ts 是 dead code，未被引用）

**A2. `src/styles/global.scss`**
- 删除 `body { color: var(--brand-text); background: var(--brand-bg); font-family: ... }` 规则（污染源）
- 保留 `:root { --brand-* }` 变量定义 + `html { scroll-behavior: smooth }`

**A3. `src/layouts/BaseLayout.astro`**
- 已 `import '../styles/global.scss'`（第 9 行，营销页不受 A1 影响）
- 将原 body 样式以 scoped `<style>` 形式注入（营销页专用白底深字）

**A4. `CLAUDE.md` 更正**
- 第 59 行"global.scss 不影响文档页"→ 改为"移除 customCss 后，global.scss 仅经 BaseLayout 作用于营销页，文档页回归 Starlight 默认主题"

### B. 信息架构重组（参照硅基流动 + 双视角分轨）

**B1. 新目录结构与 sidebar 分组**

```
快速开始
  quickstart, deploy, console-guide(新)
开发者指南
  developer/{overview, auth-call, examples, models-pricing, playground, errors, sdk}
API 参考
  api/{chat-completions, messages, models, protocol-convert, admin-index}
管理员指南
  admin/{applications, channels, providers, users, apikeys, token-quota, security, routing, resilience, observability}
参考
  reference/{config, troubleshooting, faq, migration, changelog, roadmap}
```

**B2. `astro.sidebar.ts` 重写**为上述 5 分组（collapsed: true），企业版 badge 保留并精确标注（仅代理配置等真正企业版且规划中的项）。

**B3. 文件迁移映射**（旧 → 新，slug 由文件路径决定）：
- `api-gateway` → `developer/overview`
- `api/examples` → `developer/examples`
- `api/api-spec` → 拆为 `api/chat-completions` 等（主入口 chat-completions）
- `auth` → `admin/users`
- `apikey-management` → `admin/apikeys`
- `token-quota` → `admin/token-quota`
- `security` → `admin/security`
- `observability` → `admin/observability`
- `provider-management` → `admin/providers`
- `features/routing` → `admin/routing`
- `features/resilience` → `admin/resilience`
- `features/model-plaza` → `developer/models-pricing`（重写）
- `features/index` → 删除（行业科普，无用户价值）
- `features/semantic-cache`、`features/mcp-protocol` → 删除，内容移入 `reference/roadmap`
- `sdk` → `developer/sdk`
- `troubleshooting`/`faq`/`migration`/`changelog` → `reference/*`
- `reference/config` 保持

**B4. `astro.redirects.ts`** 填入旧 slug → 新 slug 映射，并在 `astro.config.ts` 通过 Astro 原生 `redirects` 接入（避免外链断链）。

### C. 现有文档修正与品牌清理

**C1. 全局品牌替换**：`LLM-Gateway` → `codingas.com`（所有 .mdx + astro.config.ts + `src/components/starlight/*` + `src/data/navigation.ts`）。保留 git 历史/迁移说明中的引用。

**C2. 修正硬伤**：
- `deploy.mdx`：删除 Docker 多模块过时警告；补 jlink 二进制部署（`deployments/package/`）；补 6 Profile 说明；明确健康检查 `/actuator/health`
- `admin/routing`（原 features/routing）：统一 `priority` 语义（对照 `PriorityRouter` 源码定稿）；澄清"路由策略（WEIGHTED 硬编码）"与"失败策略（FAIL_FAST/RETRY/OVER）"两个层级；移除未实现的 COST_OPTIMIZED/LATENCY_OPTIMIZED/场景路由/模型别名（移路线图）
- `admin/token-quota`：显著标注"配额扣减尚未接入请求链路"；移除功能清单 ✅ 误导；补 `StatsController` 用量查询 API 实况
- `admin/security`：标注 PII 脱敏未接入、IP 黑名单走控制台；移除未实现的 IP 白名单/UA 过滤/内容审核/国密/WORM（移路线图）
- `admin/observability`：补 Actuator 端点清单（health/info/prometheus/metrics/traces）、Prometheus metric、logback 日志格式、Trace；修正 Grafana 矛盾（标企业版规划中）
- `developer/examples`（原 api/examples）：修正 Anthropic 路径 `/v1/messages` → `/anthropic/v1/messages`；补 base_url 差异说明
- `admin/users`（原 auth）：OAuth 整段移路线图；补 ADMIN/USER 角色权限矩阵；保留 Sa-Token 会话 + API Key 双认证

**C3. 清理错位文档**：
- `features/model-plaza.mdx`：删除内部设计稿（工时表/Sprint 规划/前端代码片段），重写为 `developer/models-pricing`
- `features/index.mdx`：删除行业科普 + 竞品列表

**C4. stub 扩充**：
- `reference/changelog`：补 Flyway 迁移线（V1→V68 演进）、实际能力版本
- `developer/sdk`：补 LangChain/LlamaIndex/Dify 第三方集成示例（用 OpenAI 兼容 base_url）
- `reference/migration`：补真实升级步骤（Flyway baseline、加密密钥兼容、Profile 变化）

### D. API 文档按端点拆分重构（参照硅基流动）

**D1. 拆分 `api/api-spec.mdx`**（1800 行）为按端点独立页，每页统一模板：
- 端点与方法
- 认证（Header：`Authorization: Bearer` / `x-api-key`）
- 请求参数表
- 响应体
- HTTP 状态码（400/401/403/429/502/503/504 **就地全列**，带示例响应）
- 场景示例（Default/Streaming/Function × cURL/Python/JavaScript，用 Starlight `<Tabs>` 组件）

**D2. 端点页**：
- `api/chat-completions`（`/v1/chat/completions`，OpenAI 兼容）
- `api/messages`（`/anthropic/v1/messages`，Anthropic 兼容）
- `api/models`（`/v1/models`）
- `api/protocol-convert`（OpenAI ↔ Anthropic 互转，`ProtocolConverter`）
- `api/admin-index`（管理 API 索引，链接到管理员指南各章）

**D3. 修正 api-spec 错误**：
- Anthropic 路径修正
- 第七章管理 API 移出（并入管理员指南各章）
- 修 JSON 缩进、章节编号、priority 语义
- 移除未实现端点（embeddings/images/audio/moderations/completions）
- 标注 OpenAI 多模态限制（content 是 String）+ 不支持字段（top_p/n/logit_bias/user）
- 说明错误格式不一致（协议端点 OpenAI/Anthropic 格式 vs 其他 ApiResponse 格式）

### E. 新建缺失文档

- `admin/applications`：Application 聚合根（Key 归属 + 渠道可见性 + timeout + failureStrategy）；`ApplicationController` CRUD + listApiKeys + listChannels/updateChannels；控制台 Applications 页操作
- `admin/channels`：渠道概念（Provider + Endpoint + Credential + ModelMapping）；3 个 Channel Controller；控制台 20+ 子功能（创建向导/详情抽屉/熔断器/连通性测试/批量导入导出/模型映射/配额设置）
- `developer/models-pricing`：21 内置供应商清单；模型能力矩阵（vision/functionCalling/streaming）；`PlanCatalogController` 定价查询；`/v1/models` 模型发现
- `console-guide`：9 大控制台页面导览（Dashboard/Quickstart/Applications/Channels/Models/Users/ApiKeys/Catalog/Resilience）；Admin/User 视图
- `developer/errors`：错误码字典（HTTP 400/401/403/404/429/500/502/503）；三种错误格式；`RetryExecutor` 重试策略；`ProviderErrorType`
- `reference/roadmap`：集中未实现功能（语义缓存、MCP、OAuth、模型智能降级、场景路由、模型别名、embeddings/images/audio 端点、PII 脱敏接入、IP 白名单/UA/内容审核/国密/WORM、Grafana/Jaeger、官方 SDK），标注规划状态
- `admin/providers`（重写）：21 内置供应商；Provider API Key 管理 API（修正路径矛盾 `/api/v1/provider-api-keys` vs `/api/v1/providers/{id}/keys`）；代理配置标企业版规划中；多 Key 轮换、健康状态

## 六、文件变更清单

**新增（15 篇）**：`console-guide`、`developer/{overview,auth-call,examples,models-pricing,playground,errors,sdk}`、`api/{chat-completions,messages,models,protocol-convert,admin-index}`、`admin/{applications,channels,providers,users,apikeys,token-quota,security,routing,resilience,observability}`、`reference/{config,troubleshooting,faq,migration,changelog,roadmap}`（部分为迁移）

**删除**：`features/` 整目录（6 篇，迁出或重写）、原 `api/api-spec.mdx`（拆分）、原 `api/examples.mdx`（迁移）、顶层散落文档（迁入新目录）

**修改**：`astro.config.ts`、`astro.sidebar.ts`、`astro.redirects.ts`、`src/styles/global.scss`、`src/layouts/BaseLayout.astro`、`CLAUDE.md`、`src/components/starlight/*`、`src/data/navigation.ts`

## 七、验收标准

1. `pnpm lint:slugcheck` 通过（所有文件名 kebab-case）
2. `pnpm build` 成功
3. `pnpm lint:linkcheck` 通过（无断链，旧 slug 重定向生效）
4. 文档页 dark mode 正常，视觉与 docs.astro.build 一致
5. 全站无 `LLM-Gateway` 残留（除迁移说明/git 历史）
6. 未实现功能不再标 ✅，集中到 `reference/roadmap`
7. API 文档按端点分页，每页含场景×语言示例与全量状态码
8. 管理员/开发者视角分轨清晰，新用户有明确阅读路径

## 八、执行说明

工程量大（约 25 篇文档 + 样式 + IA + API 重构）。实现阶段按 A→B→C→D→E 顺序推进，每完成一部分跑一次 `slugcheck` + `build` + `linkcheck` 局部验证。内容撰写以本计划"三、源码核对的关键事实"为事实依据，避免再次引入文档与源码不符的错误。
