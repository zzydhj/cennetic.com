/**
 * Phase 0-2 · 建立 URL 基线清单 —— 整个迁移唯一验收标准。
 *
 * 三步合并出完整 URL 集合：
 *   1. 四个 Rank Math sitemap 分片（主索引源）
 *   2. REST 数据推导出的 URL（补 sitemap 未收录的页，如 /blog/）
 *   3. 分页边界探测（/category/x/page/N/ 这类 Google 可能已收录但 sitemap 不列的 URL）
 *
 * 对每个 URL 抓取已渲染 HTML，提取 title / canonical / robots / description / lastmod，
 * 并顺带把整页 HTML 存进缓存 —— 它既是 SEO 基线，也是原始站点备份。
 *
 * 输出：migration/url-manifest.json
 */
import { MIGRATION_DIR, SRC_ORIGIN, SITEMAPS, pathOf, API, API_CACHE_DIR, SITE_HOST_PATTERN } from './lib/config.ts';
import { fetchText, headStatus } from './lib/http.ts';
import { join, writeJson, readJson, rel, log, step } from './lib/fs.ts';
import { extractHeadSeo } from './lib/html.ts';
import type { UrlRecord, SitemapEntry, WpPost, WpCategory, StoreProduct, StoreProductCategory } from './lib/types.ts';

const MANIFEST_FILE = join(MIGRATION_DIR, 'url-manifest.json');

/**
 * 读取 01 阶段的 REST 产物。
 * 这里故意不容忍缺失：少了任何一个集合都会导致 URL 清单静默变短，
 * 而清单是唯一验收标准，宁可当场失败也不能少算。
 */
async function requireApi<T>(file: string): Promise<T> {
    const path = join(API_CACHE_DIR, file);
    const value = await readJson<T>(path, null as T);
    if (value === null) {
        throw new Error(`缺少 REST 缓存 ${rel(path)}，请先执行：npm run migrate -- 01`);
    }
    return value;
}

/** 分页探测上限，防御无限递增 */
const MAX_PAGE_PROBE = 40;

interface Candidate {
    url: string;
    source: string;
    lastmod?: string;
}

/** 按 path 去重的候选池 */
const pool = new Map<string, Candidate>();

function add(url: string, source: string, lastmod?: string): void {
    const path = normalizePath(pathOf(url));
    if (pool.has(path)) {
        // sitemap 来源优先级更高，保留其 lastmod
        const existing = pool.get(path)!;
        if (lastmod && !existing.lastmod) existing.lastmod = lastmod;
        return;
    }
    pool.set(path, { url: `${SRC_ORIGIN}${path}`, source, lastmod });
}

/** 统一成带尾斜杠的 path；根路径为 '/' */
function normalizePath(rawPath: string): string {
    const p = rawPath.split('?')[0].split('#')[0];
    if (p === '' || p === '/') return '/';
    return p.endsWith('/') ? p : `${p}/`;
}

/** 根据 path 判定内容类型，用于后续映射 Astro 模板 */
function classify(path: string): UrlRecord['kind'] {
    if (path === '/') return 'home';
    if (/^\/product\/[^/]+\/$/.test(path)) return 'product';
    if (/^\/product-category\/.+\/$/.test(path)) return 'product-category';
    // path 已经统一过尾斜杠，所以分类页是 /category/<slug>/ 或 /category/<slug>/page/N/
    if (/^\/category\/[^/]+\/(page\/\d+\/)?$/.test(path)) return 'blog-category';
    if (/^\/(shop|products|blog|news-and-media)\/(page\/\d+\/)?$/.test(path)) return 'archive-page';
    // 顶级单段路径：要么是 WP 页面，要么是文章。由 API 归属精确判定，这里先给保守值。
    if (/^\/[^/]+\/$/.test(path)) return 'page';
    return 'other';
}

/** 解析 Rank Math 的 sitemap XML */
async function parseSitemap(url: string): Promise<SitemapEntry[]> {
    const xml = await fetchText(url, { kind: 'sitemap' });
    if (!xml) return [];

    const entries: SitemapEntry[] = [];
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

    for (const block of urlBlocks) {
        const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim();
        if (!loc || !loc.startsWith('http')) continue;
        const imageLocs = [...block.matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/g)].map((m) => m[1].trim());
        entries.push({
            loc,
            lastmod: block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1]?.trim(),
            images: imageLocs,
        });
    }

    return entries;
}

