/**
 * 迁移管道全局配置：源站、路径、URL 规则。
 * 所有脚本只从这里取常量，避免路径字符串散落各处。
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join as join_ } from 'node:path';

/** 源 WordPress 站点（不带尾斜杠） */
export const SRC_ORIGIN = 'https://qfcncmachine.com';

/** 目标站点 */
export const SITE_ORIGIN = 'https://qfcncmachine.com';

const here = dirname(fileURLToPath(import.meta.url));

/** 项目根目录 */
export const ROOT = resolve(here, '../../..');

/** 原始抓取缓存（gitignore，可重复抓取） */
export const CACHE_DIR = resolve(ROOT, '.cache/wp');

/** REST 抓取结果目录，供各阶段共享读取 */
export const API_CACHE_DIR = join_(CACHE_DIR, 'api');

/** 已提交的迁移基线数据（URL 清单等，进版本库） */
export const MIGRATION_DIR = resolve(ROOT, 'migration');

/** Astro 内容目录 */
export const CONTENT_DIR = resolve(ROOT, 'src/content');

/** Astro 数据目录（产品、分类、页面区块、站点配置） */
export const DATA_DIR = resolve(ROOT, 'src/data');

/** 图片资产目录 */
export const ASSETS_IMG_DIR = resolve(ROOT, 'src/assets/images');

/** 抽取出的文章共享样式 */
export const STYLES_DIR = resolve(ROOT, 'src/styles');

/**
 * 源站 REST 端点。实测全部公开可访问，因此无需解析 HTML 即可拿到结构化内容。
 */
export const API = {
    posts: `${SRC_ORIGIN}/wp-json/wp/v2/posts`,
    pages: `${SRC_ORIGIN}/wp-json/wp/v2/pages`,
    categories: `${SRC_ORIGIN}/wp-json/wp/v2/categories`,
    tags: `${SRC_ORIGIN}/wp-json/wp/v2/tags`,
    media: `${SRC_ORIGIN}/wp-json/wp/v2/media`,
    products: `${SRC_ORIGIN}/wp-json/wc/store/v1/products`,
    productCategories: `${SRC_ORIGIN}/wp-json/wc/store/v1/products/categories`,
} as const;

/** Rank Math 生成的站点地图分片 */
export const SITEMAPS = [
    `${SRC_ORIGIN}/post-sitemap.xml`,
    `${SRC_ORIGIN}/page-sitemap.xml`,
    `${SRC_ORIGIN}/product-sitemap.xml`,
    `${SRC_ORIGIN}/category-sitemap.xml`,
] as const;

/**
 * 原站已失效的 WooCommerce 交易类路径。纯静态后统一 301 到产品列表。
 */
export const DEAD_PATHS_301: Record<string, string> = {
    '/cart/': '/products/',
    '/checkout/': '/products/',
    '/my-account/': '/products/',
    '/product-cat/': '/products/',
};

/** 拼出带尾斜杠的站内路径（与 WordPress 保持一致） */
export function siteUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${SITE_ORIGIN}${p.endsWith('/') ? p : `${p}/`}`;
}

/** 从绝对 URL 取出站内路径（保留尾斜杠） */
export function pathOf(url: string): string {
    try {
        const u = new URL(url);
        return u.pathname;
    } catch {
        return url;
    }
}

/**
 * 将可能是绝对 URL / 站内相对路径 / 空值的字段安全归一为站内路径。
 * 源站存在 src="" 等畸形值，直接 new URL() 会抛 Invalid URL 打断整条管道。
 * 解析不了时返回 null，由调用方决定降级策略。
 */
export function safeSitePath(raw: string | null | undefined, base = SRC_ORIGIN): string | null {
    const s = (raw ?? '').trim();
    if (!s || s.startsWith('data:')) return null;
    try {
        return decodeURIComponent(pathOf(new URL(s, base).pathname));
    } catch {
        return null;
    }
}
