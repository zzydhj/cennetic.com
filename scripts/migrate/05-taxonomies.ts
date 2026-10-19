/**
 * Phase 2 · 分类数据迁移：博客分类 + 产品分类（含三级树）
 *
 * 博客分类输出 src/data/blog-categories/<slug>.json
 * 产品分类输出 src/data/product-categories.json（保留 parent 关系，由模板重建树）
 *
 * robots 与 title 取自阶段 02 的 URL 基线清单，保证与源站逐条一致：
 * 实测 Customer Stories（count=0）在源站是 "follow, noindex"，
 * 其余分类是 "follow, index, max-snippet:-1, ..."，这个差别必须保留。
 */
import { readFile } from 'node:fs/promises';
import { API_CACHE_DIR, DATA_DIR, MIGRATION_DIR, ROOT, pathOf, safeSitePath } from './lib/config.ts';
import { join, writeJson, writeText, readJson, rel, log, step } from './lib/fs.ts';
import { stripSiteSuffix } from './lib/transform.ts';
import type { WpCategory, StoreProductCategory, UrlRecord } from './lib/types.ts';

interface BlogCategoryData {
    slug: string;
    name: string;
    description: string;
    title: string;
    robots: string;
    count: number;
    /** 源站路径，用于校验新站输出一致 */
    canonical: string;
}

export async function buildTaxonomies(): Promise<void> {
    step('Phase 2 · 分类数据迁移');

    const manifest = await readJson<{ urls: UrlRecord[] }>(join(MIGRATION_DIR, 'url-manifest.json'));
    const byPath = new Map(manifest.urls.map((u) => [u.path, u]));

    const cats = await readJson<WpCategory[]>(join(API_CACHE_DIR, 'categories.json'), [] as WpCategory[]);
    const site = JSON.parse(await readFile(join(ROOT, 'src/data/site.json'), 'utf8')) as { name: string };
    const outDir = join(DATA_DIR, 'blog-categories');

    let indexed = 0;
    let noIndex = 0;

    for (const c of cats) {
        const canonical = pathOf(new URL(c.link).pathname);
        const rec = byPath.get(canonical.endsWith('/') ? canonical : `${canonical}/`);

        if (rec?.robots?.includes('noindex')) noIndex += 1;
        else indexed += 1;

        const data: BlogCategoryData = {
            slug: c.slug,
            name: c.name,
            description: c.description ?? '',
            /**
             * 清掉源站 <title> 自带的品牌后缀：模板会重新拼一次，
             * 不去就变成「X - Qiaofeng CNC Machine - QiaoFeng CNC Machine」。
             */
            title: stripSiteSuffix(rec?.title ?? c.name, site.name),
            // 源站清单里没有该分类时，回落到全站默认值
            robots: rec?.robots ?? 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
            count: c.count,
            canonical,
        };

        await writeText(join(outDir, `${c.slug}.json`), `${JSON.stringify(data, null, 2)}\n`);
    }

    // 产品分类：以 URL 基线清单为准，API 只作补充。
    // 原因：/wc/store/v1/products/categories 不返回产品数为 0 的分类，
    // 而导航里实际有 9 个分类页面在源站返回 200（其中 4 个空分类 API 不给）。
    // 只按 API 建会漏建 4 页，上线就是 404。
    const prodCats = await readJson<StoreProductCategory[]>(
        join(API_CACHE_DIR, 'product-categories.json'),
        [] as StoreProductCategory[],
    );
    const apiBySlug = new Map(prodCats.map((pc) => [pc.slug, pc]));

    const categoryRecords = manifest.urls.filter((u) => u.kind === 'product-category' && u.status === 200);

    const productCategories = categoryRecords
        .map((rec) => {
            const slug = rec.path.replace(/^\/product-category\//, '').replace(/\/$/, '').split('/').pop()!;
            const api = apiBySlug.get(slug);
            const parentPath = rec.path.replace(/[^/]+\/$/, '');
            const parent = parentPath && parentPath !== '/product-category/'
                ? parentPath.replace(/^\/product-category\//, '').replace(/\/$/, '').split('/').pop() ?? 0
                : 0;

            return {
                slug,
                /** API 不提供的分类，名字从源站页面 <title> 回推 */
                name: api ? decodeEntities(api.name) : titleToName(rec.title),
                description: api ? (api.description ?? '') : '',
                parent,
                count: api?.count ?? 0,
                canonical: rec.path,
                // 三级树的完整祖先链，模板据此渲染面包屑与层级导航
                trail: rec.path.replace(/^\/product-category\//, '').replace(/\/$/, '').split('/'),
                image: api?.image?.src ? safeSitePath(api.image.src) ?? undefined : undefined,
                robots: rec.robots ?? 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
                title: stripSiteSuffix(rec.title ?? titleToName(rec.title) ?? slug, site.name),
            };
        })
        .filter((c) => c.slug && !/page/.test(c.slug))
        .sort((a, b) => a.canonical.localeCompare(b.canonical));

    await writeJson(join(DATA_DIR, 'product-categories.json'), productCategories);

    log('');
    log(`✓ 博客分类 ${cats.length} 个 → ${rel(outDir)}  (index ${indexed} / noindex ${noIndex})`);
    log(`✓ 产品分类 ${productCategories.length} 个 → ${rel(join(DATA_DIR, 'product-categories.json'))}  （API 仅给 ${prodCats.length} 个，清单补全其余空分类）`);
    for (const pc of productCategories) {
        const tag = apiBySlug.has(pc.slug) ? 'API' : '清单';
        log(`    [${tag}] 深度 ${pc.trail.length}  ${pc.canonical}  “${pc.name}”  (产品数 ${pc.count})`);
    }
}

/** 从 “Name - Qiaofeng CNC Machine” 形式的 <title> 里取出分类名 */
function titleToName(title?: string): string {
    if (!title) return '';
    return decodeEntities(title.replace(/\s*[-|–]\s*Qiao[Ff]eng.*$/u, '').trim());
}

function decodeEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#8211;/g, '–')
        .trim();
}
