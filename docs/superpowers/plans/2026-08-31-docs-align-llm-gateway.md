# 文档站对齐 llm-gateway 代码事实 实施计划

> **For agentic workers:** 本仓库无单元测试框架，质量门为 `pnpm lint:slugcheck` + `pnpm build` + `pnpm lint:linkcheck`（见项目 CLAUDE.md）。按任务顺序执行，每个任务完成后勾选。

**Goal:** 让 codingas.com 文档站（src/content/docs 31 篇）与营销页事实性声明与 E:\workspace\llm-gateway 代码（1.0.0-SNAPSHOT，2026-08-31）完全一致。

**Architecture:** 只改内容不改结构：不新增/删除/重命名文档文件，slug 与侧边栏不变；营销页只改 `src/data/` 下的文案数据（页面组件不动）。

**Tech Stack:** Astro 6 + Starlight 0.40 文档；i18n 文案在 `src/data/i18n/*.ts` 与 `src/data/homeFeatures.ts`、`src/data/homeEcosystem.ts`。

## Global Constraints

- 品牌 P0 占位**一律不动**：`github.com/stvliu/llm-gateway` 链接、`P0 占位` 注释、`biz@codingas.com (placeholder)`、ICP 备案等，留待域名/截图确定后统一处理。
- 内部链接保持尾斜杠（`trailingSlash: 'always'`）。
- 文档语言：简体中文；slug 全部已是 kebab-case，不改文件名。
- 所有事实以下列代码结论为准（均已验证到 file:line）：
  - 端点：`/v1/chat/completions`、`/anthropic/v1/messages`、`/v1/models`（仅此 3 个数据面端点）；管理 API 前缀 `/api/v1`。
  - 错误体三种格式：拦截器 401 `{"code":"UNAUTHORIZED","message":...}`、403 `{"code":"ACCESS_DENIED","message":...}`（AbstractGatewayInterceptor.java:59,70,76）；429 `{"error":{"code":"RATE_LIMIT_EXCEEDED","message":"请求过于频繁，请稍后重试"}}`（RateLimitInterceptor.java:66）；异常处理器统一 ApiResponse `{success,data,error:{code,message,details},traceId,timestamp}`（GlobalExceptionHandler.java + ApiResponse）。
  - 502 UpstreamException code=错误类型名（如 `UPSTREAM_ERROR`/`MODEL_NOT_FOUND`）；503 熔断 code=`UPSTREAM_ERROR`（CircuitOpenException extends UpstreamException(UPSTREAM_ERROR)）；404 `NOT_FOUND`、409 `CONFLICT`、400 `VALIDATION_ERROR`/`BAD_REQUEST`、500 `INTERNAL_ERROR`。
  - `invalid_api_key`/`permission_denied`/`overloaded_error` 等字符串**不是**通用 HTTP 错误码（仅存在于 SSE 流式错误 chunk 的 SseErrorFormatter 与上游模拟器）。
  - 重试：不可重试 = QUOTA_EXCEEDED、AUTHENTICATION_ERROR、INVALID_REQUEST、MODEL_NOT_FOUND（RetryExecutor.java:130）；策略映射 RATE_LIMIT_ERROR→限流退避(5次/2s起/60s封顶/jitter0.25)、TIMEOUT_ERROR→快速、UPSTREAM_ERROR/SERVICE_UNAVAILABLE→服务不可用(3次/固定5s)、其余→指数退避(3次/1s起/×2)（RetryExecutor.java:111-121）。
  - 故障转移分流（ErrorClassifier.java:57-75）：L1 转移 = AUTHENTICATION_ERROR/RATE_LIMIT_ERROR/QUOTA_EXCEEDED/TIMEOUT_ERROR/UPSTREAM_ERROR/SERVICE_UNAVAILABLE/NETWORK_ERROR；NONE = INVALID_REQUEST/MODEL_NOT_FOUND/UNKNOWN_ERROR。
  - 加密密钥：`ENCRYPTION_KEY_MISSING` 真实存在（Aes256Encryptor.java:91）；**生产 profile 下 yml 无 `GATEWAY_ENCRYPTION_KEY` 映射**（仅 application-local.yml:58 有），实际生效顺序 = `gateway.security.encryption-key` 属性 → env `ENCRYPTION_KEY` → 非开发环境抛 ENCRYPTION_KEY_MISSING（Aes256Encryptor.java:47,57,88-95）。
  - stats 真实：call_logs 含 inputTokens/outputTokens（CallLog.java:42-43），`GET /api/v1/stats`（provider/channel/model/user 计数 + 今日请求数/Token）、`GET /stats/trend?days=`、`GET /stats/model-usage?limit=`（StatsService.java:57-113）。
  - TokenLimit：exceededAction=`REJECT`/`DOWNGRADE`（ExceededAction.java），periodType=`DAILY`/`WEEKLY`/`MONTHLY`/`TOTAL`（PeriodType.java），limitType=`SYSTEM_DEFAULT`/`USER_CUSTOM`、state=`ACTIVE`/`SUSPENDED`、switchModel 字段；**运行时扣减/校验不存在**。
  - `GET /v1/models` 响应 `ownedBy` 恒为 `"system"`（ModelDiscoveryResponse.java:47）；无 query 参数。
  - 渠道列表过滤 `providerId`/`billingMode`/`sortBy`/`sortOrder`（ChannelController.java:87-90）；复制渠道 `POST /api/v1/channels/{id}/copy`；模型复制 `POST /api/v1/models/{id}/copy`、解锁 `POST /models/{id}/unlock`、状态 `PATCH /models/{id}/state`；凭证详情含明文（ChannelCredentialController.java:45）；`GET /api/v1/user-api-keys/{id}/detail` 存在；UserApiKey 实体无额度/白名单/IP/过期字段。
  - 新管理端点：`/api/v1/audit-logs`（GET 分页 + DELETE 清理）、`/api/v1/settings`（GET + PUT /{key}）、`/api/v1/catalog/sync`（POST + GET /status）、`GET /api/v1/auth/me` + `PATCH /api/v1/auth/me/password`（MeController 仅 `GET /api/v1/me/api-keys`）。
  - 控制台 12 页面：dashboard/channels(providers 已并入)/models/keys/quickstart/catalog/users/applications/resilience/audit-logs/token-limits/settings；React 19 + antd 6 + zh-CN/en-US 双语；ApiKeys 页无额度/白名单/IP/过期功能；渠道页有复制按钮与 YAML 批量导出（不含明文）。
  - Flyway 迁移 **V1~V70**（V68 应用失败策略、V69 模型目录同步字段、V70 system_settings）。
  - 打包：Gradle ospackage deb/rpm + Windows zip（install.ps1，非 exe），**不内置 JRE**（需 Java 17/21/25），构建 `./deployments/package/build.sh`；`deployments/docker/.env.example` **不存在**。
  - 内置 21 家供应商（data/builtin/vendors/，164 个预置模型）+ catalog/model-specs.json 74 个模型规格、plans.json 34 个套餐。
  - 控制台能力筛选（vision/functionCalling）在 Catalog/Models/渠道快速接入页，Quickstart 页无该筛选。
  - TraceId：数据面 UUID 写入 call_logs 与日志；**无响应头**返回（SseStreamHelper 仅设 Cache-Control/X-Accel-Buffering）。
  - 熔断参数为内置默认（滑动窗口 10、失败率 0.5、OPEN 30s、半开 3 次，ChannelEndpointCircuitBreakerService.java:33-36 硬编码）。
  - 代理（HTTP/SOCKS5）支持不存在；国密/PII 执行/内容审核/OAuth/语义缓存/MCP 均不存在（规划中）。
  - 自定义指标：`gateway.failover.triggered`、`gateway.failover.exhausted`（KeyFailoverInvoker.java:86,94）、`gateway.retry.exhausted`（RetryExecutor.java:79）。
  - 配置：hikari 10/5、server.address 0.0.0.0、Sa-Token timeout 7200/Bearer/Authorization、webclient 5s/60s、flyway baseline-on-migrate+validate、H2 console /h2-console（local web-allow-others=true）、`gateway.init.demo-data-enabled` 默认 false（local/dev=true）、`gateway.security.rate-limit.{bucket-size:100,refill-rate:10,qps-threshold:1000}`、actuator 暴露 health,info,prometheus,metrics,traces。

