/**
 * 源站 WordPress REST API 与 WooCommerce Store API 的响应结构。
 * 只声明迁移真正用到的字段。
 */

export interface WpRich {
    rendered: string;
    protected?: boolean;
}

export interface WpEmbeddedTerm {
    id: number;
    name: string;
    slug: string;
    link: string;
    taxonomy?: string;
    parent?: number;
    description?: string;
    count?: number;
}

/** /wp/v2/posts 与 /wp/v2/pages */
export interface WpPost {
    id: number;
    date: string;
    date_gmt: string;
    modified: string;
    modified_gmt: string;
    slug: string;
    link: string;
    title: WpRich;
    content: WpRich;
    excerpt: WpRich;
    author: number;
    featured_media: number;
    categories?: number[];
    tags?: number[];
    template?: string;
    parent?: number;
    menu_order?: number;
    status?: string;
    type?: string;
    _embedded?: {
        'wp:featuredmedia'?: Array<{
            id: number;
            source_url: string;
            alt_text: string;
            media_details?: { width?: number; height?: number; file?: string };
        }>;
        'wp:term'?: WpEmbeddedTerm[][];
        author?: Array<{ id: number; name: string; link: string }>;
    };
}

/** /wp/v2/categories */
export interface WpCategory {
    id: number;
    name: string;
    slug: string;
    description: string;
    parent: number;
    count: number;
    link: string;
}

/** /wp/v2/media */
export interface WpMediaItem {
    id: number;
    date: string;
    slug: string;
    alt_text: string;
    source_url: string;
    mime_type: string;
    media_details?: {
        width?: number;
        height?: number;
        file?: string;
        sizes?: Record<string, { source_url: string; width: number; height: number }>;
    };
}

/** /wc/store/v1/products */
export interface StoreProduct {
    id: number;
    name: string;
    slug: string;
    permalink: string;
    short_description: string;
    description: string;
    sku: string;
    price: string;
    regular_price: string;
    sale_price: string;
    on_sale: boolean;
    prices?: Record<string, unknown>;
    images: Array<{ id: number; src: string; thumbnail: string; alt: string; name?: string }>;
    categories: Array<{ id: number; name: string; slug: string; permalink: string }>;
    tags: Array<{ id: number; name: string; slug: string; permalink: string }>;
    attributes: Array<{
        id: number;
        name: string;
        slug: string;
        terms: Array<{ id: number; name: string; slug: string }>;
    }>;
    add_to_cart?: Record<string, unknown>;
    is_purchasable?: boolean;
    type?: string;
}

/** /wc/store/v1/products/categories */
export interface StoreProductCategory {
    id: number;
    name: string;
    slug: string;
    description: string;
    parent: number;
    count: number;
    image: { id: number; src: string; thumbnail: string; alt: string } | null;
    permalink: string;
}

/** Rank Math 站点地图条目 */
export interface SitemapEntry {
    loc: string;
    lastmod?: string;
    images: string[];
}

/** 单个 URL 的迁移基线记录 */
export interface UrlRecord {
    /** 站内路径，带尾斜杠 */
    path: string;
    /** 源站绝对 URL */
    url: string;
    /** 抓取到的 HTTP 状态 */
    status: number;
    /** 来源：sitemap | pagination-probe | api | archive */
    source: string;
    title?: string;
    canonical?: string;
    robots?: string;
    description?: string;
    /** 源站声明的最后修改时间 */
    lastmod?: string;
    /** 内容类型，用于映射到 Astro 模板 */
    kind: 'home' | 'page' | 'article' | 'product' | 'product-category' | 'blog-category' | 'archive-page' | 'redirect' | 'other';
    /**
     * 含义随 kind 变化：
     *  - kind=redirect 时，为应 301 到的站内路径
     *  - 其他情况为预计构建产物路径
     */
    target?: string;
}
