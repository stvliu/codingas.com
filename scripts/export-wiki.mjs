// 文档 Wiki 导出器：Starlight 文档（MDX）→ Gollum Wiki（Markdown）。
// 规格见 openspec/changes/migrate-github-pages-and-wiki/specs/wiki-export/spec.md。
// 用法：node scripts/export-wiki.mjs [--out <dir>]
// 页面命名：按所属侧边栏分组入目录（组名去空格，如 API参考/），文件名 = frontmatter title
//   （保留空格；链接 target 中空格编码为 %20，Gollum 标准行为）。
//   另生成 Home.md（首页）+ _Sidebar.md/_Footer.md（Gollum 特殊页，仅 GitHub 落点使用，
//   Gitee 推送时排除 —— 其页面树会把它们当普通页面显示为噪音）。
// 退出码：0 成功；1 遇到不支持的 MDX 语法、title 冲突/非法或产物断链。
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname, resolve, relative, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sidebar } from '../astro.sidebar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS_DIR = join(ROOT, 'src/content/docs');
// 站点 URL 与 astro.config.ts 同源（PUBLIC_SITE_URL），域名切换时无需改本脚本
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://codingas.com';

// --out 参数（默认 .wiki-out/）；显式指定的目录禁止落在官网仓库内部（rm 清空会波及源码与 .git）
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
if (outIdx >= 0 && (outIdx + 1 >= args.length || args[outIdx + 1].startsWith('-'))) {
  console.error('错误：--out 需要一个目录参数，例如 --out .wiki-out');
  process.exit(1);
}
const OUT_DIR = resolve(ROOT, outIdx >= 0 ? args[outIdx + 1] : '.wiki-out');
const DEFAULT_OUT = resolve(ROOT, '.wiki-out');
if (OUT_DIR === ROOT || (OUT_DIR.startsWith(ROOT + sep) && OUT_DIR !== DEFAULT_OUT)) {
  console.error('错误：--out 不允许指向官网仓库内部的其他目录（导出会清空该目录，包括源码与 .git）');
  process.exit(1);
}

// 链接 target 编码：仅空格 → %20（CommonMark destination 不允许空格；中文等字符合法保留，保证可读性）
const encodeTarget = (p) => p.replace(/ /g, '%20');

// 递归收集 docs 下 .md/.mdx，返回 posix 风格相对路径（如 api/chat-completions.mdx）。
async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) files.push(...(await walk(join(dir, e.name), rel)));
    else if (/\.(md|mdx)$/.test(e.name)) files.push(rel);
  }
  return files.sort();
}

// 剥离 YAML frontmatter，提取 title（去包裹引号）。description 直接丢弃。
function stripFrontmatter(text, rel) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { body: text, title: null };
  const tm = m[1].match(/^title:\s*(.+)$/m);
  let title = tm ? tm[1].trim() : null;
  if (title) title = title.replace(/^['"]|['"]$/g, '');
  return { body: text.slice(m[0].length), title };
}

// 按 ``` 围栏切分为代码/非代码段（start 为段首行号，0-based）。
// 代码段（含示例中的 import 语句等）原样保留，不参与 MDX 处理与链接改写。
function splitByFence(text) {
  const lines = text.split('\n');
  const segments = [];
  let cur = [];
  let start = 0;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) {
      if (!inCode) {
        if (cur.length) segments.push({ text: cur.join('\n'), isCode: false, start });
        cur = [lines[i]];
        start = i;
        inCode = true;
      } else {
        cur.push(lines[i]);
        segments.push({ text: cur.join('\n'), isCode: true, start });
        cur = [];
        inCode = false;
        start = i + 1; // 重置为下一段起始行，保证非代码段的报错行号正确
        continue;
      }
    } else {
      cur.push(lines[i]);
    }
  }
  if (cur.length) segments.push({ text: cur.join('\n'), isCode: inCode, start });
  return segments;
}