/** 从 N=2 起递增探测归档分页，直到首个非 200 */
async function probePagination(basePath: string, source: string): Promise<number> {
    let found = 0;
    for (let n = 2; n <= MAX_PAGE_PROBE; n += 1) {
        const url = `${SRC_ORIGIN}${basePath}page/${n}/`;
        const status = await headStatus(url);
        if (status !== 200) break;
        add(url, source);
        found += 1;
    }
    return found;
}

/**
 * 抓取单个页面 HTML，抽取 head SEO，并收割页内站内链接。
 * HTML 本身留在 http 缓存里，同时充当源站备份。
 *
 * 必须收割链接：sitemap 与 REST 都会漏掉页。实测首页导航里有 9 个产品分类，
 * 而 /wc/store/v1/products/categories 只返回 5 个（其余 4 个产品数为 0 不出现），
 * sitemap 也不列。不收割就会漏建页面，上线直接变 404。
 */
async function seoFor(url: string): Promise<{ meta: Partial<UrlRecord>; links: string[]; status: number }> {
    const html = await fetchText(url, { kind: 'page-html', allow404: true });
    // fetchText 对 allow404 返回 null；其余非 200 会抛异常，到此只能区分「有内容」与「无内容」
    if (html === null) return { meta: {}, links: [], status: 404 };

    const seo = extractHeadSeo(html);

    const links: string[] = [];
    // 旧域名与新域名都要收：品牌迁移前抓的缓存 HTML 里写的是旧域名
    const selfHosts = new RegExp(`<a[^>]+href=["']https?://(${SITE_HOST_PATTERN})([^"'?#]*)[^>]*>`, 'gi');
    for (const m of html.matchAll(selfHosts)) {
        const p = m[2];
        if (!p) continue;
        if (/\.(png|jpe?g|webp|svg|gif|pdf|zip|css|js)$/i.test(p)) continue;
        if (/^\/(wp-json|wp-admin|wp-login|wp-content|wc-api|cart|my-account|checkout|feed)\b/i.test(p)) continue;
        links.push(p);
    }

    return {
        meta: {
            title: seo.title,
            canonical: seo.canonical ? normalizePath(pathOf(seo.canonical)) : undefined,
            robots: seo.robots,
            description: seo.description,
        },
        links,
        status: 200,
    };
}

