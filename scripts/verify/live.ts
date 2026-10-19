/**
 * 线上验收：对已部署的站点跑真实 HTTP 检查。
 *
 * 为什么需要它而不是只看本地 dist：
 *   _headers 与 _redirects 只有 Cloudflare Pages 会解释，
 *   astro dev 与 astro preview 都不读这两个文件 —— 本地看数一律不算数。
 *
 *   npx tsx scripts/verify/live.ts [baseUrl]
 */
const BASE = (process.argv[2] ?? 'https://qfcncmachine-com.pages.dev').replace(/\/$/, '');

interface Probe {
    status: number;
    location: string | null;
    headers: Record<string, string>;
}

/** 不发浏览器，直接看响应；手动拦住重定向以便读到 301 的 Location */
async function probe(path: string): Promise<Probe> {
    try {
        const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
        await res.body?.cancel();
        return {
            status: res.status,
            location: headers['location'] ?? null,
            headers,
        };
    } catch (e) {
        return { status: 0, location: null, headers: {} };
    }
}

let failures = 0;
const fail = (msg: string) => {
    failures += 1;
    console.log(`  ✗ ${msg}`);
};
const pass = (msg: string) => console.log(`  ✓ ${msg}`);

// ── 1. _headers：缓存分层 ────────────────────────────────────
console.log(`\n目标 ${BASE}\n`);
console.log('=== 1. Cache-Control ===');

/**
 * Cloudflare Pages 会把多条命中规则的**同名头拼接**起来，不是后者覆盖前者。
 * 所以这里断言的是「期望值出现」而不是「整串相等」。
 * 拼接本身是隐患，由第 2 段专门检查。
 */
const cacheCases: Array<{ path: string; must: string; label: string }> = [
    { path: '/', must: 'max-age=0', label: 'HTML 不缓存' },
    { path: '/robots.txt', must: 'max-age=86400', label: 'robots 一天' },
    { path: '/sitemap-index.xml', must: 'max-age=3600', label: 'sitemap 一小时' },
    { path: '/images/site/hero-poster.webp', must: 'max-age=2592000', label: '图片 30 天' },
];

for (const c of cacheCases) {
    const p = await probe(c.path);
    const cc = p.headers['cache-control'] ?? '';
    if (cc.includes(c.must)) pass(`${c.label.padEnd(16)} ${c.path}  [${cc}]`);
    else fail(`${c.label} 未生效 ${c.path}  实际 [${cc || '无'}]`);
}

// 哈希资源必须 immutable：从首页 HTML 里现取一个真实文件名，不写死
const home = await fetch(`${BASE}/`);
const homeHtml = await home.text();
const asset = /href="(\/_astro\/[^"]+\.css)"/.exec(homeHtml)?.[1];
if (asset) {
    const p = await probe(asset);
    const cc = p.headers['cache-control'] ?? '';
    if (cc.includes('immutable')) pass(`哈希资源 immutable   ${asset}`);
    else fail(`哈希资源未 immutable ${asset}  实际 [${cc || '无'}]`);
} else {
    fail('首页 HTML 里找不到 /_astro/*.css 链接，构建可能异常');
}

// ── 2. 拼接冲突专项检查 ──────────────────────────────────────
console.log('\n=== 2. Cache-Control 是否被规则拼接污染 ===');
for (const p of ['/', asset ?? '/_astro/nonexistent.css', '/images/site/hero-poster.webp']) {
    const r = await probe(p);
    const cc = r.headers['cache-control'] ?? '';
    const maxAgeCount = (cc.match(/max-age=/g) ?? []).length;
    if (maxAgeCount > 1) {
        fail(`${p} 出现 ${maxAgeCount} 个 max-age（冲突值 ${cc}）`);
    } else if (maxAgeCount === 1) {
        pass(`${p} 只有 1 个 max-age`);
    }
}

// ── 3. 安全头 ────────────────────────────────────────────────
console.log('\n=== 3. 安全头 ===');
const root = await probe('/');
for (const h of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'strict-transport-security', 'permissions-policy']) {
    const v = root.headers[h];
    if (v) pass(`${h} = ${v.length > 70 ? `${v.slice(0, 70)}…` : v}`);
    else fail(`缺少 ${h}`);
}
// CSP 故意不加（会静默杀掉 Tawk 在线客服），这里只确认它确实没出现
if (root.headers['content-security-policy']) {
    console.log('  ! 出现了 CSP —— 与 08 里的决策不一致，需核对');
} else {
    pass('无 CSP（符合既定取舍：避免静默杀掉 Tawk）');
}

// ── 4. _redirects：301 别名 ──────────────────────────────────
console.log('\n=== 4. 重定向 ===');
const redirectCases: Array<{ path: string; expectTo: string }> = [
    { path: '/cart/', expectTo: '/products/' },
    { path: '/checkout/', expectTo: '/products/' },
    { path: '/my-account/', expectTo: '/products/' },
    { path: '/wp-content/uploads/2026/05/banner.mp4', expectTo: '/images/2026/05/banner.mp4' },
];
for (const c of redirectCases) {
    const p = await probe(c.path);
    if (p.status === 301 && (p.location ?? '').includes(c.expectTo)) {
        pass(`${c.path} -> ${p.location}`);
    } else {
        fail(`${c.path} 期望 301 到 ${c.expectTo}，实际 ${p.status} Location=${p.location ?? '无'}`);
    }
}

// 基线里的 5 条源站别名：从 url-manifest 动态取，不写死
try {
    const { readFileSync } = await import('node:fs');
    // 本文件在 scripts/verify/，往上两级才是仓库根（写成三级会跳到项目外面）
    const manifest = JSON.parse(readFileSync(new URL('../../migration/url-manifest.json', import.meta.url), 'utf8')) as {
        urls: Array<{ kind: string; path: string; target?: string }>;
    };
    const aliases = manifest.urls.filter((u) => u.kind === 'redirect');
    console.log(`\n  基线记录的源站别名 ${aliases.length} 条：`);
    for (const a of aliases) {
        const p = await probe(a.path);
        const ok = p.status === 301 && (p.location ?? '').includes(a.target ?? '');
        if (ok) pass(`${a.path} -> ${p.location}`);
        else fail(`${a.path} 期望 301 到 ${a.target}，实际 ${p.status} Location=${p.location ?? '无'}`);
    }
} catch (e) {
    console.log(`  ! 读不到 url-manifest.json，跳过别名检查：${(e as Error).message}`);
}

// ── 5. 关键路径可达 ──────────────────────────────────────────
console.log('\n=== 5. 关键页面与资源 ===');
const must200 = [
    '/', '/blog/', '/blog/page/3/', '/cnc-gdt-guide/', '/product/v-856-vertical-machining-center/',
    '/products/', '/about-us/', '/contact-us/', '/news-and-media/', '/service/',
    '/category/technical-knowledge/', '/product-category/machining-centers/vertical-machining-centers/',
    '/admin/', '/admin/config.yml', '/images/site/hero-banner.mp4', '/images/site/hero-poster.webp',
    '/site.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/sitemap-index.xml',
];
for (const p of must200) {
    const r = await probe(p);
    if (r.status === 200) pass(`200  ${p}`);
    else fail(`${r.status}  ${p}  ← 期望 200`);
}
const notFound = await probe('/this-page-should-not-exist-xyz/');
if (notFound.status === 404) pass('404  未知路径正确返回 404');
else fail(`未知路径返回 ${notFound.status}，期望 404`);

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✓ 线上验收全部通过' : `✗ 线上验收失败 ${failures} 项`}`);
process.exit(failures === 0 ? 0 : 1);
