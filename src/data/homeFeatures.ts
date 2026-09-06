// 首页 8 能力域功能网格卡片数据（含跳转文档 slug）。
export interface FeatureCardData {
  title: string;
  desc: string;
  href: string;
}

export const homeFeatures: FeatureCardData[] = [
  { title: 'API 网关', desc: 'OpenAI / Anthropic 双标准端点，SSE 流式，协议互转', href: '/developer/overview/' },
  { title: 'Provider 管理', desc: '21 家内置供应商、多 Key 轮换、负载均衡、熔断故障转移', href: '/admin/providers/' },
  { title: '路由', desc: '优先级 + 权重负载均衡、应用级失败策略、L0/L1 容灾转移', href: '/admin/routing/' },
  { title: '用户与认证', desc: '用户管理、ADMIN / USER 角色权限、Sa-Token 会话认证', href: '/admin/users/' },
  { title: '密钥管理', desc: 'API Key 全生命周期管理、应用绑定与渠道授权、SHA-256 哈希存储', href: '/admin/apikeys/' },
  { title: 'Token 计量与配额', desc: '输入/输出分别统计、调用记录落库、用量趋势与模型分布', href: '/admin/token-quota/' },
  { title: '安全与风控', desc: 'IP 黑名单、令牌桶限流、密钥 AES-256-GCM 加密、审计日志', href: '/admin/security/' },
  { title: '可观测性', desc: 'Trace ID 全链路、结构化日志、Prometheus 指标', href: '/admin/observability/' },
];
