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

/**
 * 品牌迁移（qfcncmachine.com + QiaoFeng → cennetic.com + Cennetic）留下的旧图文件名。
 *
 * 文件名里的品牌字样跟着一起改了，但 Google 图片搜索里已收录的还是旧路径，
 * 而且上一节那两条 /wp-content/uploads/ 通配 301 只做前缀替换、不会改文件名，
 * 所以旧名必须在这里逐条显式映射，否则图集体 404。
 *
 * 不随 url-manifest 推导：这是人工决策的改名，基线数据里没有这个信息。
 */
const IMAGE_RENAMES: Array<[string, string]> = [
    ['qiaofeng-jr-v85p-cnc-machine-dimensions-three-view-drawing.webp', 'cennetic-jr-v85p-cnc-machine-dimensions-three-view-drawing.webp'],
    ['qiaofeng-jr-v85p-core-configuration-mitsubishi-m80-bt40-spindle-servo.webp', 'cennetic-jr-v85p-core-configuration-mitsubishi-m80-bt40-spindle-servo.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-100x100.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-100x100.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-300x300.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-300x300.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-430x430.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-430x430.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-700x700.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-700x700.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-768x768.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-768x768.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working-800x800.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working-800x800.webp'],
    ['qiaofeng-jr-v85p-high-precision-machining-cnc-vmc-working.webp', 'cennetic-jr-v85p-high-precision-machining-cnc-vmc-working.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-100x100.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-100x100.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-300x300.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-300x300.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-430x430.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-430x430.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-700x700.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-700x700.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-768x768.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-768x768.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle-800x800.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle-800x800.webp'],
    ['qiaofeng-jr-v85p-vertical-machining-center-bt40-spindle.webp', 'cennetic-jr-v85p-vertical-machining-center-bt40-spindle.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-100x100.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-100x100.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-300x300.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-300x300.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-430x430.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-430x430.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-700x700.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-700x700.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-768x768.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-768x768.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view-800x800.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view-800x800.webp'],
    ['qiaofeng-l1060-hard-rail-heavy-cutting-machining-center-front-view.webp', 'cennetic-l1060-hard-rail-heavy-cutting-machining-center-front-view.webp'],
    ['qiaofeng-l1060-spindle-worktable-heavy-duty-base-detail.webp', 'cennetic-l1060-spindle-worktable-heavy-duty-base-detail.webp'],
    ['qiaofeng-L1060-vertical-machining-center-main.webp', 'cennetic-L1060-vertical-machining-center-main.webp'],
    ['qiaofeng-L1060-z-axis-column-structure-100x83.webp', 'cennetic-L1060-z-axis-column-structure-100x83.webp'],
    ['qiaofeng-L1060-z-axis-column-structure-430x358.webp', 'cennetic-L1060-z-axis-column-structure-430x358.webp'],
    ['qiaofeng-L1060-z-axis-column-structure.webp', 'cennetic-L1060-z-axis-column-structure.webp'],
];

/** 旧图所在目录（改名只动了文件名，没动年/月目录） */
const IMAGE_DIRS = ['2026/06'];

