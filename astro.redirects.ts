// 旧 slug -> 新 slug 重定向映射。
// 文档频道信息架构重组后，旧路径重定向到新路径，避免外链断链。
// 由 astro.config.ts 的 redirects 配置接入（Astro 原生重定向）。
// 键为旧路径（相对站点根，不带尾斜杠），值为新路径。
export const redirects: Record<string, string> = {
  // 顶层旧文档 -> 新分组
  '/api-gateway': '/developer/overview/',
  '/auth': '/admin/users/',
  '/apikey-management': '/admin/apikeys/',
  '/token-quota': '/admin/token-quota/',
  '/security': '/admin/security/',
  '/observability': '/admin/observability/',
  '/provider-management': '/admin/providers/',
  '/sdk': '/developer/sdk/',
  '/troubleshooting': '/reference/troubleshooting/',
  '/faq': '/reference/faq/',
  '/migration': '/reference/migration/',
  '/changelog': '/reference/changelog/',
  // api/ 旧文档
  '/api/api-spec': '/api/chat-completions/',
  '/api/examples': '/developer/examples/',
  // features/ 旧文档（已删除或迁移）
  '/features': '/reference/roadmap/',
  '/features/routing': '/admin/routing/',
  '/features/resilience': '/admin/resilience/',
  '/features/model-plaza': '/developer/models-pricing/',
  '/features/semantic-cache': '/reference/roadmap/',
  '/features/mcp-protocol': '/reference/roadmap/',
};

export default redirects;