---

### Task 1: quickstart.mdx + deploy.mdx + console-guide.mdx（快速开始组）

**Files:** `src/content/docs/quickstart.mdx`、`src/content/docs/deploy.mdx`、`src/content/docs/console-guide.mdx`

- [ ] quickstart：上游配置指引「【Provider 管理】」→「【渠道管理】」（控制台 providers 页已重定向到 channels）
- [ ] deploy：安装包段落重写——删「jlink 定制 JRE + jreleaser」，改为 Gradle ospackage 打包 deb/rpm/Windows zip（Windows 为 zip + `bin\install.ps1`，非 exe）、不内置 JRE（目标机需 Java 17/21/25）、构建命令 `./deployments/package/build.sh`、Linux 安装 `apt install ./llmgateway_*.deb` / `dnf install ./llmgateway-*.rpm`（自动拉取 JRE 依赖）
- [ ] deploy：加密密钥段落修正——生产（postgresql/prod profile）设 env `ENCRYPTION_KEY`（Base64 32 字节）；注明 `GATEWAY_ENCRYPTION_KEY` 仅 local profile 的 yml 映射生效；`ENCRYPTION_KEY_MISSING` 行为保留；dev/local 临时密钥警告保留
- [ ] deploy：环境变量表补 `ENCRYPTION_KEY`；删除「完整清单见 `deployments/docker/.env.example`」引用（该文件不存在），改为「完整占位符见 `gateway-boot/src/main/resources/application.yml` 的 `${ENV:default}`」
- [ ] deploy：Actuator 端点列表补 `/actuator/metrics`、`/actuator/traces`
- [ ] console-guide：「9 大功能模块」→「12 个功能模块」，模块清单改为：仪表盘、渠道管理（原 Provider 入口已并入，含创建向导/复制/批量导入导出 YAML/连通性测试/熔断按钮/凭证/端点/模型映射/配额）、模型管理（复制/解锁/DEPRECATED 废弃标签）、调用方密钥、Quickstart 体验、模型目录 Catalog（能力筛选在此页）、用户管理（角色/状态/重置密码）、应用管理、容灾总览、审计日志、Token 限额、系统设置（`/api/v1/settings`）；删 ApiKeys 模块「配置额度、模型白名单、IP 限制、过期时间」表述
- [ ] console-guide：补一句控制台支持中文/English 界面切换

