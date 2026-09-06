// 生态组件数据。
export interface EcosystemItem {
  name: string;
  desc: string;
}

export const homeEcosystem: EcosystemItem[] = [
  { name: 'PostgreSQL', desc: '生产主数据库，开发可用内嵌 H2' },
  { name: 'Redis', desc: '分布式缓存' },
  { name: 'OpenTelemetry', desc: '全链路追踪标准' },
  { name: 'Prometheus', desc: '指标采集与导出' },
  { name: 'Spring Boot 3.5', desc: '后端框架（Java 21）' },
  { name: 'Cloudflare Pages', desc: '官网与文档部署' },
];