export async function buildDeployFiles(): Promise<void> {
    step('Phase 5 · 生成部署文件');

    const manifest = await readJson<{ urls: UrlRecord[]; deadSourceLinks?: string[] }>(
        join(MIGRATION_DIR, 'url-manifest.json'),
    );

    const aliases = manifest.urls.filter((u) => u.kind === 'redirect' && u.target);

    const lines: string[] = [
        '# 由 npm run migrate -- 08 依据 migration/url-manifest.json 生成，请勿手改。',
        '# 想改规则：改源站内容后重跑阶段 02 + 08；品牌迁移那节维护在 08 的常量里。',
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

    // ── 品牌迁移 ────────────────────────────────────
    // 旧域名 qfcncmachine.com → 新域名 www.cennetic.com 的主机级 301 **不能**写在这里：
    // Pages 的 _redirects 只按路径匹配来源，按整 URL（带主机名）开头的行无效。
    // 那一步必须在 Cloudflare Zone 层用 Redirect Rule / Bulk Redirects 完成（见部署清单）。
    // 本节只保留新域名上真正生效的“旧图名 → 新图名”路径 301。
    lines.push(
        '',
        `# ── 品牌迁移：旧图文件名 → 新图文件名（${IMAGE_RENAMES.length} 张，通配规则盖不住改名）──`,
        '# 前提：qfcncmachine.com 已在 Zone 层整域 301 到 www.cennetic.com 并保留路径；',
        '# 旧图 URL 先经 /wp-content→/images 通配落到 /images/<旧名>，再由下面规则落到 <新名>。',
    );
    for (const dir of IMAGE_DIRS) {
        for (const [oldName, newName] of IMAGE_RENAMES) {
            lines.push(`/images/${dir}/${oldName}   /images/${dir}/${newName}   301`);
        }
    }

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
    log(
        `✓ ${rel(join(PUBLIC_DIR, '_redirects'))}  —— ${aliases.length} 条别名 + ${DEAD_TO_PRODUCTS.length} 条死路径 + ` +
        `${IMAGE_RENAMES.length * IMAGE_DIRS.length} 条图片改名 + 2 条图片通配（旧域名整域 301 需在 Cloudflare Zone 层配）`,
    );
    log(`✓ ${rel(join(PUBLIC_DIR, 'robots.txt'))}`);
    log(`  源：${SRC_ORIGIN}（基线生成，勿手改）`);
}

/**
 * Cloudflare Pages 的缓存与安全响应头。
 *
 * ⚠ 一个不写出来就一定会踩的坑：Cloudflare 对多条命中规则的**同名头是拼接**，
 * 不是后者覆盖前者（官方原文："If a header is applied twice in the _headers file,
 * the values are joined with a comma separator"）。
 *
 * 所以如果 /* 里写了 Cache-Control，它会被拼到每一条更具体的规则后面，得到：
 *   public, max-age=0, must-revalidate, public, max-age=31536000, immutable
 * 而 RFC 9111 规定：同一指令出现多个值时，取**第一个**，或者直接把响应当作过期；
 * 指令互相冲突时取**最严**的那个。两个条件同时命中——max-age=0 在前、must-revalidate
 * 更严。结果是看似配了 immutable，实际每次回访仍然回源验证，缓存层完全白做。
 * 上一版就是这么错的，线上实测才拆穿。
 *
 * 正确做法是官方给的撤销语法：在头名前加 `! `（感叹号加空格）先移除继承值，再设新值。
 * 下面每条带 Cache-Control 的规则都必须以 `! Cache-Control` 开头，一个都不能漏。
 *
 * 缓存分层本身：
 *   /_astro/*   文件名带内容哈希，改了必改名，可放心 immutable 一年
 *   /images/*   URL 固定但内容可能被重新上传顶掉，给 30 天 + stale-while-revalidate
 *   sitemap     必须短，否则 Google 看不到新发的文章
 *   HTML        max-age=0 + must-revalidate：发布后不能让用户看到旧页面
 *
 * 几项故意没加，是取舍不是遗漏：
 *   Content-Security-Policy —— 页面上跑 Tawk.to（注入 script/style/iframe 到多个域名）
 *     和 GA4，离线无法穷举它们的全部端点。写窄一条就会把在线客服静默杀掉，
 *     而在线客服正是本站去掉询价表单之后的唯一转化路径。要加就在 Cloudflare
 *     上先跑只报告模式（Content-Security-Policy-Report-Only）收集一周再收紧。
 *   COEP / COOP —— 会让 Tawk 的跳源请求被挡，同上。
 *   X-Frame-Options 用 SAMEORIGIN 不用 DENY：需要允许自家页面嵌自家内容。
 */

/** 撤销由 /* 继承下来的 Cache-Control，再设本规则自己的值 */
const UNSET_CC = '! Cache-Control';

const HEADER_RULES: Array<{ path: string; headers: string[]; why: string }> = [
    {
        path: '/*',
        why: '全局安全头 + HTML 不缓存（作为基线，更具体的规则用 ! 撤销后重设）',
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
        headers: [UNSET_CC, 'Cache-Control: public, max-age=31536000, immutable'],
    },
    {
        path: '/images/*',
        why: '图片与视频（现 Pages 托管，后续走 R2）',
        // 只撤销 Cache-Control：CORP 已由 /* 全局给出，在这里再写一次会被
        // 拼接成 "cross-origin, cross-origin"——同一个坑不能踩两遍。
        headers: [
            UNSET_CC,
            'Cache-Control: public, max-age=2592000, stale-while-revalidate=86400',
        ],
    },
    {
        path: '/uploads/*',
        why: '后台上传的媒体（与 /images 同级策略）',
        headers: [
            UNSET_CC,
            'Cache-Control: public, max-age=2592000, stale-while-revalidate=86400',
        ],
    },
    {
        path: '/favicon.ico',
        why: '图标不随内容变，给长缓存（旧版只配了 /favicon.svg，换品牌图标后已不存在）',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=604800'],
    },
    {
        path: '/favicon-*.png',
        why: '16/32 的 PNG 版 favicon 与 ico 同策略',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=604800'],
    },
    {
        path: '/apple-touch-icon.png',
        why: '图标长缓存（上一版漏了，它们落在 /* 上被当成 HTML 不缓存）',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=604800'],
    },
    {
        path: '/icon-*.png',
        why: '图标长缓存',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=604800'],
    },
    {
        path: '/site.webmanifest',
        why: 'manifest 要长缓存，但改图标时得能生效',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=86400'],
    },
    {
        path: '/sitemap-index.xml',
        why: 'sitemap 必须短，否则 Google 看不到新文章',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=3600'],
    },
    {
        path: '/sitemap-*.xml',
        why: 'sitemap 分片同样要短',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=3600'],
    },
    {
        path: '/robots.txt',
        why: 'robots 一天',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=86400'],
    },
    {
        path: '/admin/*',
        why: '后台入口与其静态资源不缓存，避免发布后编辑看到旧配置',
        headers: [UNSET_CC, 'Cache-Control: public, max-age=0, must-revalidate'],
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
