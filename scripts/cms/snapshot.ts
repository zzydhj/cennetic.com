/**
 * 发布快照：Supabase → git 内容文件（前台构建的唯一数据源）
 *
 * 用法：
 *   npx tsx scripts/cms/snapshot.ts            写盘（发布链路执行）
 *   npx tsx scripts/cms/snapshot.ts --check    只比对不写盘，任何不一致退出码 1（回归闸）
 *
 * 保真约定（与 scripts/migrate 的产出逐字对齐，否则快照会制造无意义 diff）：
 *  - frontmatter 键序 = 04-articles.ts / 07-pages.ts 中的字面顺序，null/undefined/'' 由
 *    toFrontmatter 自动省略，因此库里留空 = 文件里没这一行；
 *  - .md 正文 = toFrontmatter(...) + '\n' + body(去首尾空白) + '\n'；
 *  - .json = JSON.stringify(v, null, 2) + '\n'；site.json 直接回写库里的原文；
 *  - jsonb 不保证对象键序，故嵌套对象（faq/images/specs/categories）在此显式重建；
 *  - 只有 status='published' 的行进入快照：行被删除或转草稿 → 对应文件一并删除；
 *  - src/data/menu.json 不由库供给（仍手工维护），本脚本绝不触碰。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toFrontmatter } from '../migrate/lib/frontmatter.ts';
import { CODE_OWNED_PAGE_SLUGS } from '../../src/lib/locked-pages.ts';
import { ROOT, loadEnvFile, requireEnv } from './lib/env.ts';
import { createRestClient } from './lib/rest.ts';

type Json = Record<string, unknown>;

interface ArticleRow {
    slug: string;
    title: string;
    heading: string;
    description: string;
    canonical: string | null;
    date: string;
    lastmod: string | null;
    modified: string | null;
    categories: string[];
    author: string | null;
    hero: string | null;
    hero_alt: string | null;
    hero_width: number | null;
    hero_height: number | null;
    robots: string;
    word_count: number;
    reading_minutes: number;
    faq: Json[] | null;
    body: string;
    source_id: number | null;
}

interface PageRow {
    slug: string;
    title: string;
    heading: string;
    description: string;
    canonical: string | null;
    robots: string;
    date: string | null;
    lastmod: string | null;
    hero: string | null;
    menu_order: number;
    is_listing: boolean;
    author: string | null;
    faq: Json[] | null;
    body: string;
    source_id: number | null;
}

interface ProductRow {
    slug: string;
    name: string;
    canonical: string;
    summary: string;
    body: string;
    images: Json[] | null;
    categories: string[] | null;
    specs: Json[] | null;
    faq: Json[] | null;
}

interface BlogCategoryRow {
    slug: string;
    name: string;
    description: string;
    title: string | null;
    robots: string;
    count: number;
}

interface ProductCategoryRow {
    slug: string;
    name: string;
    description: string;
    parent: string;
    canonical: string;
    trail: string[];
    robots: string;
    title: string;
    count: number;
}

interface AuthorRow {
    slug: string;
    name: string;
    role: string;
    bio: string;
    avatar: string;
}

/** 受快照管理的目录：目录 → 扩展名。目录内不属于本次生成集的同类型文件会被删除。 */
const MANAGED_DIRS: Array<{ dir: string; ext: string }> = [
    { dir: 'src/content/articles', ext: '.md' },
    { dir: 'src/content/pages', ext: '.md' },
    { dir: 'src/data/products', ext: '.json' },
    { dir: 'src/data/blog-categories', ext: '.json' },
];

const CHECK = process.argv.includes('--check');
const ALLOW_EMPTY = process.argv.includes('--allow-empty');

// ── 小工具：把库里的值还原成 frontmatter/JSON 里的形状 ─────────────────────
const opt = (v: unknown): string | undefined => (v == null || v === '' ? undefined : String(v));
const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v));

/** FAQ 固定为 {q,a}：显式重建键序，且空数组要还原成「字段不存在」 */
function faqOf(list: Json[] | null): Json[] | undefined {
    const items = (list ?? []).map((f) => ({ q: String(f.q ?? ''), a: String(f.a ?? '') }));
    return items.length > 0 ? items : undefined;
}

