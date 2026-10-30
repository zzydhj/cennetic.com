/**
 * 线上验收：对已部署的站点跑真实 HTTP 检查。
 *
 * 为什么需要它而不是只看本地 dist：
 *   _headers 与 _redirects 只有 Cloudflare Pages 会解释，
 *   astro dev 与 astro preview 都不读这两个文件 —— 本地看数一律不算数。
 *
 *   npx tsx scripts/verify/live.ts [baseUrl]
 */
/*
 * BASE = Cloudflare Pages 项目名 + .pages.dev。项目名至今仍是 qfcncmachine-com
 * （改名要在 Pages → 项目 → Settings 里改，域名跟着变）。
 *
 * ⚠ 别拿「域名能不能解析」判断项目存在：带点的名字是泛解析 ——
 *   实测 zzz-not-a-project.com.pages.dev 一样能解析，并回一个 16KB 的
 *   Cloudflare 通用错误页（lang="en-US"、无品牌、无 /_astro/）；
 *   而不带点的乱名才是真 NXDOMAIN。判据要看响应体是不是我们的产物。
 */
const BASE = (process.argv[2] ?? 'https://qfcncmachine-com.pages.dev').replace(/\/$/, '');

interface Probe {
    status: number;
    location: string | null;
    headers: Record<string, string>;
}

/** 不发浏览器，直接看响应；手动拦住重定向以便读到 301 的 Location */
async function probeOnce(path: string): Promise<Probe> {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    await res.body?.cancel();
    return {
        status: res.status,
        location: headers['location'] ?? null,
        headers,
    };
}

/**
 * 带重试的 probe。
 *
 * 开发机走本地代理（本机 DNS 在做 fake-IP 劫持），偶发连接重置会把
 * fetch 抛成异常。上一版把这种情况当成站点功能失败报出去，而一个用来
 * 卡部署的检查如果常喊狼来了，人就会开始忽略它 —— 那它就等于不存在。
 * 所以只对「压根没拿到响应」重试，拿到状态码（包括 404）就不重试。
 */
async function probe(path: string, attempts = 3): Promise<Probe> {
    let lastError = '';
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await probeOnce(path);
        } catch (e) {
            lastError = (e as Error).message;
            await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
    }
    console.log(`  ! ${path} 连续 ${attempts} 次请求失败（${lastError}），按失败计入`);
    return { status: 0, location: null, headers: {} };
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

/**
 * 取一份正文（只用于从首页 HTML 里现取哈希资源名）。带重试：
 * 上一版这里是直接 fetch，代理一抖就没人接住那个异常，整个闸报栈退出，
 * 看起来像站点挂了一样 —— 那是工具的错，不是站点的错。
 */
async function fetchText(path: string, attempts = 4): Promise<string> {
    let lastError = '';
    for (let i = 0; i < attempts; i += 1) {
        try {
            const res = await fetch(`${BASE}${path}`);
            return await res.text();
        } catch (e) {
            lastError = (e as Error).message;
            await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        }
    }
    fail(`取不到 ${path} 的 HTML（网络失败：${lastError}），哈希资源一项未能验证`);
    return '';
}

// 哈希资源必须 immutable：从首页 HTML 里现取一个真实文件名，不写死
const homeHtml = await fetchText('/');
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

/**
 * 301 断言必须精确到路径本身，并且跟到目标拿 200。
 *
 * 之前用 includes() 做前缀匹配，放过了一条真 bug：_redirects 写成 /images/:path* 时
 * Pages 不认这种命名捕获，Location 变成 /images/<路径>*（尾 * 是字面量）→ 目标 404，
 * 但前缀相同照样判过。所以这里除了精确相等，还显式拒绝未替换的占位符（残留 * 或 :name）。
 */
function targetPathOk(location: string | null | undefined, expectTo: string): boolean {
    if (!location || /[*]/.test(location) || /\/:[a-z]/i.test(location)) return false;
    try {
        return new URL(location, BASE).pathname === expectTo;
    } catch {
        return false;
    }
}
async function targetStatus(loc: string): Promise<number> {
    try {
        const r = await fetch(new URL(loc, BASE).href, { redirect: 'manual', cache: 'no-store' });
        return r.status;
    } catch {
        return -1;
    }
}

