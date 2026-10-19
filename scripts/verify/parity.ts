/**
 * Phase 7 · URL 对账 —— 迁移的唯一验收标准。
 *
 * 拿 migration/url-manifest.json（阶段 02 从 sitemap + REST + 分页探测 + 内链收割
 * 四处合并出的 171 条基线）逐条打到构建产物上，要求：
 *   1. 每条 200 页面都能在本地产物里找到对应 index.html —— 少一个就是上线 404
 *   2. 每条 301 别名都有 _redirects 规则接住
 *   3. 产物的 canonical 指向自己（重复内容的根源）
 *   4. 产物标题非空
 *   5. 反向检查：产物里没有基线之外的意外 URL
 *
 * 这是 CI 该跑的命令，不是给人看着办的建议。
 *
 *   npm run verify:parity
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, SITE_ORIGIN } from '../migrate/lib/config.ts';

const DIST = resolve(ROOT, 'dist');
const MANIFEST = join(ROOT, 'migration', 'url-manifest.json');

interface UrlRecord {
    path: string;
    url: string;
    status: number;
    kind: string;
    title?: string;
    canonical?: string;
    robots?: string;
    target?: string;
}

const fail: string[] = [];
const warn: string[] = [];

function require(cond: boolean, msg: string): void {
    if (!cond) fail.push(msg);
}

async function main(): Promise<void> {
    if (!existsSync(DIST)) {
        console.error('✗ 没有 dist/，请先 npm run build');
        process.exitCode = 1;
        return;
    }
    if (!existsSync(MANIFEST)) {
        console.error('✗ 没有 migration/url-manifest.json，请先 npm run migrate -- 02');
        process.exitCode = 1;
        return;
    }

    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8')) as {
        urls: UrlRecord[];
        deadSourceLinks?: string[];
    };
    const redirects = existsSync(join(ROOT, 'public', '_redirects'))
        ? await readFile(join(ROOT, 'public', '_redirects'), 'utf8')
        : '';

    const buildable = manifest.urls.filter((u) => u.kind !== 'redirect');
    const aliases = manifest.urls.filter((u) => u.kind === 'redirect');

    console.log(`基线：${manifest.urls.length} 条 URL（页面 ${buildable.length}，301 别名 ${aliases.length}）\n`);

    // ── 1. 每条基线页面都要有产物 ────────────────────────────────
    const missing: string[] = [];
    for (const u of buildable) {
        const file = u.path === '/' ? join(DIST, 'index.html') : join(DIST, u.path, 'index.html');
        if (!existsSync(file)) missing.push(`${u.path}  (${u.kind})`);
    }
    require(missing.length === 0, `缺少产物文件 ${missing.length} 个：\n      ${missing.join('\n      ')}`);

    // ── 2. 每条 301 别名都要有重定向规则 ─────────────────────────
    const rl = new Set(
        redirects.split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
            .map((l) => l.split(/\s+/)[0]),
    );
    const uncovered = aliases.filter((a) => !rl.has(a.path));
    require(
        uncovered.length === 0,
        `301 别名未被 _redirects 覆盖 ${uncovered.length} 条：\n      ${uncovered.map((a) => `${a.path} → ${a.target}`).join('\n      ')}`,
    );

    // ── 3. 逐页内容检查：canonical 自引用 + 标题非空 + 唯一 H1 ────
    let checked = 0;
    for (const u of buildable) {
        const file = u.path === '/' ? join(DIST, 'index.html') : join(DIST, u.path, 'index.html');
        if (!existsSync(file)) continue;

        const html = await readFile(file, 'utf8');
        checked += 1;

        const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
        const expect = `${SITE_ORIGIN}${u.path}`;
        if (canonical !== expect) {
            fail.push(`canonical 不符：${u.path}  实际=${canonical ?? '无'}  期望=${expect}`);
        }

        if (!/<title>[^<]+<\/title>/.test(html)) fail.push(`标题为空：${u.path}`);

        const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
        if (h1s !== 1) fail.push(`H1 数量应为 1，实际 ${h1s}：${u.path}`);

        if (!/<meta name="description" content="[^"]{20,}"/.test(html)) {
            warn.push(`description 缺失或过短：${u.path}`);
        }

        // 源站是 noindex 的页（空分类），新站必须仍然 noindex
        if (u.robots?.includes('noindex') && !html.includes('noindex')) {
            fail.push(`源站 noindex 但新站丢了：${u.path}`);
        }

        if (!/<script type="application\/ld\+json">/.test(html)) {
            warn.push(`无 JSON-LD 结构化数据：${u.path}`);
        }
    }

    // ── 4. 反向：产物里不该有基线之外的意外 HTML ──────────────────
    const htmlFiles: string[] = [];
    async function walk(dir: string): Promise<void> {
        for (const name of await readdir(dir)) {
            const p = join(dir, name);
            if ((await stat(p)).isDirectory()) await walk(p);
            else if (name.endsWith('.html')) htmlFiles.push('/' + p.slice(DIST.length + 1).replace(/\\/g, '/').replace(/index\.html$/, ''));
        }
    }
    await walk(DIST);

    // 基线之外但必须存在的工具页，不参与收录对账：
    //   /404.html —— Astro 对 404 路由的规定输出名（不是 /404/index.html），
    //                Cloudflare Pages 拿它当未匹配 URL 的 404 响应页。
    //   /admin/   —— Decap 后台入口页，自带 noindex 且 robots 已 Disallow，
    //                本来就不属于源站 URL 基线。
    const utilityPages = ['/404.html', '/admin/'];
    const baseline = new Set<string>([...buildable.map((u) => u.path), ...utilityPages]);
    const extra = htmlFiles.filter((p) => !baseline.has(p));
    require(extra.length === 0, `产物中有基线之外的意外页面 ${extra.length} 个：\n      ${extra.slice(0, 20).join('\n      ')}`);

    // ── 汇总 ────────────────────────────────────────────────────
    console.log(`已校验页面 ${checked} 个`);
    if (warn.length > 0) {
        console.log(`\n提示 ${warn.length} 条（不阻塞）：`);
        for (const w of warn.slice(0, 20)) console.log(`  · ${w}`);
        if (warn.length > 20) console.log(`  … 其余 ${warn.length - 20} 条`);
    }

    if (fail.length > 0) {
        console.error(`\n✗ 对账未通过，共 ${fail.length} 项问题：`);
        for (const f of fail.slice(0, 40)) console.error(`  · ${f}`);
        if (fail.length > 40) console.error(`  … 其余 ${fail.length - 40} 项`);
        process.exitCode = 1;
    } else {
        console.log('\n✓ 对账通过：URL 全覆盖、canonical 自引用、H1 唯一、301 别名已接住、无意外页面。');
    }
}

main().catch((e) => {
    console.error('对账脚本异常：', e);
    process.exitCode = 1;
});