export async function buildManifest(refresh = false): Promise<void> {
    step('Phase 0-2 · 建立 URL 基线清单');
    pool.clear();

    // ── 1. sitemap ──────────────────────────────────────────────
    log('① 解析 Rank Math sitemap 分片');
    for (const sm of SITEMAPS) {
        const entries = await parseSitemap(sm);
        for (const e of entries) add(e.loc, `sitemap:${sm.split('/').pop()}`, e.lastmod);
        log(`  ${sm.split('/').pop()} -> ${entries.length} 条`);
    }
    log(`  sitemap 合计 ${pool.size} 条唯一 URL`);

    // ── 2. REST 推导 ────────────────────────────────────────────
    log('② 用 REST 数据补齐 sitemap 遗漏的 URL');
    const posts = await requireApi<WpPost[]>('posts.json');
    const pages = await requireApi<WpPost[]>('pages.json');
    const blogCats = await requireApi<WpCategory[]>('categories.json');
    const products = await requireApi<StoreProduct[]>('products.json');
    const prodCats = await requireApi<StoreProductCategory[]>('product-categories.json');

    for (const p of posts) add(p.link, 'api:posts');
    for (const p of pages) add(p.link, 'api:pages');
    for (const c of blogCats) if (c.link) add(c.link, 'api:categories');
    for (const pr of products) add(pr.permalink, 'api:products');
    for (const pc of prodCats) add(pc.permalink, 'api:product-categories');

    // /blog/ 不在 sitemap 里但返回 200 且 index，必须纳入
    add(`${SRC_ORIGIN}/blog/`, 'known:blog');
    add(`${SRC_ORIGIN}/shop/`, 'known:shop');

    log(`  合计 ${pool.size} 条唯一 URL`);

    // ── 3. 分页探测 ─────────────────────────────────────────────
    log('③ 探测归档分页（sitemap 不收录，但 Google 可能已抓取）');
    const archivePaths = [...pool.keys()].filter(
        (p) => /^\/category\/[^/]+\/$/.test(p) || p === '/blog/' || p === '/shop/' || /^\/product-category\/.+\/$/.test(p),
    );

    let pagedTotal = 0;
    for (const basePath of archivePaths) {
        const found = await probePagination(basePath, 'pagination-probe');
        if (found > 0) {
            pagedTotal += found;
            log(`  ${basePath} +${found} 页`);
        }
    }
    log(`  分页 URL 合计 ${pagedTotal} 条`);

    // ── 4. 逐 URL 抽取 head SEO + 收割内链（有界广度遍历）───────
    // 新一波发现的链接归入 'link-harvest'，最多再跑两轮防止图爆炸。
    const records: UrlRecord[] = [];
    const dead: string[] = [];
    let wave = 0;
    let pending = [...pool.keys()];

    while (pending.length > 0 && wave < 3) {
        wave += 1;
        log(`④ 第 ${wave} 轮：抓取 ${pending.length} 个页面（HTML 同步进缓存作源站备份）`);

        const next: string[] = [];
        let done = 0;

        for (const path of pending) {
            const cand = pool.get(path)!;
            const { meta, links, status } = await seoFor(cand.url);

            // 源站就不是 200 的链接不进入验收基准，单独记一笔供人工判断
            if (status !== 200) {
                dead.push(path);
                continue;
            }

            records.push({
                path,
                url: cand.url,
                status,
                source: cand.source,
                lastmod: cand.lastmod,
                kind: classify(path),
                ...meta,
            });
            for (const l of links) {
                const p = normalizePath(pathOf(l));
                if (pool.has(p)) continue;
                add(`${SRC_ORIGIN}${p}`, 'link-harvest');
                next.push(p);
            }

            done += 1;
            if (done % 20 === 0 || done === pending.length) log(`  ${done}/${pending.length}`);
        }

        if (next.length > 0) log(`  本轮新收割出 ${next.length} 个之前未登记的 URL`);
        pending = next;
    }

    // 用 API 归属修正顶级单段路径的 kind（page vs article）
    const pageSlugs = new Set(pages.map((p) => normalizePath(pathOf(p.link))));
    for (const r of records) {
        if (r.kind === 'page' && !pageSlugs.has(r.path)) r.kind = 'article';
    }

    /**
     * 别名识别：抓取路径与页面自声明的 canonical 不一致，说明源站在做 301。
     * 典型是正文里写的 /blog/<slug>/ 被重定向到顶级 /<slug>/。
     * 这类绝对不能再当独立页面构建，否则同一内容两个 URL = 重复内容；
     * 但它们必须进 _redirects，否则从旧收录链接点进来就是 404。
     */
    let aliases = 0;
    for (const r of records) {
        if (!r.canonical || r.canonical === r.path) continue;
        r.kind = 'redirect';
        r.target = r.canonical;
        aliases += 1;
    }
    if (aliases > 0) log(`  识别出 ${aliases} 个源站 301 别名页，将写入 _redirects 而不构建为页面`);

    records.sort((a, b) => a.path.localeCompare(b.path));

    await writeJson(MANIFEST_FILE, {
        generatedAt: new Date().toISOString(),
        origin: SRC_ORIGIN,
        api: API,
        counts: tally(records),
        /** 导航/正文里链到、但源站本身就 404 的路径。不进入验收基准，也不做 301 */
        deadSourceLinks: dead.sort(),
        urls: records,
    });

    log('');
    log('✓ 基线清单统计');
    if (dead.length > 0) log(`  另有 ${dead.length} 个站内链接在源站就是 404，已排除在基准外：${dead.slice(0, 8).join(', ')}${dead.length > 8 ? ' …' : ''}`);
    for (const [kind, n] of Object.entries(tally(records))) log(`    ${kind.padEnd(18)} ${n}`);

    // 归不了类的 URL = 没有对应模板 = 上线就是 404。必须当场报出来，不能静默滑过。
    const unknown = records.filter((r) => r.kind === 'other');
    if (unknown.length > 0) {
        log('');
        log(`⚠ 有 ${unknown.length} 条 URL 未能归类，没有模板承接，请补规则后重跑 02：`);
        for (const u of unknown) log(`    ${u.path}`);
    }

    log(`  输出：${rel(MANIFEST_FILE)}`);
}

function tally(records: UrlRecord[]): Record<string, number> {
    const out: Record<string, number> = { total: records.length };
    for (const r of records) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
}