// MDX 组件降级（仅非代码段）：删除组件 import 与 Tabs/TabItem 标签行，
// <TabItem label="x"> 降级为 ### x 分节；遇到其他 JSX 组件报错（文件:行号）。
function demoteMdx(segment, rel) {
  const out = [];
  const lines = segment.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = segment.start + i + 1;
    // 仅删除真正的 JS import 语句（含 from '...' 或 side-effect import），避免误删以 import 开头的正文行
    if (/^import\s/.test(line) && /(?:\bfrom\s*['"]|^\s*import\s+['"])/.test(line)) continue;
    // Starlight aside（:::/:::: 指令）暂无降级实现，按 spec 要求报错而非静默输出
    if (/^:::+/.test(line)) {
      throw new Error(`${rel}:${lineNo} 含 Starlight aside 语法（${line.trim().slice(0, 24)}），导出器暂不支持，请先降级文档或扩展导出器`);
    }
    if (/^<Tabs\b/.test(line) || /^<\/Tabs>/.test(line)) continue;
    const item = line.match(/^<TabItem\b[^>]*\blabel="([^"]+)"[^>]*>/);
    if (item) {
      out.push('', `### ${item[1]}`, '');
      continue;
    }
    if (/^<\/TabItem>/.test(line)) continue;
    // 未知组件检测：排除行内 code 后查找大写标签
    const stripped = line.replace(/`[^`]*`/g, '');
    const jsx = stripped.match(/<[A-Z]\w+/);
    if (jsx) {
      throw new Error(`${rel}:${lineNo} 不支持的 MDX 组件 <${jsx[0].slice(1)}>，请先降级文档或扩展导出器`);
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// 站内链接改写（仅非代码段）：文档页（slug 命中映射）→ 相对当前页的 wiki 路径
// （Gollum 按当前页目录解析相对链接，跨目录需 ../ 前缀）；
// 非文档路径（营销页等）→ 主站绝对 URL（保留原路径与锚点）。
function rewriteLinks(segmentText, currentPath, pathMap) {
  return segmentText.replace(/\]\(([^)\s]+)([^)]*)\)/g, (whole, target) => {
    if (!target.startsWith('/')) return whole; // 外链、锚点、已有相对链接不动
    const [path, frag] = target.split('#');
    const norm = path.replace(/^\//, '').replace(/\/$/, '');
    const suffix = frag ? `#${frag}` : '';
    const wikiPath = pathMap.get(norm);
    if (wikiPath) {
      const rel = posix.relative(posix.dirname(currentPath), wikiPath);
      return `](${encodeTarget(rel)}${suffix})`;
    }
    return `](${SITE_URL}${path}${suffix})`;
  });
}

// 单页转换：frontmatter 剥离 → 分段降级/改写 → H1 保证（正文无 H1 时以 title 补首行）。
function convertPage(raw, rel, currentPath, pathMap) {
  const { body, title } = stripFrontmatter(raw, rel);
  const converted = splitByFence(body)
    .map((s) => (s.isCode ? s.text : rewriteLinks(demoteMdx(s, rel), currentPath, pathMap)))
    .join('\n')
    .replace(/^\s+/, '');
  const firstContent = converted.split('\n').find((l) => l.trim() !== '') ?? '';
  return /^#\s/.test(firstContent) ? converted : `# ${title ?? '文档'}\n\n${converted}`;
}