### Task 2: developer/ 组 7 篇

**Files:** `overview.mdx`、`auth-call.mdx`、`examples.mdx`、`models-pricing.mdx`、`playground.mdx`、`errors.mdx`、`sdk.mdx`

- [ ] auth-call：删「可选配置：额度限制、模型白名单、IP 限制、过期时间」，改为「Key 创建时绑定用户与应用；模型可见范围由应用-渠道授权决定」（UserApiKey.java:33-54 无此类字段）
- [ ] models-pricing：「21 个供应商」保留；补「内置模型目录另含 70+ 模型规格（`gateway-boot/src/main/resources/catalog/model-specs.json`）」；「控制台与 Plan Catalog API 支持按能力筛选」→「控制台模型目录（Catalog）页面与 `GET /api/v1/plan-catalogs/models` 支持按能力标签筛选」
- [ ] playground：补说明「控制台 Playground 通过管理面体验端点 `POST /api/v1/experience/chat`（SSE）直连指定渠道调用」（ExperienceController.java:51-56）
- [ ] examples：状态码速查表补 404 行（与 errors.mdx 一致）
- [ ] errors（重写错误格式与重试两节）：
  - 校验错误：OpenAI/Anthropic 两种格式保留
  - 拦截器短路格式：401 `{"code":"UNAUTHORIZED","message":...}`；403（IP 黑名单/角色不足）`{"code":"ACCESS_DENIED","message":...}`；429 `{"error":{"code":"RATE_LIMIT_EXCEEDED","message":"请求过于频繁，请稍后重试"}}`
  - 服务端异常统一 ApiResponse：`{"success":false,"error":{"code":"...","message":"..."},"traceId":"...","timestamp":"..."}`；502 code 为上游错误类型名（如 `UPSTREAM_ERROR`、`MODEL_NOT_FOUND`）；503 熔断 code 为 `UPSTREAM_ERROR`；404 `NOT_FOUND`；409 `CONFLICT`
  - 重试表补全 10 个 ProviderErrorType：不可重试 = QUOTA_EXCEEDED/AUTHENTICATION_ERROR/INVALID_REQUEST/MODEL_NOT_FOUND；RATE_LIMIT_ERROR→限流退避（最多 5 次、2s 起、60s 封顶）；TIMEOUT_ERROR→快速重试；UPSTREAM_ERROR/SERVICE_UNAVAILABLE→固定间隔重试；NETWORK_ERROR/UNKNOWN_ERROR→指数退避
  - 调用方重试建议保留
