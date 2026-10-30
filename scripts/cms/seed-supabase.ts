/**
 * 一次性灌库：把当前 git 里的内容（src/content + src/data）写入 Supabase。
 * 运行：npx tsx scripts/cms/seed-supabase.ts
 * 前置：1) 已在 Supabase SQL Editor 执行 supabase/schema.sql 与 migrations/ 内的增量；
 *       2) .env 内已填 SUPABASE_URL 与 SUPABASE_SECRET_KEY。
 *
 * 设计：
 *  - 用 PostgREST 的 upsert（Prefer: resolution=merge-duplicates + on_conflict=slug），可反复跑幂等。
 *  - 用 service/secret key 绕 RLS；camelCase(frontmatter) → snake_case(列) 的映射集中在本文件。
 *  - 日期与站点数据存「原文」，正文存 trim 后的 HTML；与 snapshot.ts 的还原规则一一对应。
 *  - 任何一步失败即 fail-loud 退出，不留半成品。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { ROOT, loadEnvFile, requireEnv } from './lib/env.ts';
import { createRestClient } from './lib/rest.ts';

loadEnvFile();

const URL_BASE = requireEnv('SUPABASE_URL');
const SECRET = requireEnv('SUPABASE_SECRET_KEY');
const rest = createRestClient(URL_BASE, SECRET);

/** 日期等文本列：原样保留裸 ISO 串，绝不 new Date()（否则时区会漂 8h） */
function raw(v: unknown): string | null {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.toISOString().replace(/\.000Z$/, '');
    return String(v);
}

/** 解析 .md 的 YAML frontmatter + HTML 正文 */
function parseMd(abs: string): { data: Record<string, unknown>; body: string } {
    const rawText = readFileSync(abs, 'utf8');
    const m = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { data: {}, body: rawText.trim() };
    return { data: (loadYaml(m[1]!) as Record<string, unknown>) ?? {}, body: (m[2] ?? '').trim() };
}

async function upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
    await rest.upsert(table, rows, onConflict);
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
            date: raw(data.date) ?? new Date().toISOString(),
            lastmod: raw(data.lastmod) ?? raw(data.date) ?? new Date().toISOString(),
            modified: raw(data.modified),
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
/*
 * 已取消 buildPages：后台的「页面」类型整体删除（src/content/pages/ 不再存在、前台不读），
 * seed 也不再往 pages 表写行。表本体仍在 supabase/schema.sql 里，只是没人读写它了。
 */

function readJson(rel: string): unknown {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

async function main() {
    console.log('开始灌库 → Supabase', URL_BASE);

    const articles = buildArticles();
    await upsert('articles', articles, 'slug');

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

    // site.json 存原文（保键序/4 空格缩进），快照逐字回写；
    // 但必须归一到 LF：仓库统一存 LF，Windows 工作区残留的 CRLF 不能跟着入库
    const siteText = readFileSync(join(ROOT, 'src/data/site.json'), 'utf8')
        .replace(/\r\n/g, '\n')
        .replace(/\s+$/, '') + '\n';
    await upsert('site_settings', [{ id: true, data: siteText }], 'id');

    // pages 表已停写（后台「页面」类型整体删除），日志里不再报它的行数
    console.log('\n✓ 灌库完成。抽查建议：Supabase Table Editor 各表行数应为 ' +
        `articles=${articles.length} products=${productRows.length} ` +
        `blog=${blogCats.length} prodCats=${prodCats.length} authors=${authorRows.length} site=1`);
}

main().catch((err) => {
    console.error('\n✗ 灌库中断：', err instanceof Error ? err.message : err);
    process.exit(1);
});
