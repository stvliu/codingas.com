import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { sidebar } from './astro.sidebar.ts';
import { redirects as astroRedirects } from './astro.redirects.ts';

// 站点根 URL，P0 占位，域名确定后一处修改。
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://codingas.com';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  // 旧 slug -> 新 slug 重定向（astro.redirects.ts 维护），避免外链断链。
  redirects: astroRedirects,
  integrations: [
    sitemap(),
    starlight({
      title: 'codingas.com',
      // P0 仅 root locale（简体中文），不配 en，避免未翻译 fallback 噪音。
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      sidebar,
      social: [
        // starlight 0.33+ social 改为数组格式（icon 为内置图标名）。
        { label: 'GitHub', icon: 'github', href: 'https://github.com/stvliu/llm-gateway' },
      ],
      editLink: {
        baseUrl: 'https://gitee.com/stvliu/codingas.com/edit/master/src/content/docs',
      },
      // 整站统一 Starlight 默认主题：不覆盖 Header/Footer/SiteTitle，
      // 文档页回归 Starlight 默认组件，与 docs.astro.build 视觉一致；
      // 营销页由 BaseLayout.astro 加载 Starlight 主题变量统一风格。
    }),
  ],
});