- [ ] overview、sdk：核对后仅做措辞微调（内容已对齐）

### Task 3: api/ 组 5 篇

**Files:** `chat-completions.mdx`、`messages.mdx`、`models.mdx`、`protocol-convert.mdx`、`admin-index.mdx`

- [ ] chat-completions / messages：状态码表修正响应格式列——200 协议格式；400 校验=协议错误格式；401=`{"code":"UNAUTHORIZED",...}`；403=`{"code":"ACCESS_DENIED",...}`；429=`{"error":{"code":"RATE_LIMIT_EXCEEDED",...}}`；404/500/502/503=ApiResponse 格式（502 code=错误类型名、503 code=`UPSTREAM_ERROR`）；字段限制 note 保留（tool_choice 仅字符串、不支持 top_p/n/logit_bias/user 已验证正确）
- [ ] models：响应示例 `ownedBy` 值改为 `"system"`（两处：gpt-4o 与 claude），保留「ownedBy 非 owned_by」说明
- [ ] protocol-convert：互转矩阵保留；补一句「响应转换针对 openai↔anthropic 定向实现；上游协议另有 Gemini 插件（`gateway.protocol.gemini.enabled`）作为扩展示例」
- [ ] admin-index（大改）：
  - 「`/api/v1/me`（当前用户信息、修改密码）」→ 修正为：认证与当前用户在 `/api/v1/auth`（login/logout/me/me/password），`/api/v1/me/api-keys` 查询我的 Key
  - 按组补齐新端点：用户组补 `PATCH /users/{id}/state`、`PUT /users/{id}/roles`、`POST /users/{id}/reset-password`、`GET /users/{userId}/api-keys`、`GET /user-api-keys/{id}/detail`；渠道组补 `POST /channels/{id}/copy`、列表 `sortBy`/`sortOrder`、模型实例 `PATCH /{id}/upstream-model-name`、`PUT /{id}/state`；模型组补 `POST /models/{id}/copy`、`POST /models/{id}/unlock`、`PATCH /models/{id}/state`；新增审计组 `/api/v1/audit-logs`（GET 分页 + DELETE 按 days/before 清理）；新增设置组 `/api/v1/settings`（GET 全部 + PUT /{key}）；新增目录同步组 `/api/v1/catalog/sync`（POST 手动触发 + GET /status）；统计组补 `GET /stats/trend?days=`、`GET /stats/model-usage?limit=`

### Task 4: admin/ 组 10 篇

**Files:** `applications.mdx`、`channels.mdx`、`providers.mdx`、`users.mdx`、`apikeys.mdx`、`token-quota.mdx`、`security.mdx`、`routing.mdx`、`resilience.mdx`、`observability.mdx`

- [ ] channels：补复制端点小节（`POST /api/v1/channels/{id}/copy`：复制本体+端点+模型实例+可选凭证；目标名称重复返回 409 `CONFLICT`）；GET 列表参数补 `sortBy`/`sortOrder`
- [ ] providers：「AES-256 加密」→「AES-256-GCM 加密」
- [ ] apikeys：功能清单删「Key 过期时间 ✅」行（实体无过期字段）；访问控制表删 Key 过期行，补「存储安全：仅存前缀 + SHA-256 哈希」；API 表补 `GET /api/v1/user-api-keys/{id}/detail`（详情，明文仅创建时返回）；字段演进 note（V49）保留
- [ ] token-quota：
  - 删「`/api/v1/stats` 占位数据」caution → 改为：统计基于 call_logs 真实聚合（含 Token 列）；补 `GET /api/v1/stats/trend?days=`（按天用量，缺省 7 天）与 `GET /api/v1/stats/model-usage?limit=`（模型用量 TopN）
  - `periodType` 枚举补全：DAILY/WEEKLY/MONTHLY/TOTAL；字段表补 `limitType`（SYSTEM_DEFAULT/USER_CUSTOM）、`state`（ACTIVE/SUSPENDED）
  - 计量来源修正：Token 用量随每次调用写入 call_logs（inputTokens/outputTokens）；保留「配额扣减尚未接入请求链路」warning（范围缩小为：配额可配置管理，但请求路径无校验/扣减）
