/**
 * 一次性灌库：把当前 git 里的内容（src/content + src/data）写入 Supabase。
 * 运行：npx tsx scripts/cms/seed-supabase.ts
 * 前置：1) 已在 Supabase SQL Editor 执行 supabase/schema.sql；2) .env 内已填 SUPABASE_SECRET_KEY。
 *
 * 设计：
 *  - 用 PostgREST 的 upsert（Prefer: resolution=merge-duplicates + on_conflict=slug），可反复跑幂等。
 *  - 用 service/secret key 绕 RLS；camelCase(frontmatter) → snake_case(列) 的映射集中在本文件。
 *  - 任何一步失败即 fail-loud 退出，不留半成品。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';

const ROOT = process.cwd();

// ── .env 载入（无第三方依赖）───────────────────────────────────────────────
(function loadEnv() {
    const p = join(ROOT, '.env');
    if (!existsSync(p)) throw new Error('缺少 .env（参考 .env.example）');
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        process.env[m[1]!] ??= m[2]!.trim();
    }
})();

const URL_BASE = process.env.SUPABASE_URL!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
if (!URL_BASE || !SECRET) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY 未设置');

const HEADERS = {
    apikey: SECRET,
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
};

/** ISO 字符串/Date → 统一 ISO；空值→null */
function iso(v: unknown): string | null {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.toISOString();
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 解析 .md 的 YAML frontmatter + HTML 正文 */
function parseMd(abs: string): { data: Record<string, unknown>; body: string } {
    const raw = readFileSync(abs, 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { data: {}, body: raw };
    return { data: (loadYaml(m[1]!) as Record<string, unknown>) ?? {}, body: m[2] ?? '' };
}

async function upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
    if (rows.length === 0) {
        console.log(`  · ${table}: 0 行，跳过`);
        return;
    }
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(rows),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${table} upsert 失败 HTTP ${res.status}: ${text}`);
    }
    console.log(`  ✓ ${table}: ${rows.length} 行`);
}

function listMd(dir: string): string[] {
    const base = join(ROOT, dir);
    if (!existsSync(base)) return [];
    return readdirSync(base).filter((f) => f.endsWith('.md')).map((f) => join(base, f));
}

// ── 文章 ────────────────────────────────────────────────────────────────────
function buildArticles() {
    return listMd('src/content/articles').map((abs) => {
        const { data, body } = parseMd(abs);
        return {
            slug: data.slug,
            title: data.title,
            heading: data.heading,
            description: data.description,
            canonical: data.canonical ?? null,
            date: iso(data.date) ?? new Date().toISOString(),
            lastmod: iso(data.lastmod) ?? iso(data.date) ?? new Date().toISOString(),
            modified: iso(data.modified),
            categories: (data.categories as string[]) ?? [],
            author: data.author ?? null,
            hero: data.hero ?? null,
            hero_alt: data.heroAlt ?? null,
            hero_width: data.heroWidth ?? null,
            hero_height: data.heroHeight ?? null,
            robots: data.robots,
            word_count: data.wordCount ?? 0,
            reading_minutes: data.readingMinutes ?? 1,
            faq: data.faq ?? [],
            body,
            source_id: data.sourceId ?? null,
            status: 'published',
        };
    });
}

// ── 页面 ────────────────────────────────────────────────────────────────────
function buildPages() {
    return listMd('src/content/pages').map((abs) => {
        const { data, body } = parseMd(abs);
        return {
            slug: data.slug,
            title: data.title,
            heading: data.heading,
            description: data.description ?? '',
            canonical: data.canonical ?? null,
            robots: data.robots,
            date: iso(data.date),
            lastmod: iso(data.lastmod),
            hero: data.hero ?? null,
            menu_order: data.menuOrder ?? 0,
            is_listing: data.isListing ?? false,
            author: data.author ?? null,
            faq: data.faq ?? [],
            body,
            source_id: data.sourceId ?? null,
            status: 'published',
        };
    });
}

function readJson(rel: string): unknown {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

async function main() {
    console.log('开始灌库 → Supabase', URL_BASE);

    const articles = buildArticles();
    const pages = buildPages();
    await upsert('articles', articles, 'slug');
    await upsert('pages', pages, 'slug');

    const productRows = readdirSync(join(ROOT, 'src/data/products'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
            const p = JSON.parse(readFileSync(join(ROOT, 'src/data/products', f), 'utf8'));
            return {
                slug: p.slug,
                name: p.name,
                canonical: p.canonical,
                summary: p.summary ?? '',
                body: p.body ?? '',
                images: p.images ?? [],
                // 分类存 slug 数组（与后台多选一致）；snapshot 侧再展开成 {slug,name,canonical}
                categories: (p.categories ?? []).map((c: { slug: string }) => c.slug),
                specs: p.specs ?? [],
                status: 'published',
            };
        });
    await upsert('products', productRows, 'slug');

    const blogCats = readdirSync(join(ROOT, 'src/data/blog-categories'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
            const c = JSON.parse(readFileSync(join(ROOT, 'src/data/blog-categories', f), 'utf8'));
            // canonical 由 slug 派生(/category/<slug>/)，不入库；snapshot 侧重算
            return {
                slug: c.slug,
                name: c.name,
                description: c.description ?? '',
                title: c.title ?? null,
                robots: c.robots,
                count: c.count ?? 0,
            };
        });
    await upsert('blog_categories', blogCats, 'slug');

    const prodCats = (readJson('src/data/product-categories.json') as Array<Record<string, unknown>>).map((c) => ({
        slug: c.slug,
        name: c.name,
        description: c.description ?? '',
        parent: String(c.parent ?? '0'),
        canonical: c.canonical,
        trail: c.trail ?? [],
        robots: c.robots,
        title: c.title ?? '',
        count: c.count ?? 0,
    }));
    await upsert('product_categories', prodCats, 'slug');

    const authorsObj = readJson('src/data/authors.json') as Record<string, Record<string, unknown>>;
    const authorRows = Object.entries(authorsObj).map(([slug, a]) => ({
        slug,
        name: a.name,
        role: a.role ?? '',
        bio: a.bio ?? '',
        avatar: a.avatar ?? '',
    }));
    await upsert('authors', authorRows, 'slug');

    const site = readJson('src/data/site.json');
    await upsert('site_settings', [{ id: true, data: site }], 'id');

    console.log('\n✓ 灌库完成。抽查建议：Supabase Table Editor 各表行数应为 ' +
        `articles=${articles.length} pages=${pages.length} products=${productRows.length} ` +
        `blog=${blogCats.length} prodCats=${prodCats.length} authors=${authorRows.length} site=1`);
}

main().catch((err) => {
    console.error('\n✗ 灌库中断：', err instanceof Error ? err.message : err);
    process.exit(1);
});
