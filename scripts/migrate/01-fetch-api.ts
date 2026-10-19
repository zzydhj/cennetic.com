/**
 * Phase 0-1 · 全量拉取源站 REST 数据到本地缓存。
 *
 * 输出：.cache/wp/api/posts.json
 *      .cache/wp/api/pages.json
 *      .cache/wp/api/categories.json
 *      .cache/wp/api/product-categories.json
 *      .cache/wp/api/products.json
 *
 * 幂等：已存在缓存则直接读取，传 --refresh 强制重抓。
 */
import { API, CACHE_DIR } from './lib/config.ts';
import { fetchJsonPaged } from './lib/http.ts';
import { extractElementorStyles } from './lib/json.ts';
import { join, writeJson, readJson, rel, log, step } from './lib/fs.ts';
import type {
    WpPost,
    WpCategory,
    StoreProduct,
    StoreProductCategory,
} from './lib/types.ts';

const OUT = join(CACHE_DIR, 'api');

/**
 * Elementor 污染了响应体的请求。累积后写入 elementor-pollution.json 留档：
 * 这些 <style> 是源站 Elementor 样式的原始出处，页面复刻时要拿它校对颜色与尺寸。
 */
const pollutionLedger: Array<{ url: string; chars: number; styles: Array<{ id: string; css: string }> }> = [];

/** 逐页遍历 WordPress REST 集合，直到取满 X-WP-TotalPages */
async function collect<T>(label: string, base: string, params: string): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
        const url = `${base}?per_page=100&page=${page}&${params}`;
        const res = await fetchJsonPaged<T[]>(url, { kind: 'api' });

        if (res.pollution) {
            pollutionLedger.push({
                url,
                chars: res.pollution.length,
                styles: extractElementorStyles(res.pollution),
            });
            log(`  ! ${label} page ${page} 响应体被 Elementor 污染 ${res.pollution.length} 字符，已容错恢复`);
        }

        totalPages = res.totalPages || 1;
        all.push(...res.data);
        log(`  ${label} page ${page}/${totalPages} -> +${res.data.length} (累计 ${all.length})`);
        if (res.data.length === 0) break;
        page += 1;
    }

    return all;
}

/** 缓存优先的资源加载 */
async function cached<T>(file: string, refresh: boolean, fetcher: () => Promise<T>): Promise<T> {
    if (!refresh) {
        const existing = await readJson<T>(join(OUT, file), null as T);
        if (existing !== null) {
            log(`  ${file} —— 命中缓存`);
            return existing;
        }
    }
    const value = await fetcher();
    await writeJson(join(OUT, file), value);
    return value;
}

export async function fetchApi(refresh = false): Promise<void> {
    step('Phase 0-1 · 拉取源站 REST 数据');

    // _embed 顺带带回特色图与分类，省掉逐条二次请求
    const embed = '_embed=1&orderby=id&order=asc';

    const posts = await cached<WpPost[]>('posts.json', refresh, () =>
        collect<WpPost>('文章', API.posts, embed),
    );
    const pages = await cached<WpPost[]>('pages.json', refresh, () =>
        collect<WpPost>('页面', API.pages, embed),
    );
    const categories = await cached<WpCategory[]>('categories.json', refresh, () =>
        collect<WpCategory>('博客分类', API.categories, ''),
    );
    const productCategories = await cached<StoreProductCategory[]>(
        'product-categories.json',
        refresh,
        () => collect<StoreProductCategory>('产品分类', API.productCategories, ''),
    );
    const products = await cached<StoreProduct[]>('products.json', refresh, () =>
        collect<StoreProduct>('产品', API.products, ''),
    );

    log('');
    if (pollutionLedger.length > 0) {
        const ledgerFile = join(OUT, 'elementor-pollution.json');
        await writeJson(ledgerFile, pollutionLedger);
        log(`! ${pollutionLedger.length} 个 REST 响应体被 Elementor 污染，已容错恢复并将原始样式写入 ${rel(ledgerFile)}`);
    }

    log(
        `✓ REST 抓取完成  文章=${posts.length} 页面=${pages.length} ` +
        `博客分类=${categories.length} 产品分类=${productCategories.length} 产品=${products.length}`,
    );
    log(`  缓存目录：${rel(OUT)}`);
}