function imagesOf(list: Json[] | null): Json[] {
    return (list ?? []).map((im) => ({
        src: String(im.src ?? ''),
        alt: typeof im.alt === 'string' ? im.alt : '',
        width: Number(im.width ?? 0),
        height: Number(im.height ?? 0),
    }));
}

function specsOf(list: Json[] | null): Json[] {
    return (list ?? []).map((sp) => ({
        name: String(sp.name ?? ''),
        values: Array.isArray(sp.values) ? sp.values.map(String) : [],
    }));
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** 正文在 .md 里不带首尾空白（migrate 阶段已 trim 过），库里可能残留换行 */
const mdBody = (body: string | null): string => String(body ?? '').trim();

/** 文件名用的 slug 必须安全，避免 ../ 或路径分隔符越界写盘 */
function assertSlug(table: string, slug: string): void {
    if (!slug || /[\\/]/.test(slug) || slug === '.' || slug === '..') {
        throw new Error(`${table} 存在非法 slug：「${String(slug)}」`);
    }
}

/**
 * 形状守卫：日期列必须是「原文」（裸 ISO，可只到日），站点数据必须是 JSON 文本。
 * 一旦看到 +00:00 / Z / 小数秒，说明库列仍是 timestamptz（或 site 仍是 jsonb），
 * 此时快照会把 124 个文件的日期改写 → 必须 fail-loud，绝不能静默上线。
 */
const MIGRATION_HINT = '请先在 Supabase SQL Editor 执行 supabase/migrations/0002_dates_and_rawtext.sql，再重跑 npm run cms:seed';

function assertDateText(table: string, col: string, v: unknown): void {
    if (v == null || v === '') return;
    const s = String(v);
    if (/[z+]/i.test(s) || /\.\d/.test(s) || !/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/.test(s)) {
        throw new Error(`${table}.${col} 存的是「${s}」，不是原文日期。${MIGRATION_HINT}`);
    }
}

/**
 * 代码自有页守卫：About Us / Service / 两份政策的内容在 git 里
 * （src/pages/<slug>.astro），不属于后台管理范围。库里若出现同名 published 行
 * （后台手工重建、从备份恢复、别人在 Supabase 控制台插行），快照会往
 * src/content/pages/ 写 <slug>.md，那个路径就会被静态路由与 [slug].astro 各渲染一次 ——
 * 整页样式错乱且构建不报错。宁可在这里把发布拦住，并说清该怎么改。
 */
export function assertNoCodeOwnedPages(
    pages: Array<{ slug: string }>,
): void {
    const bad = pages
        .map((p) => p.slug)
        .filter((s) => (CODE_OWNED_PAGE_SLUGS as readonly string[]).includes(s));
    if (bad.length === 0) return;
    throw new Error(
        `pages 表里出现了代码自有页：${bad.join(', ')}。\n` +
            `  这几页的内容写死在 git（src/pages/<slug>.astro），后台不开放编辑。\n` +
            `  请删除这些行、或把 slug 改成别的名字，否则发布会得到一份与静态路由\n` +
            `  同路径的内容文件，同一 URL 被渲染两次 → 整页样式错乱且构建不报错。`,
    );
}

function assertShape(
    articles: ArticleRow[],
    pages: PageRow[],
    siteData: string,
): void {
    for (const a of articles) {
        assertDateText('articles', 'date', a.date);
        assertDateText('articles', 'lastmod', a.lastmod);
        assertDateText('articles', 'modified', a.modified);
    }
    for (const p of pages) {
        assertDateText('pages', 'date', p.date);
        assertDateText('pages', 'lastmod', p.lastmod);
    }
    if (!/^\s*\{/.test(String(siteData))) {
        throw new Error(`site_settings.data 不是 site.json 原文（收到「${String(siteData).slice(0, 40)}」）。${MIGRATION_HINT}`);
    }
}

async function collect(): Promise<Map<string, string>> {
    const rest = createRestClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'));
    const out = new Map<string, string>();

    const [articles, pages, products, blogCats, prodCats, authors, siteRows] = await Promise.all([
        rest.list<ArticleRow>('articles', 'select=*&status=eq.published&order=slug.asc'),
        rest.list<PageRow>('pages', 'select=*&status=eq.published&order=slug.asc'),
        rest.list<ProductRow>('products', 'select=*&status=eq.published&order=slug.asc'),
        rest.list<BlogCategoryRow>('blog_categories', 'select=*&order=slug.asc'),
        rest.list<ProductCategoryRow>('product_categories', 'select=*&order=slug.asc'),
        rest.list<AuthorRow>('authors', 'select=*&order=slug.asc'),
        rest.list<{ data: string }>('site_settings', 'select=data&id=is.true'),
    ]);

    // 空表保护：某类内容整表读空通常是查询/权限出问题，绝不能变成「删光 113 篇」
    const guards: Array<[string, number]> = [
        ['articles', articles.length],
        ['pages', pages.length],
        ['products', products.length],
        ['blog_categories', blogCats.length],
        ['product_categories', prodCats.length],
        ['authors', authors.length],
    ];
    for (const [table, n] of guards) {
        if (n === 0 && !ALLOW_EMPTY) throw new Error(`${table} 没有 published 行；确认要清空快照请加 --allow-empty`);
    }
    if (siteRows.length !== 1) throw new Error(`site_settings 应为单行，实际 ${siteRows.length} 行`);

    assertShape(articles, pages, siteRows[0]!.data);
    assertNoCodeOwnedPages(pages);

    const prodCatName = new Map(prodCats.map((c) => [c.slug, c.name]));

    for (const a of articles) {
        assertSlug('articles', a.slug);
        const fm = toFrontmatter({
            title: a.title,
            heading: a.heading,
            description: a.description,
            slug: a.slug,
            canonical: opt(a.canonical) ?? `/${a.slug}/`,
            date: a.date,
            lastmod: opt(a.lastmod),
            modified: opt(a.modified),
            categories: a.categories ?? [],
            author: opt(a.author),
            hero: opt(a.hero),
            heroAlt: opt(a.hero_alt),
            heroWidth: num(a.hero_width),
            heroHeight: num(a.hero_height),
            robots: a.robots,
            wordCount: a.word_count,
            readingMinutes: a.reading_minutes,
            faq: faqOf(a.faq),
            sourceId: num(a.source_id),
        });
        out.set(`src/content/articles/${a.slug}.md`, `${fm}\n${mdBody(a.body)}\n`);
    }

    for (const p of pages) {
        assertSlug('pages', p.slug);
        const fm = toFrontmatter({
            title: p.title,
            heading: p.heading,
            slug: p.slug,
            canonical: opt(p.canonical) ?? `/${p.slug}/`,
            description: p.description,
            robots: p.robots,
            date: opt(p.date),
            lastmod: opt(p.lastmod),
            hero: opt(p.hero),
            sourceId: num(p.source_id),
            menuOrder: p.menu_order,
            isListing: p.is_listing,
            faq: faqOf(p.faq),
            author: opt(p.author),
        });
        out.set(`src/content/pages/${p.slug}.md`, `${fm}\n${mdBody(p.body)}\n`);
    }

    for (const p of products) {
        assertSlug('products', p.slug);
        out.set(`src/data/products/${p.slug}.json`, json({
            slug: p.slug,
            name: p.name,
            canonical: p.canonical,
            summary: p.summary ?? '',
            body: p.body ?? '',
            images: imagesOf(p.images),
            // 库里只存 slug（后台是多选勾选），名称回落到产品分类表
            categories: (p.categories ?? []).map((slug) => ({ slug, name: prodCatName.get(slug) ?? slug })),
            specs: specsOf(p.specs),
            faq: faqOf(p.faq),
            unusedImages: [],
        }));
    }

    for (const c of blogCats) {
        assertSlug('blog_categories', c.slug);
        out.set(`src/data/blog-categories/${c.slug}.json`, json({
            slug: c.slug,
            name: c.name,
            description: c.description ?? '',
            title: c.title ?? c.name,
            robots: c.robots,
            count: c.count ?? 0,
            // canonical 是派生值，不入库
            canonical: `/category/${c.slug}/`,
        }));
    }

    // 产品分类是单文件数组，顺序按 canonical（与 05-taxonomies 的排序一致）
    out.set('src/data/product-categories.json', json(
        [...prodCats]
            .sort((a, b) => a.canonical.localeCompare(b.canonical))
            .map((c) => ({
                slug: c.slug,
                name: c.name,
                description: c.description ?? '',
                parent: c.parent === '0' || c.parent === '' ? 0 : c.parent,
                count: c.count ?? 0,
                canonical: c.canonical,
                trail: c.trail ?? [],
                robots: c.robots,
                title: c.title ?? '',
            })),
    ));

    const authorMap: Json = {};
    for (const a of authors) {
        assertSlug('authors', a.slug);
        authorMap[a.slug] = { slug: a.slug, name: a.name, role: a.role ?? '', bio: a.bio ?? '', avatar: a.avatar ?? '' };
    }
    out.set('src/data/authors.json', json(authorMap));

    // 站点设置存的是 site.json 原文：只统一换行符（LF）与收尾换行，其余逐字回写
    out.set('src/data/site.json', `${toLf(String(siteRows[0]!.data)).replace(/\s+$/, '')}\n`);

    return out;
}

/** 预览差异位置，便于定位到底是哪个字段漂了 */
function previewDiff(expected: string, actual: string): string {
    const i = [...expected].findIndex((c, k) => c !== actual[k]);
    const at = i < 0 ? 0 : i;
    const cut = (s: string): string => JSON.stringify(s.slice(at, at + 60));
    return `首个差异 @${at}\n      期望 ${cut(expected)}\n      实际 ${cut(actual)}`;
}

/**
 * 仓库统一存 LF（.gitattributes: * text=auto eol=lf），但 Windows 工作区里
 * 早期脚本产出的文件可能残留 CRLF。比对/写入都以 LF 为准，免得把
 * “换行符本来就该被归一化”误报成内容漂移。
 */
const toLf = (s: string): string => s.replace(/\r\n/g, '\n');

function existingFiles(dir: string, ext: string): string[] {
    const base = join(ROOT, dir);
    if (!existsSync(base)) return [];
    return readdirSync(base).filter((f) => f.endsWith(ext)).map((f) => `${dir}/${f}`);
}

async function main(): Promise<void> {
    loadEnvFile();
    const files = await collect();

    let same = 0;
    const changed: string[] = [];
    const missing: string[] = [];

    for (const [relPath, content] of files) {
        const abs = join(ROOT, relPath);
        const old = existsSync(abs) ? toLf(readFileSync(abs, 'utf8')) : null;
        if (old === content) {
            same += 1;
            continue;
        }
        if (old === null) {
            missing.push(relPath);
        } else {
            changed.push(relPath);
        }
        if (CHECK) {
            console.error(`  ✗ ${relPath}`);
            if (old !== null) console.error(previewDiff(content, old));
        } else {
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, content, 'utf8');
        }
    }

    // 清理：目录里已不被任何 published 行覆盖的文件（下架/删除的条目）
    const removed: string[] = [];
    for (const { dir, ext } of MANAGED_DIRS) {
        for (const relPath of existingFiles(dir, ext)) {
            if (files.has(relPath)) continue;
            removed.push(relPath);
            if (!CHECK) unlinkSync(join(ROOT, relPath));
        }
    }

    const label = CHECK ? '校验' : '快照';
    console.log(`\n${label}完成：一致 ${same}｜变更 ${changed.length}｜新建 ${missing.length}｜待删 ${removed.length}｜生成 ${files.size}`);
    if (changed.length > 0) console.log(`  变更：${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ' …' : ''}`);
    if (removed.length > 0) console.log(`  删除：${removed.slice(0, 10).join(', ')}${removed.length > 10 ? ' …' : ''}`);

    if (CHECK && (changed.length > 0 || missing.length > 0 || removed.length > 0)) {
        console.error('\n✗ 快照与仓库内容不一致（回归闸未通过）');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('\n✗ 快照中断：', err instanceof Error ? err.message : err);
    process.exit(1);
});