- [ ] security：拦截器链 4 层→5 层（补 order 3 角色授权 Permission，USER 白名单=模型/应用只读+体验中心+自己的 Key）；401/403 错误体格式修正（UNAUTHORIZED/ACCESS_DENIED）；加密密钥段落补 env `ENCRYPTION_KEY`（生产实际生效变量，`GATEWAY_ENCRYPTION_KEY` 仅 local 映射）
- [ ] resilience：错误分流表补 `MODEL_NOT_FOUND` 行（L0 否 / L1 否，附注：触发模型自动废弃检测）；熔断段落补内置默认参数（窗口 10、失败率 50%、OPEN 30s、半开试探 3 次，当前为内置值不可配）
- [ ] observability：「Trace ID 可在响应头或日志中获取」→「Trace ID 记录于应用日志与调用记录（call_logs），数据面响应不返回 trace 响应头」；自定义指标补 `gateway.retry.exhausted`；其余保留（Actuator 6 端点、Grafana/Jaeger 预置面板规划中）
- [ ] applications、users、routing：核对后仅微调（内容已对齐；users 可补 USER 白名单细则一句）

### Task 5: reference/ 组 6 篇

**Files:** `config.mdx`、`troubleshooting.mdx`、`faq.mdx`、`migration.mdx`、`changelog.mdx`、`roadmap.mdx`

- [ ] config：
  - Actuator 列表补 metrics/traces；删 `.env.example` 引用
  - 加密密钥行改为 env `ENCRYPTION_KEY`（兜底），注明 `GATEWAY_ENCRYPTION_KEY` 仅 local profile 映射
  - 新增小节或行：`gateway.security.rate-limit.*`（bucket-size 100/refill-rate 10/qps-threshold 1000）、`gateway.retry.*`（max-attempts 3/backoff-initial 1000ms/multiplier 2.0/可重试状态码 429,500,502,503；429 专用 5 次/2s/60s 封顶）、`webclient.connect-timeout:5000`/`read-timeout:60000`、`gateway.protocol.gemini.enabled`、`gateway.actuator.health.public-access:true`、`spring.jpa.ddl-auto`（默认 update，postgresql profile 为 validate）、H2 console（/h2-console，local 开启 web-allow-others）
  - Sa-Token 行保留（已对齐）
- [ ] troubleshooting：错误码速查表重写为真实 code：401 `UNAUTHORIZED`；403 `ACCESS_DENIED`（IP 黑名单或角色不足）；404 `NOT_FOUND`（API/Actuator 路径不存在；模型上游不存在表现为 502 且 code=`MODEL_NOT_FOUND`）；429 `RATE_LIMIT_EXCEEDED`；500 `INTERNAL_ERROR`；502 上游错误类型名（如 `UPSTREAM_ERROR`）；503 `UPSTREAM_ERROR`（熔断 OPEN）；保留 401 双 header 建议、health-check/resilience-events 建议、Flyway 建议
- [ ] faq：删「Token 用量占位」相关表述（stats 真实）；「生产必须配置 GATEWAY_ENCRYPTION_KEY」→「生产必须配置 `ENCRYPTION_KEY` 环境变量（或 `gateway.security.encryption-key` 属性）」；其余保留
- [ ] migration：「GATEWAY_ENCRYPTION_KEY 必须跨版本一致」→「`ENCRYPTION_KEY`（加密密钥）必须跨版本一致」；「V1~V68」→「V1~V70」；其余保留
- [ ] changelog（增补 1.0.0-SNAPSHOT 现状）：
  - 核心能力补：模型/渠道复制（含 409 重名保护）、模型生命周期自动化（运行时 MODEL_NOT_FOUND 废弃检测 + 定时目录探测 + DEPRECATED 状态与标签）、列表字段排序（sortBy/sortOrder）、审计日志 API、系统设置（/api/v1/settings + 控制台设置页）、统计趋势与模型用量端点、控制台 12 模块与中英双语
  - 数据库演进：「已演进至 V68」→「V70」；补 V69（模型目录同步字段）、V70（system_settings 系统设置表）
  - 已知限制：删「stats 占位」（如存在）；保留 Token 扣减未接入/路由硬编码 WEIGHTED/OAuth/PII/语义缓存/MCP/官方 SDK；「代理配置」保留规划中
