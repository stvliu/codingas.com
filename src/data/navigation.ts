// 顶部导航项（中英双语，营销页与文档站 Header 共用）。
export interface NavItem {
  label: string;
  href: string;
  enLabel: string;
  // 外部链接：渲染为 target="_blank" rel="noopener noreferrer"（新窗口打开）。
  external?: boolean;
}

export const navigation: NavItem[] = [
  { label: '首页', href: '/', enLabel: 'Home' },
  { label: '文档', href: '/quickstart/', enLabel: 'Docs' },
  { label: '联系我们', href: '/contact-us/', enLabel: 'Contact' },
];
