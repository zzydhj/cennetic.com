/**
 * Phase 2 · 产品数据迁移
 *
 * WooCommerce Store API 的 /wc/store/v1/products 给的是渲染前数据：
 * description / short_description 为 HTML，images 为图库，attributes 为规格。
 * 本站是询盘型展示站（无真实交易），因此只保留展示与询盘所需字段：
 * 去掉 price / add_to_cart / is_purchasable —— 购物车随纯静态化一并消失。
 *
 * 输出：src/data/products/<slug>.json
 */
import { API_CACHE_DIR, DATA_DIR, SRC_ORIGIN, pathOf, safeSitePath } from './lib/config.ts';
import { join, writeText, readJson, rel, log, step } from './lib/fs.ts';
import { loadMediaIndex, lookup, type MediaEntry } from './lib/images.ts';
import { demoteH1, plainText } from './lib/transform.ts';
import type { StoreProduct } from './lib/types.ts';
import * as cheerio from 'cheerio';

interface ProductImage {
    src: string;
    alt: string;
    width: number;
    height: number;
}

interface SpecRow {
    name: string;
    values: string[];
}

interface ProductData {
    slug: string;
    name: string;
    canonical: string;
    summary: string;
    body: string;
    images: ProductImage[];
    /** 分类 slug 列表，顺序按源站 */
    categories: Array<{ slug: string; name: string; canonical: string }>;
    specs: SpecRow[];
    /** 正文与摘要里出现过的图片，供媒体清单核对 */
    unusedImages: string[];
}

/** Store API 的 HTML 字段带 <p> 包裹与 \n，清理后只保留结构 */
function tidyHtml(html: string): string {
    const $ = cheerio.load(`<div id="p">${html}</div>`);
    $('#p img').each((_, el) => {
        const src = $(el).attr('src') ?? '';
        $(el).removeAttr('srcset');
        $(el).removeAttr('sizes');
        $(el).removeAttr('data-src');
        $(el).removeClass((_, c) => c.replace(/\b(wp-image-\d+|size-[\w-]+|align\w+)\b/g, '').trim());
        const p = safeSitePath(src);
        if (p) $(el).attr('data-srcpath', p);
    });
    // 产品描述里常自带 <h1>（型号名），而模板已经输出一个 H1。
    // 两个 H1 会稀释主题信号，这里跟文章阶段做同样的降级。
    demoteH1($, '#p');
    return ($('#p').html() ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function toImages(list: StoreProduct['images'], index: Map<string, MediaEntry>): ProductImage[] {
    const out: ProductImage[] = [];
    for (const im of list) {
        const p = safeSitePath(im.src);
        if (!p) continue;
        const entry = lookup(index, p);
        if (!entry?.ok) continue;
        out.push({
            src: entry.publicPath,
            alt: im.alt || '',
            width: entry.width,
            height: entry.height,
        });
    }
    return out;
}

/** attributes 转成规格表行；名称同样需解码 HTML 实体 */
function toSpecs(product: StoreProduct): SpecRow[] {
    return (product.attributes ?? [])
        .filter((a) => a.terms?.length)
        .map((a) => ({
            name: plainText(a.name).replace(/:$/, '').trim(),
            values: a.terms.map((t) => plainText(t.name)),
        }));
}

export async function buildProducts(): Promise<void> {
    step('Phase 2 · 产品数据迁移');

    const products = await readJson<StoreProduct[]>(join(API_CACHE_DIR, 'products.json'), [] as StoreProduct[]);
    const index = await loadMediaIndex();
    const outDir = join(DATA_DIR, 'products');

    log(`  产品 ${products.length} 个`);

    for (const p of products) {
        const canonical = safeSitePath(p.permalink) ?? pathOf(p.permalink);
        const summary = tidyHtml(p.short_description ?? '');
        const body = tidyHtml(p.description ?? '');

        const data: ProductData = {
            slug: p.slug,
            name: plainText(p.name),
            canonical,
            summary,
            body,
            images: (p.images ?? []).length ? toImages(p.images ?? [], index) : [],
            categories: (p.categories ?? []).map((c) => ({
                slug: c.slug,
                /**
                 * Store API 返回的名称带 HTML 实体（实测 "Drilling &amp; Tapping Centers"），
                 * 不解码会被模板再转义一次，页面渲染出字面 &amp; 文本。
                 */
                name: plainText(c.name),
                canonical: safeSitePath(c.permalink) ?? c.permalink,
            })),
            specs: toSpecs(p),
            unusedImages: [],
        };

        await writeText(join(outDir, `${p.slug}.json`), `${JSON.stringify(data, null, 2)}\n`);
        log(
            `  ${p.slug.padEnd(52)} 图 ${data.images.length}/${(p.images ?? []).length} ` +
            `规格 ${data.specs.length} 行  分类 ${data.categories.length}`,
        );
    }

    log('');
    log(`✓ 产品数据 → ${rel(outDir)}`);
}
