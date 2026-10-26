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
