/**
 * Phase 5 · 生成 Cloudflare Pages 部署文件：_redirects、_headers 与 robots.txt。
 *
 * _redirects 的内容不是手写的规则清单，而是从阶段 02 的 URL 基线**推导**出来的：
 * 凡源站靠 301 把 A 送到 B 的别名（实测 5 条，主要是正文里的 /blog/<slug>/ 写法），
 * 新站必须原样接住 —— 否则从旧收录链接点进来就是 404，白白丢掉已挣到的排名流量。
 *
 * 基线变了就重跑本阶段，规则不会和实际页面脱节。
 */
import { MIGRATION_DIR, ROOT, SITE_ORIGIN, SRC_ORIGIN } from './lib/config.ts';
import { join, writeText, readJson, rel, log, step } from './lib/fs.ts';
import type { UrlRecord } from './lib/types.ts';

const PUBLIC_DIR = join(ROOT, 'public');

/**
 * 源站已失效但仍可能被外链指向的交易类路径。
 * 购物车随纯静态化下线，统一 301 到产品列表，不给死链留 404。
 */
const DEAD_TO_PRODUCTS = ['/cart/', '/checkout/', '/my-account/', '/product-cat/'];

export async function buildDeployFiles(): Promise<void> {
    step('Phase 5 · 生成部署文件');

    const manifest = await readJson<{ urls: UrlRecord[]; deadSourceLinks?: string[] }>(
        join(MIGRATION_DIR, 'url-manifest.json'),
    );

    const aliases = manifest.urls.filter((u) => u.kind === 'redirect' && u.target);

    const lines: string[] = [
        '# 由 npm run migrate -- 08 依据 migration/url-manifest.json 生成，请勿手改。',
        '# 想改规则：改源站内容后重跑阶段 02 + 08。',
        '',
        '# ── 源站 301 别名（正文写成 /blog/<slug>/ 而实际文章在顶级路径）──',
    ];

    for (const a of aliases) {
        lines.push(`${a.path} ${a.target} 301`);
    }

    lines.push(
        '',
        '# ── 已下线的 WooCommerce 交易路径 → 产品列表 ──',
    );
    for (const p of DEAD_TO_PRODUCTS) lines.push(`${p} /products/ 301`);

    lines.push(
        '',
        '# ── 源站图片旧路径 → 新站 /images/ ──',
        '# Google 已收录这些图片 URL，保留 301 以免图片搜索结果里的图集体失效。',
        '/wp-content/uploads/:year/:month/:file*  /images/:year/:month/:file*  301',
        '/wp-content/uploads/:path*  /images/:path*  301',
        '',
        '# ── 源站正文链到、但源站自己就已 404 的链接 ──',
        '# 不重定向（重定向到不相关页会欺骗爬虫），交给 404 页给出出路。',
    );
    for (const dead of manifest.deadSourceLinks ?? []) {
        lines.push(`# dead on source: ${dead}`);
    }

    lines.push('', `# Sitemap ${SITE_ORIGIN}/sitemap-index.xml`, '');

    await writeText(join(PUBLIC_DIR, '_redirects'), lines.join('\n'));

    // ── robots.txt ───────────────────────────────────────────
    // 沿用源站的 Sitemap 声明，但去掉全部 wp-* 规则：新站没有 WordPress，
    // 留着等于向爬虫宣告旧技术栈还在，且浪费抓取预算在不存在的路径上。
    await writeText(
        join(PUBLIC_DIR, 'robots.txt'),
        [
            'User-agent: *',
            'Allow: /',
            '',
            '# 后台是纯静态页，不需要被收录（同时已在 sitemap 的 filter 里排除）',
            'Disallow: /admin/',
            '',
            `Sitemap: ${SITE_ORIGIN}/sitemap-index.xml`,
            '',
        ].join('\n'),
    );

    log('');
    log(`✓ ${rel(join(PUBLIC_DIR, '_redirects'))}  —— ${aliases.length} 条别名 + ${DEAD_TO_PRODUCTS.length} 条死路径 + 2 条图片通配`);
    log(`✓ ${rel(join(PUBLIC_DIR, 'robots.txt'))}`);
    log(`  源：${SRC_ORIGIN}（基线生成，勿手改）`);
}