const redirectCases: Array<{ path: string; expectTo: string }> = [
    { path: '/cart/', expectTo: '/products/' },
    { path: '/checkout/', expectTo: '/products/' },
    { path: '/my-account/', expectTo: '/products/' },
    // 这条同时盖住两个坑：通配占位符写错（产出带尾 * 的 404）与媒体文件换了目录
    // （banner.mp4 已搬到 /images/site/hero-banner.mp4，必须有显式规则）。
    { path: '/wp-content/uploads/2026/05/banner.mp4', expectTo: '/images/site/hero-banner.mp4' },
    // 真通配路径：只改前缀、不换名字的图
    { path: '/wp-content/uploads/2026/06/v-856-vmc-main.webp', expectTo: '/images/2026/06/v-856-vmc-main.webp' },
];
for (const c of redirectCases) {
    const p = await probe(c.path);
    if (p.status !== 301 || !targetPathOk(p.location, c.expectTo)) {
        fail(`${c.path} 期望 301 到 ${c.expectTo}，实际 ${p.status} Location=${p.location ?? '无'}`);
        continue;
    }
    const t = await targetStatus(p.location!);
    if (t === 200) pass(`${c.path} -> ${p.location}（目标 200）`);
    else fail(`${c.path} -> ${p.location} 但目标不可达：${t}`);
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
        if (p.status !== 301 || !targetPathOk(p.location, a.target ?? '')) {
            fail(`${a.path} 期望 301 到 ${a.target}，实际 ${p.status} Location=${p.location ?? '无'}`);
            continue;
        }
        const t = await targetStatus(p.location!);
        if (t === 200) pass(`${a.path} -> ${p.location}（目标 200）`);
        else fail(`${a.path} -> ${p.location} 但目标不可达：${t}`);
    }
} catch (e) {
    console.log(`  ! 读不到 url-manifest.json，跳过别名检查：${(e as Error).message}`);
}

// ── 5. 关键路径可达 ──────────────────────────────────────────
console.log('\n=== 5. 关键页面与资源 ===');
/*
 * 清单只列本站真实存在的资源：
 *   · /favicon.svg 已随品牌更换删除（旧的是红底 Q），BaseLayout 不再引用它；
 *   · /admin/config.yml 是 Decap CMS 时代的产物，后台已换成自写 React 应用。
 * 这两条长期报红只会掩盖真问题（例如 manifest 里残留的旧品牌主题色）。
 */
const must200 = [
    '/', '/blog/', '/blog/page/3/', '/cnc-gdt-guide/', '/product/v-856-vertical-machining-center/',
    '/products/', '/about-us/', '/contact-us/', '/news-and-media/', '/service/',
    '/category/technical-knowledge/', '/product-category/machining-centers/vertical-machining-centers/',
    '/admin/', '/images/site/hero-banner.mp4', '/images/site/hero-poster.webp',
    '/site.webmanifest', '/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png',
    '/icon-192.png', '/icon-512.png', '/sitemap-index.xml',
];
for (const p of must200) {
    const r = await probe(p);
    if (r.status === 200) pass(`200  ${p}`);
    else fail(`${r.status}  ${p}  ← 期望 200`);
}
const notFound = await probe('/this-page-should-not-exist-xyz/');
if (notFound.status === 404) pass('404  未知路径正确返回 404');
else fail(`未知路径返回 ${notFound.status}，期望 404`);

// ── 6. Pages Functions 端点在线 ──────────────────────────────
console.log('\n=== 6. Functions 端点 ===');
/*
 * 只断言「函数在、而且按设计拒人」，不往库里写任何东西：
 *   /api/inquiry 用空 body 打 → 必须 422 且回 JSON（不是 Pages 的 404 HTML）
 *   /api/publish  无凭据打   → 必须 401
 * 这两条能在函数没部署上、被路由遮蔽、或 Pages 回滚到旧构建时立刻报出来。
 * 不拿成功提交做断言：那会往库里留测试数据，而且依赖表存在与密钥配置。
 */
async function postJson(path: string, body: unknown): Promise<{ status: number; json: boolean; text: string }> {
    for (let i = 0; i < 3; i += 1) {
        try {
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            return { status: res.status, json: (res.headers.get('content-type') ?? '').includes('json'), text };
        } catch {
            await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
    }
    return { status: 0, json: false, text: '' };
}

const inq = await postJson('/api/inquiry', {});
if (inq.status === 422 && inq.json) pass('/api/inquiry 在线，空提交被服务端校验拦住（422 + JSON）');
else fail(`/api/inquiry 异常：HTTP ${inq.status} content-type=${inq.json ? 'json' : '非 JSON'} ${inq.text.slice(0, 80)}`);

const pub = await postJson('/api/publish', {});
if (pub.status === 401 && pub.json) pass('/api/publish 在线，无凭据被拒（401）');
else fail(`/api/publish 异常：HTTP ${pub.status} ${pub.text.slice(0, 80)}`);

// ── 汇总 ─────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✓ 线上验收全部通过' : `✗ 线上验收失败 ${failures} 项`}`);
process.exit(failures === 0 ? 0 : 1);
