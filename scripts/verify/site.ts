/**
 * 发布闸 · 新站自洽校验（全站新写后的日常验收标准）
 *
 * 与 verify:parity 的分工：
 *   verify:parity —— 迁移期对账，拿旧站 171 条 URL 清单要求"一模一样"。旧内容下架
 *                     或新增页面都会让它失败，那是它的本职（迁移已完成，日常别再用）。
 *   verify:site   —— 本脚本，不问"和旧站是否一致"，只问"这个站自己是否自洽"。
 *
 * 检查项（fail 即退出码 1，Action 会拒绝发布）：
 *   1. 每个内容页：title 非空、恰好一个 H1、canonical 存在且等于本站该路径
 *   2. noindex 页不得混进 sitemap；可索引页必须在 sitemap 里（少一条就是少收录）
 *   3. sitemap 里每条 URL 的域名必须是 SITE_ORIGIN，且产物里真有这个文件
 *   4. _redirects 语法：来源不得带 scheme（跨域名 301 在 Pages 层根本无效，必须去 Zone 配）
 *   5. _redirects 的站内目标必须存在（或能被另一条规则接住），避免 301 打到 404
 *   提示项（warn，不阻塞）：description 缺失/过短、无 JSON-LD
 *
 *   npm run verify:site
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN } from '../migrate/lib/config.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = join(ROOT, 'dist');
const ORIGIN = new URL(SITE_ORIGIN);

/** 不参与收录对账的工具页：404 响应页与后台 SPA（后台另有 robots Disallow） */
const SKIP_PREFIX = ['/admin/'];
const UTILITY = new Set(['/404.html']);

const fail: string[] = [];
const warn: string[] = [];

/** dist 里的产物路径 → 站点路径（目录形式补尾斜杠，与 Astro build.format:'directory' 一致） */
function toSitePath(relFromDist: string): string {
    const p = '/' + relFromDist.split(/[\\/]/).join('/');
    return p.endsWith('index.html') ? p.slice(0, -'index.html'.length) : p;
}

function fileFor(sitePath: string): string {
    return sitePath.endsWith('/')
        ? join(DIST, sitePath === '/' ? '' : sitePath, 'index.html')
        : join(DIST, sitePath);
}

/** 读 <meta name="robots"> 的 content，判断是否 noindex */
function isNoindex(html: string): boolean {
    const tag = html.match(/<meta\s[^>]*name="robots"[^>]*>/i)?.[0];
    return !!tag && /noindex/i.test(tag);
}

async function collectHtml(dir: string, acc: string[]): Promise<void> {
    for (const name of await readdir(dir)) {
        const p = join(dir, name);
        if ((await stat(p)).isDirectory()) await collectHtml(p, acc);
        else if (name.endsWith('.html')) acc.push(toSitePath(p.slice(DIST.length + 1)));
    }
}