/**
 * Cloudflare Pages 的缓存与安全响应头。
 *
 * 缓存分层是实际的 CWV 收益点，不是装饰：
 *   /_astro/*  文件名带内容哈希，改了必改名，所以可放心 immutable 一年；
 *              不这么设的话回访用户会重新下完整个 CSS/JS 包。
 *   /images/*   URL 固定而内容可能被重新上传顶掉，所以给 30 天而不是 immutable，
 *              配 stale-while-revalidate 让用户先拿到旧图、后台再刷。
 *   sitemap    必须短，否则 Google 看不到新发的文章。
 *   HTML       max-age=0 + must-revalidate：发布后不能让用户看到旧页面。
 *
 * 几项故意没加，是取舍不是遗漏：
 *   Content-Security-Policy —— 页面上跑 Tawk.to（注入 script/style/iframe 到多个域名）
 *     和 GA4，离线无法穷举它们的全部端点。写窄一条就会把在线客服静默杀掉，
 *     而在线客服正是本站去掉询价表单之后的唯一转化路径。要加就在 Cloudflare
 *     上先跑只报告模式（Content-Security-Policy-Report-Only）收集一周再收紧。
 *   COEP / COOP —— 会让 Tawk 的跳源请求被挡，同上。
 *   X-Frame-Options 用 SAMEORIGIN 不用 DENY：需要允许自家页面嵌自家内容。
 */
const HEADER_RULES: Array<{ path: string; headers: string[]; why: string }> = [
    {
        path: '/*',
        why: '全局安全头 + HTML 不缓存',
        headers: [
            'X-Content-Type-Options: nosniff',
            'Referrer-Policy: strict-origin-when-cross-origin',
            'X-Frame-Options: SAMEORIGIN',
            'Cross-Origin-Resource-Policy: cross-origin',
            // Tawk 可能用麦克风与定位，这两项不能关；其余用不到的能力全部收紧
            'Permissions-Policy: accelerometer=(), camera=(), display-capture=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=(), xr-spatial-tracking=()',
            // 不上 includeSubDomains：子域还没全部 HTTPS 化就会把它们一并锁死
            'Strict-Transport-Security: max-age=15552000',
            'Cache-Control: public, max-age=0, must-revalidate',
        ],
    },
    {
        path: '/_astro/*',
        why: '内容哈希资源，immutable 一年',
        headers: ['Cache-Control: public, max-age=31536000, immutable'],
    },
    {
        path: '/images/*',
        why: '图片（现 Pages 托管，后续走 R2）',
        headers: [
            'Cache-Control: public, max-age=2592000, stale-while-revalidate=86400',
            'Cross-Origin-Resource-Policy: cross-origin',
        ],
    },
    {
        path: '/sitemap-index.xml',
        why: 'sitemap 要短缓存',
        headers: ['Cache-Control: public, max-age=3600'],
    },
    {
        path: '/sitemap-*.xml',
        why: 'sitemap 分片要短缓存',
        headers: ['Cache-Control: public, max-age=3600'],
    },
    {
        path: '/robots.txt',
        why: 'robots 一天',
        headers: ['Cache-Control: public, max-age=86400'],
    },
];

export async function buildHeaders(): Promise<void> {
    step('Phase 5 · 生成 _headers');

    const lines: string[] = [
        '# 由 npm run migrate -- 08 生成，请勿手改。',
        '# 几项安全头（CSP / COEP / COOP）故意未加，理由见本文件顶部注释。',
        '',
    ];

    for (const rule of HEADER_RULES) {
        lines.push(rule.path);
        for (const h of rule.headers) lines.push(`  ${h}`);
        lines.push('');
    }

    await writeText(join(PUBLIC_DIR, '_headers'), lines.join('\n'));
    log(`✓ ${rel(join(PUBLIC_DIR, '_headers'))}  —— ${HEADER_RULES.length} 条规则`);
}
