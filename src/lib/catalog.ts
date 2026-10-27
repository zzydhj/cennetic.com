/**
 * 站点数据访问层：模板只通过这里取全局配置与目录数据，
 * 不各自 import JSON、不各自拼路径 —— 那样一改结构就得翻遍所有组件。
 */
import site from '@data/site.json';
import menu from '@data/menu.json';
import productCategoriesRaw from '@data/product-categories.json';
import authors from '@data/authors.json';

export interface ProductCategory {
    slug: string;
    name: string;
    description: string;
    parent: string | number;
    count: number;
    canonical: string;
    trail: string[];
    image?: string;
    robots: string;
    title: string;
}

export interface ProductImage {
    src: string;
    alt: string;
    width: number;
    height: number;
}

export interface Product {
    slug: string;
    name: string;
    canonical: string;
    summary: string;
    body: string;
    images: ProductImage[];
    categories: Array<{ slug: string; name: string; canonical: string }>;
    specs: Array<{ name: string; values: string[] }>;
    /** 问答区 + FAQPage 结构化数据；快照对空值省略此键，故可选 */
    faq?: Array<{ q: string; a: string }>;
}

export interface Author {
    slug: string;
    name: string;
    role: string;
    bio: string;
    avatar: string;
}

export const siteConfig = site;
export const nav = menu;
export const productCategories = productCategoriesRaw as ProductCategory[];
export const authorDirectory = authors as Record<string, Author>;

/** 页脚产品分类：直接取一级分类，后台加分类会自动出现，无需改 menu.json */
export const footerProductCategories: Array<{ label: string; path: string }> = productCategories
    .filter((c) => c.trail.length === 1 && c.slug !== 'uncategorized')
    .map((c) => ({ label: c.name, path: c.canonical }));

/** 按 slug 取作者；未署名时回落到目录里的第一个（本站目前只有 Bella） */
export function getAuthor(slug?: string): Author | undefined {
    const all = Object.values(authorDirectory);
    if (all.length === 0) return undefined;
    return all.find((a) => a.slug === slug) ?? all[0];
}

/** 产品数据在构建期全量读入：只有 4 个，不必做懒加载 */
export const products = import.meta.glob<Product>('@data/products/*.json', {
    eager: true,
    import: 'default',
});

/** 全站产品，按 slug 排序保证输出稳定 */
export function allProducts(): Product[] {
    return Object.values(products).sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getProduct(slug: string): Product | undefined {
    return allProducts().find((p) => p.slug === slug);
}

/** 某分类下的产品（含子分类的归集由调用方决定，这里只做直属匹配） */
export function productsInCategory(categorySlug: string): Product[] {
    return allProducts().filter((p) => p.categories.some((c) => c.slug === categorySlug));
}

/** 分类的下级；parent 在清单里可能是 slug 字符串也可能来自 API 的数字 id */
export function childCategories(parentSlug: string): ProductCategory[] {
    return productCategories
        .filter((c) => c.parent === parentSlug && c.slug !== parentSlug)
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** 由 trail 还原面包屑层级（含祖先） */
export function categoryAncestors(cat: ProductCategory): ProductCategory[] {
    const out: ProductCategory[] = [];
    for (let i = 1; i < cat.trail.length; i += 1) {
        const ancestorPath = `/product-category/${cat.trail.slice(0, i).join('/')}/`;
        const found = productCategories.find((c) => c.canonical === ancestorPath);
        if (found) out.push(found);
    }
    return out;
}

/* ── 页眉 Mega Menu ──────────────────────────────────────────────
 * 分类清单里的 count 是旧的、不随产品增减自动更新，所以这里按实际产品
 * 派生计数（含所有后代分类），并只保留有货的顶层分类 —— 后台新增产品后
 * 面板会自动长出新分类，无需改代码。为让面板更具体，每列额外派生：代表
 * 机型缩略图、分类描述、多级子分类树，以及该分类下的具体机型（型号代号）。
 */
export interface MegaNode {
    name: string;
    path: string;
    count: number;
    children: MegaNode[];
}
/** 一列里的具体机型：label 是型号代号（如 C600），name 是完整产品名（做 title） */
export interface MegaModel {
    label: string;
    name: string;
    path: string;
}
export interface MegaColumn extends MegaNode {
    slug: string;
    thumb: string;
    desc: string;
    models: MegaModel[];
}

function descendantCats(slug: string): ProductCategory[] {
    return childCategories(slug).flatMap((k) => [k, ...descendantCats(k.slug)]);
}

/** 该分类（含后代）下的实际产品列表 */
function productsUnder(slug: string): Product[] {
    const slugs = new Set([slug, ...descendantCats(slug).map((c) => c.slug)]);
    return allProducts().filter((p) => p.categories.some((c) => slugs.has(c.slug)));
}

function countIn(slug: string): number {
    return productsUnder(slug).length;
}

/** 代表缩略图：该分类下第一个带图产品的首图 */
function thumbIn(slug: string): string {
    return productsUnder(slug).find((p) => p.images.length > 0)?.images[0]?.src ?? '';
}

/** 递归子分类树，只保留有货的后代，保留真实层级 */
function childTree(slug: string): MegaNode[] {
    return childCategories(slug)
        .filter((c) => countIn(c.slug) > 0)
        .map((c) => ({ name: c.name, path: c.canonical, count: countIn(c.slug), children: childTree(c.slug) }));
}

/** 型号代号：去掉品牌前缀与 “| CENNETIC …” 后缀，取首个 token（如 C600 / 1160 / Z600L+） */
function modelLabel(name: string): string {
    const cleaned = name
        .replace(/^CENNETIC\s+/i, '')
        .replace(/\s*\|\s*CENNETIC.*$/i, '')
        .trim();
    return cleaned.split(/\s+/)[0] || cleaned;
}

/** 该分类下的具体机型（限 limit 台，优先带图的），供 Mega 面板列型号 */
function modelsUnder(slug: string, limit: number): MegaModel[] {
    return productsUnder(slug)
        .slice(0, limit)
        .map((p) => ({ label: modelLabel(p.name), name: p.name, path: p.canonical }));
}

/** 顶层分类列（有货的），按产品数降序；每列带具体机型 */
export function megaMenu(): MegaColumn[] {
    return productCategories
        .filter((c) => c.trail.length === 1 && c.slug !== 'uncategorized')
        .map((c) => ({
            slug: c.slug,
            name: c.name,
            path: c.canonical,
            count: countIn(c.slug),
            children: childTree(c.slug),
            thumb: thumbIn(c.slug),
            desc: c.description,
            models: modelsUnder(c.slug, 8),
        }))
        .filter((col) => col.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(a.name));
}
