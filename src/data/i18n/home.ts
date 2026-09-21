// 首页全部文案，中英双语，组件按 locale 取值。
export const home = {
  zh: {
    hero: {
      title: '企业级大模型网关 · 更合规、更安全、更智能、更易用',
      subtitle: 'OpenAI / Anthropic 双标准 API，统一接入 50+ 主流大模型，智能路由容灾、全链路可观测。',
      cta: '快速开始',
    },
    differentiators: [
      { title: '更易用', desc: '开箱即用（21 家内置供应商与渠道模板）+ 零学习成本（OpenAI / Anthropic 双兼容）+ 可视化控制台' },
      { title: '更合规', desc: '完整审计日志与调用留痕 + 密钥 AES-256-GCM 加密存储 + 分角色权限管控' },
      { title: '更安全', desc: 'IP 黑名单 + 令牌桶限流 + 密钥加密存储 + 多层拦截架构' },
      { title: '更智能', desc: '智能路由与容灾：L0/L1 故障转移 + 端点级熔断 + 故障自动恢复' },
    ],
    narrative: {
      title: '能力叙事',
      dualProtocol: '双协议：同时支持 OpenAI 与 Anthropic API 标准，协议互转零成本。',
      routing: '智能路由与容灾：额度不足或渠道故障时自动换 Key / 换渠道，按应用优先级转移，保障业务连续性。',
      security: '安全合规：IP 黑名单、认证、鉴权、限流多层拦截，密钥加密存储，操作审计留痕。',
    },
    console: { title: '控制台预览', alt: 'codingas.com 控制台界面截图' },
    features: { title: '8 大能力域' },
    cta: { title: '开始使用 codingas.com', button: '查看文档' },
  },
  en: {
    hero: {
      title: 'Enterprise LLM Gateway · Compliant, Secure, Intelligent, Easy',
      subtitle: 'OpenAI / Anthropic dual-standard APIs, unified access to 50+ models, smart routing & failover, full observability.',
      cta: 'Get Started',
    },
    differentiators: [
      { title: 'Easier', desc: 'Out-of-the-box (21 built-in providers & channel templates) + zero learning curve (OpenAI / Anthropic compatible) + visual console' },
      { title: 'More Compliant', desc: 'Full audit logging + AES-256-GCM encrypted keys + role-based access control' },
      { title: 'More Secure', desc: 'IP blocklist + token-bucket rate limiting + encrypted key storage + multi-layer interception' },
      { title: 'Smarter', desc: 'Smart routing & resilience: L0/L1 failover + endpoint circuit breakers + automatic recovery' },
    ],
    narrative: {
      title: 'Capabilities',
      dualProtocol: 'Dual protocol: OpenAI and Anthropic API standards, zero-cost protocol conversion.',
      routing: 'Smart routing & resilience: auto-switch keys/channels on quota exhaustion or channel failure, transferred by application priority.',
      security: 'Security: IP blocklist, auth, permission, rate-limit multi-layer checks, encrypted keys, audit trails.',
    },
    console: { title: 'Console Preview', alt: 'Screenshot of the codingas.com console' },
    features: { title: '8 Capability Domains' },
    cta: { title: 'Start with codingas.com', button: 'View Docs' },
  },
} as const;