- [ ] roadmap：「当前实现」清单删「调用方 API Key 的 IP 限制与模型白名单」（Key 无此字段）；其余保留

### Task 6: 营销页数据文件 3 个

**Files:** `src/data/homeFeatures.ts`、`src/data/i18n/home.ts`、`src/data/homeEcosystem.ts`（页面组件与 en/ 目录页面不动，改数据后中英自动生效）

- [ ] homeFeatures（8 卡片逐条改）：
  - API 网关、Provider 管理、可观测性：保留（已真实）
  - 路由：「模型级智能降级、场景路由、别名映射」→「优先级与权重负载均衡、应用级失败策略、L0/L1 容灾转移」
  - 用户与认证：「OAuth 登录、企业 OAuth」→「用户名密码登录、ADMIN/USER 角色权限、Sa-Token 会话」
  - 密钥管理：「额度限制、模型白名单、IP 限制」→「API Key 全生命周期管理、应用绑定与渠道授权、SHA-256 哈希安全存储」
  - Token 计量与配额：「二级预算控制」→「输入/输出分别统计、调用日志落库、用量趋势与模型分布」
  - 安全与风控：「PII 脱敏、内容审核、国密」→「IP 黑名单、密钥 AES-256-GCM 加密、审计日志、令牌桶限流」
- [ ] home.ts（zh+en 同步）：
  - hero 副标题：删「语义缓存」，保留双协议与可观测（「50+ 主流大模型」有 164 个内置预置模型支撑，保留）
  - differentiators「更合规」：删国密/等保 2.0/WORM → 改「完整审计日志与调用留痕、密钥加密存储」（国密等规划项不再作为现状宣称）
  - 「更安全」：删 Prompt 注入防护/PII 脱敏/内容审核 → 改「IP 黑名单、令牌桶限流、密钥 AES-256-GCM 加密、审计日志」
  - 「更智能」：删语义缓存降本 30% → 改「智能路由与容灾：L0/L1 故障转移、端点级熔断」
  - narrative：「额度不足或模型不可用时自动切换」→「额度不足或渠道故障时自动换 Key/换渠道（按应用优先级）」；「认证、限流、脱敏、审计四层」→「IP 黑名单、认证、鉴权、限流多层拦截」
- [ ] homeEcosystem：PostgreSQL 描述删「pgvector 向量存储」→「主数据库（开发 H2 内嵌 / 生产 PostgreSQL）」；Redis「分布式缓存与限流」→「分布式缓存（限流为内置内存令牌桶）」

### Task 7: 全量校验

- [ ] `pnpm lint:slugcheck` 通过
- [ ] `pnpm build` 通过
- [ ] `pnpm lint:linkcheck` 通过（重点核对新引用路径：`gateway-boot/src/main/resources/catalog/model-specs.json` 等代码路径仅为文字描述非链接；文档内部无新增链接则零风险）
- [ ] 全局 grep 自查：`invalid_api_key`、`overloaded_error`、`GATEWAY_ENCRYPTION_KEY`（生产语境）、`语义缓存`、`国密`、`pgvector`、`模型白名单`、`jreleaser` 在 docs 与 data 文件中不再以「已实现/现状」口吻出现（roadmap/changelog 的「规划中/曾实现」语境除外）

## Self-Review 结论

- 覆盖检查：文档盘点清单中的 9 项内部矛盾全部有对应任务（`/api/v1/me`→T3、Actuator 清单→T1/T5、AES-256 表述→T4、Key 过期→T2/T4、stats 占位→T4/T5、examples 缺 404→T2、错误码字符串→T2/T5、加密 env→T1/T4/T5、quickstart Provider 入口→T1）。
- 品牌残留按要求不动（Global Constraints）。
- 侧边栏 label 与 frontmatter title 的 3 处不一致（apikeys/resilience/migration）不属于代码对齐范畴，本计划不改。
