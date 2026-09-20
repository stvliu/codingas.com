// Wiki 双路推送：导出产物（.wiki-out/）以单个同步 commit 推送到 GitHub 与 Gitee 的 llm-gateway Wiki。
// 规格见 openspec/changes/migrate-github-pages-and-wiki/specs/wiki-sync/spec.md。
// 用法：pnpm wiki:push（内部先跑导出保证产物最新，再逐落点同步）
// 凭据：来自本地 git 凭据管理器（GitHub 为 stvliu 凭据；Gitee 为 ezxbao_liuye 的 PAT/SSH）。
// 幂等：产物无差异时不产生 commit；任一落点失败非零退出并指明落点，两落点结果独立报告。
import { spawnSync } from 'node:child_process';
import { readdir, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = join(ROOT, '.wiki-out');
const CACHE_DIR = join(ROOT, '.wiki-cache');

const TARGETS = [
  {
    name: 'GitHub',
    // SSH over 443（~/.ssh/config 将 github.com 指向 ssh.github.com:443）：
    // 本机 HTTPS 到 GitHub 被重置，SSH 通道可达
    url: 'git@github.com:stvliu/llm-gateway.wiki.git',
    dir: join(CACHE_DIR, 'gh'),
    // GitHub wiki 依赖 _Sidebar.md 侧栏机制与 _Footer.md 页脚，全量推送
    exclude: [],
  },
  {
    name: 'Gitee',
    url: 'https://gitee.com/ezxbao_liuye/llm-gateway.wiki.git',
    dir: join(CACHE_DIR, 'gitee'),
    // Gitee 页面树会把 _Sidebar/_Footer 当普通页面显示为噪音，且其渲染支持未证实，不推
    exclude: ['_Sidebar.md', '_Footer.md'],
  },
];

function git(dir, args) {
  return spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
}

// 产物内容级复制到 wiki 工作树（保留 .git；exclude 为该落点不推送的产物文件）。
async function syncWorktree(src, dst, exclude) {
  for (const entry of await readdir(dst, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    await rm(join(dst, entry.name), { recursive: true, force: true });
  }
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    await cp(join(src, entry.name), join(dst, entry.name), { recursive: true });
  }
}

async function pushTarget(t, identity) {
  if (!existsSync(join(t.dir, '.git'))) {
    console.log(`[${t.name}] 克隆 ${t.url} ...`);
    const r = spawnSync('git', ['clone', t.url, t.dir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`克隆失败：${(r.stderr || r.stdout || '').trim()}`);
  }
  await syncWorktree(OUT_DIR, t.dir, t.exclude);
  const add = git(t.dir, ['add', '-A']);
  if (add.status !== 0) throw new Error(`git add 失败：${add.stderr}`);
  const status = git(t.dir, ['status', '--porcelain']);
  if (status.status !== 0) throw new Error(`git status 失败：${(status.stderr || status.stdout || '(无输出)').trim()}`);
  if (!status.stdout.trim()) {
    // 工作树与本地 HEAD 一致：仍需确认 HEAD 已推送到远程（上次可能 commit 成功但 push 失败）
    const ahead = git(t.dir, ['rev-list', '@{u}..HEAD']);
    if (ahead.status !== 0 || ahead.stdout.trim()) {
      const retry = git(t.dir, ['push']);
      if (retry.status !== 0) throw new Error(`push 失败：${(retry.stderr || retry.stdout || '').trim()}`);
      console.log(`[${t.name}] 本地存在未推送 commit，已补推 ✅`);
      return;
    }
    console.log(`[${t.name}] 产物无差异，跳过推送 ✅`);
    return;
  }
  // wiki 克隆目录不继承官网仓库的 local 身份，从主仓库读取并以 -c 注入
  if (!identity.name && !identity.email) {
    throw new Error('本机未配置 git 身份（git config user.name / user.email），无法生成同步 commit');
  }
  const date = new Date().toISOString().slice(0, 10);
  const msg = `docs: sync from codingas.com site (${date})`;
  const commitArgs = [];
  if (identity.name) commitArgs.push('-c', `user.name=${identity.name}`);
  if (identity.email) commitArgs.push('-c', `user.email=${identity.email}`);
  commitArgs.push('commit', '-m', msg);
  const commit = git(t.dir, commitArgs);
  if (commit.status !== 0) throw new Error(`commit 失败：${commit.stderr}`);
  const push = git(t.dir, ['push']);
  if (push.status !== 0) throw new Error(`push 失败：${(push.stderr || push.stdout || '').trim()}`);
  console.log(`[${t.name}] 已推送同步 commit ✅`);
}

async function main() {
  // 前置：先导出，保证产物与文档源一致
  const exp = spawnSync('node', ['scripts/export-wiki.mjs'], { cwd: ROOT, stdio: 'inherit' });
  if (exp.status !== 0) {
    console.error('wiki-push：导出失败，终止推送');
    process.exit(1);
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const name = spawnSync('git', ['config', 'user.name'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const email = spawnSync('git', ['config', 'user.email'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const identity = { name, email };
  const failed = [];
  for (const t of TARGETS) {
    try {
      await pushTarget(t, identity);
    } catch (e) {
      console.error(`[${t.name}] 推送失败：${e.message}`);
      failed.push(t.name);
    }
  }
  if (failed.length) {
    console.error(`wiki-push：以下落点失败 → ${failed.join('、')}`);
    process.exit(1);
  }
  console.log('wiki-push：全部落点同步完成 ✅');
}

main().catch((e) => {
  console.error(`wiki-push：${e.message}`);
  process.exit(1);
});