async function main(): Promise<void> {
    if (!existsSync(DIST)) {
        console.error('✗ 没有 dist/，请先 npm run build');
        process.exitCode = 1;
        return;
    }

    // ── sitemap ─────────────────────────────────────────────────
    const indexPath = join(DIST, 'sitemap-index.xml');
    if (!existsSync(indexPath)) {
        console.error('✗ 缺 dist/sitemap-index.xml（@astrojs/sitemap 没产出？）');
        process.exitCode = 1;
        return;
    }
    const index = await readFile(indexPath, 'utf8');
    const shards = [...index.matchAll(/<loc>([^<]+\.xml)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    const listed = new Map<string, string>();
    for (const shard of shards) {
        const xml = await readFile(join(DIST, shard), 'utf8');
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
            const abs = m[1];
            let u: URL;
            try {
                u = new URL(abs);
            } catch {
                fail.push(`sitemap 里有非法 URL：${abs}`);
                continue;
            }
            if (u.host !== ORIGIN.host) fail.push(`sitemap 域名不符：${abs}（应为 ${ORIGIN.host}）`);
            listed.set(u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`, abs);
        }
    }

    // ── 逐页检查 ────────────────────────────────────────────────
    const found: string[] = [];
    await collectHtml(DIST, found);
    const pages = found.filter((p) => !SKIP_PREFIX.some((s) => p.startsWith(s)));
    const indexable = new Set<string>();

    for (const p of pages) {
        const file = fileFor(p);
        if (!existsSync(file)) {
            fail.push(`sitemap 指向的页没有产物文件：${p}`);
            continue;
        }
        const html = await readFile(file, 'utf8');
        if (UTILITY.has(p)) continue;

        if (!/<title>[^<]+<\/title>/.test(html)) fail.push(`标题为空：${p}`);

        const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
        if (h1s !== 1) fail.push(`H1 数量应为 1，实际 ${h1s}：${p}`);

        const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
        const expect = `${SITE_ORIGIN}${p}`;
        if (canonical !== expect) fail.push(`canonical 不符：${p}  实际=${canonical ?? '无'}  期望=${expect}`);

        if (!/<meta name="description" content="[^"]{20,}"/.test(html)) warn.push(`description 缺失或过短：${p}`);
        if (!/<script type="application\/ld\+json">/.test(html)) warn.push(`无 JSON-LD 结构化数据：${p}`);

        if (isNoindex(html)) {
            if (listed.has(p)) fail.push(`noindex 页却出现在 sitemap：${p}`);
        } else {
            indexable.add(p);
        }
    }

    for (const p of listed.keys()) {
        if (!indexable.has(p) && !pages.includes(p)) fail.push(`sitemap 里有产物中不存在的页：${p}`);
    }
    const omitted = [...indexable].filter((p) => !listed.has(p));
    if (omitted.length > 0) fail.push(`可索引页未进 sitemap ${omitted.length} 个：\n      ${omitted.slice(0, 20).join('\n      ')}`);

    // ── _redirects ─────────────────────────────────────────────
    const redirectsPath = join(ROOT, 'public', '_redirects');
    if (existsSync(redirectsPath)) {
        const lines = (await readFile(redirectsPath, 'utf8')).split(/\r?\n/);
        const sources = new Set<string>();
        const rules: Array<{ from: string; to: string; status: number; line: number }> = [];
        lines.forEach((raw, i) => {
            const line = raw.trim();
            if (!line || line.startsWith('#')) return;
            const [from, to, status] = line.split(/\s+/);
            sources.add(from);
            rules.push({ from, to: to ?? '', status: Number(status ?? 301), line: i + 1 });
        });

        for (const r of rules) {
            // 跨域名跳转写在这里是无效语法：Pages 只按路径匹配来源，请求根本到不了本项目
            if (/^[a-z]+:\/\//i.test(r.from) || r.from.includes('://')) {
                fail.push(`_redirects:${r.line} 来源带协议（跨域名 301 必须去 Cloudflare Zone 配 Redirect Rule）：${r.from}`);
            }
            if (r.status !== 301 && r.status !== 302 && r.status !== 308) {
                warn.push(`_redirects:${r.line} 状态码非 30x：${r.status}`);
            }
            // 站内绝对路径目标才校验存在性；外部 URL 与带通配的动态目标跳过
            if (!r.to.startsWith('/') || r.to.includes(':splat') || r.to.includes(':')) continue;
            const last = r.to.split('/').pop() ?? '';
            // 带扩展名的是文件（图片等），不能当目录补尾斜杠去找 index.html
            const target = last.includes('.') ? r.to : r.to.endsWith('/') ? r.to : `${r.to}/`;
            const covered = existsSync(join(DIST, target)) || sources.has(target) || sources.has(r.to);
            if (!covered) fail.push(`_redirects:${r.line} 目标在本项目里不存在：${r.from} → ${r.to}`);
        }
    }

    // ── 汇总 ────────────────────────────────────────────────────
    console.log(`产物页面 ${pages.length} 个（可索引 ${indexable.size}）｜sitemap ${listed.size} 条｜_redirects 规则已解析`);
    if (warn.length > 0) {
        console.log(`\n提示 ${warn.length} 条（不阻塞）：`);
        for (const w of warn.slice(0, 20)) console.log(`  · ${w}`);
        if (warn.length > 20) console.log(`  … 其余 ${warn.length - 20} 条`);
    }

    if (fail.length > 0) {
        console.error(`\n✗ 自洽校验未通过，共 ${fail.length} 项：`);
        for (const f of fail.slice(0, 40)) console.error(`  · ${f}`);
        if (fail.length > 40) console.error(`  … 其余 ${fail.length - 40} 项`);
        process.exitCode = 1;
    } else {
        console.log('\n✓ 通过：title/H1/canonical 合规，sitemap 与产物双向一致，noindex 未泄漏，_redirects 无跨域名写法且目标可达。');
    }
}

main().catch((e) => {
    console.error('校验脚本异常：', e);
    process.exitCode = 1;
});