// _Sidebar.md（仅 GitHub 落点使用，是其侧栏机制）：wikilink 按页面路径绝对引用，
// 不随当前页目录漂移；显示文本用侧边栏 label。
function renderSidebar(pathMap) {
  const parts = [];
  for (const group of sidebar) {
    parts.push(`**${group.label}**`, '');
    for (const item of group.items) {
      const p = pathMap.get(item.slug) ?? item.slug;
      parts.push(`- [[${p}|${item.label}]]`);
    }
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

const FOOTER_MD = [
  '---',
  '',
  `本 Wiki 为 [codingas.com](${SITE_URL}) 文档镜像，内容以主站为准；`,
  '问题反馈请到 [GitHub Issues](https://github.com/stvliu/llm-gateway/issues)。',
  '',
].join('\n');

// Home.md（Gollum 默认首页，两落点通用）：Home 位于根目录，链接无 ../ 前缀。
function renderHome(pathMap) {
  const entry = (slug, label) => `- [${label}](${encodeTarget(pathMap.get(slug) ?? slug)})`;
  return [
    '# llm-gateway 文档',
    '',
    `本 Wiki 为 llm-gateway 产品文档镜像，完整版与最新内容以 [codingas.com](${SITE_URL}) 为准。`,
    '',
    '## 快速入口',
    '',
    entry('quickstart', '快速开始'),
    entry('deploy', '安装部署'),
    entry('developer/overview', '开发者指南'),
    entry('api/chat-completions', 'API 参考：对话补全'),
    entry('reference/faq', '常见问题'),
    '',
  ].join('\n');
}

// 产物自校验：扫描所有产物文件（含导航页）非代码段中的链接。
// markdown 相对链接按当前页目录解析（%20 解码回空格后比对）；
// wikilink [[页面|显示]] 按绝对页面路径比对；断链收集后统一报告。
function verify(outputs) {
  const pathSet = new Set(outputs.map((f) => f.rel.replace(/\.md$/, '')));
  const broken = [];
  for (const f of outputs) {
    const base = posix.dirname(f.rel.replace(/\.md$/, ''));
    for (const seg of splitByFence(f.text)) {
      if (seg.isCode) continue;
      let m;
      const md = /\]\(([^)\s]+)([^)]*)\)/g;
      while ((m = md.exec(seg.text)) !== null) {
        if (/^(https?:|mailto:|#)/.test(m[1])) continue; // 外链/邮箱/锚点：须在按 # 截断前判断
        const target = m[1].split('#')[0];
        if (!target) continue; // 纯页内锚点（#xxx）
        const norm = posix.normalize(posix.join(base, target.replace(/%20/g, ' ')));
        if (!pathSet.has(norm)) broken.push(`${f.rel} -> ${target}`);
      }
      const wiki = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
      while ((m = wiki.exec(seg.text)) !== null) {
        const name = m[1].trim();
        if (!pathSet.has(name)) broken.push(`${f.rel} -> [[${name}]]`);
      }
    }
  }
  if (broken.length) {
    console.error(`wiki 自校验：发现 ${broken.length} 个断链：`);
    broken.forEach((b) => console.error('  ' + b));
    process.exit(1);
  }
}

async function main() {
  const rels = await walk(DOCS_DIR);

  // slug → 所属侧边栏分组（组名去空格作为 wiki 目录名）；31 条目须全覆盖
  const groupOf = new Map();
  for (const group of sidebar) {
    const dir = group.label.replace(/\s+/g, '');
    for (const item of group.items) groupOf.set(item.slug, dir);
  }

  // 解析 title，构建 slug → wiki 路径（"组目录/标题"）；title 唯一性与合法性在此强制
  const raws = new Map();
  const pathMap = new Map();
  const seen = new Map();
  for (const rel of rels) {
    const raw = await readFile(join(DOCS_DIR, rel), 'utf8');
    raws.set(rel, raw);
    const { title } = stripFrontmatter(raw, rel);
    const slug = rel.replace(/\.(md|mdx)$/, '');
    const name = title ?? slug;
    if (/[\\/:*?"<>|]/.test(name) || name.startsWith('_') || name.includes('/')) {
      throw new Error(`${rel} 的 title "${name}" 含文件名非法字符或以 _ 开头，请调整后重试`);
    }
    if (seen.has(name)) {
      throw new Error(`页面名冲突："${name}" 同时来自 ${seen.get(name)} 与 ${rel}，请调整 title`);
    }
    seen.set(name, rel);
    if (!groupOf.has(slug)) {
      throw new Error(`${rel} 未在 astro.sidebar.mjs 登记侧边栏，无法确定 wiki 分组目录，请先登记后再导出`);
    }
    pathMap.set(slug, `${groupOf.get(slug)}/${name}`);
  }

  const outputs = [];
  for (const rel of rels) {
    const slug = rel.replace(/\.(md|mdx)$/, '');
    const wikiPath = pathMap.get(slug);
    outputs.push({
      rel: `${wikiPath}.md`,
      text: convertPage(raws.get(rel), rel, wikiPath, pathMap),
    });
  }
  outputs.push(
    { rel: '_Sidebar.md', text: renderSidebar(pathMap) },
    { rel: '_Footer.md', text: FOOTER_MD },
    { rel: 'Home.md', text: renderHome(pathMap) },
  );

  await rm(OUT_DIR, { recursive: true, force: true });
  for (const f of outputs) {
    const p = join(OUT_DIR, f.rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, f.text, 'utf8');
  }

  verify(outputs);
  console.log(
    `wiki 导出完成：${rels.length} 篇页面（分组目录 + 中文页面名）+ Home/_Sidebar/_Footer → ${relative(ROOT, OUT_DIR)}（自校验通过 ✅）`,
  );
}

main().catch((e) => {
  console.error(`wiki 导出失败：${e.message}`);
  process.exit(1);
});
