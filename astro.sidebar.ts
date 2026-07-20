// 文档频道侧边栏：5 大分组，管理员/开发者双视角分轨。
// 全部条目均渲染（不做条件隐藏）。
// 类型由 astro.config.ts 的 starlight({ sidebar }) 推断，无需显式导入 SidebarItem。
export const sidebar = [
  {
    label: '快速开始',
    collapsed: true,
    items: [
      { label: '快速开始', slug: 'quickstart' },
      { label: '安装部署', slug: 'deploy' },
      { label: '控制台快速上手', slug: 'console-guide' },
    ],
  },
  {
    label: '开发者指南',
    collapsed: true,
    items: [
      { label: 'API 概览', slug: 'developer/overview' },
      { label: '认证与调用', slug: 'developer/auth-call' },
      { label: '调用示例', slug: 'developer/examples' },
      { label: '模型与定价', slug: 'developer/models-pricing' },
      { label: 'Playground 体验', slug: 'developer/playground' },
      { label: '错误码与重试', slug: 'developer/errors' },
      { label: 'SDK 与集成', slug: 'developer/sdk' },
    ],
  },
  {
    label: 'API 参考',
    collapsed: true,
    items: [
      { label: '对话补全', slug: 'api/chat-completions' },
      { label: 'Anthropic 消息', slug: 'api/messages' },
      { label: '模型列表', slug: 'api/models' },
      { label: '协议转换', slug: 'api/protocol-convert' },
      { label: '管理 API 索引', slug: 'api/admin-index' },
    ],
  },
  {
    label: '管理员指南',
    collapsed: true,
    items: [
      { label: '应用管理', slug: 'admin/applications' },
      { label: '渠道管理', slug: 'admin/channels' },
      { label: 'Provider 管理', slug: 'admin/providers' },
      { label: '用户与认证', slug: 'admin/users' },
      { label: '调用方密钥管理', slug: 'admin/apikeys' },
      { label: 'Token 计量与配额', slug: 'admin/token-quota' },
      { label: '安全与风控', slug: 'admin/security' },
      { label: '路由设计', slug: 'admin/routing' },
      { label: '容灾与高可用', slug: 'admin/resilience' },
      { label: '可观测性', slug: 'admin/observability' },
    ],
  },
  {
    label: '参考',
    collapsed: true,
    items: [
      { label: '配置项参考', slug: 'reference/config' },
      { label: '故障排查', slug: 'reference/troubleshooting' },
      { label: '常见问题', slug: 'reference/faq' },
      { label: '升级指南', slug: 'reference/migration' },
      { label: '更新日志', slug: 'reference/changelog' },
      { label: '产品路线图', slug: 'reference/roadmap' },
    ],
  },
];
