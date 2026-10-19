/**
 * 内容查询与分页。
 *
 * 分页必须与源站逐页对齐：实测源站每页 10 篇（/blog/ 探测出 11 个分页 = 113 篇；
 * technical-knowledge 74 篇 = 8 页，其中 7 个分页）。分页 URL 是 /blog/page/N/ 形态，
 * Google 可能已收录，少建一页就是 404。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export const PER_PAGE = 10;

export type Article = CollectionEntry<'articles'>;

/**
 * 站内链接路径。
 *
 * slug 是唯一真相，文件里存的 canonical 本质上是它的派生值；
 * 后台新建的文章可能没填 canonical，所以统一在这一层兜底推导，
 * 而不是在每个模板里各写一遍 `d.canonical || ...` —— 那种写法一多，
 * 总会有一个地方漏掉，而漏掉就是链接指向 undefined。
 */
export function entryPath(d: { slug: string; canonical?: string }): string {
    const stored = d.canonical?.trim();
    if (stored) return stored;
    return d.slug === 'home' || d.slug === '' ? '/' : `/${d.slug}/`;
}

/** 全站文章，按发布日期倒序 */
export async function allArticles(): Promise<Article[]> {
    const posts = await getCollection('articles');
    return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function articleBySlug(slug: string): Promise<Article | undefined> {
    const posts = await allArticles();
    return posts.find((p) => p.data.slug === slug);
}

/** 分类下的文章，倒序 */
export async function articlesInCategory(categorySlug: string): Promise<Article[]> {
    const posts = await allArticles();
    return posts.filter((p) => p.data.categories.includes(categorySlug));
}

/** 同分类优先、其次按时间接近，取相关文 */
export function relatedArticles(current: Article, pool: Article[], limit = 4): Article[] {
    const sameCat = pool.filter(
        (p) => p.id !== current.id && p.data.categories.some((c) => current.data.categories.includes(c)),
    );
    const rest = pool.filter((p) => p.id !== current.id && !sameCat.includes(p));
    return [...sameCat, ...rest].slice(0, limit);
}

/** 总页数 */
export function pageCount(total: number): number {
    return Math.max(1, Math.ceil(total / PER_PAGE));
}

/**
 * 第 n 页（1 基）的分页路径。
 * 第 1 页不生成 /page/1/ —— 源站 /blog/page/1/ 会 301 回 /blog/，
 * 新站保持一致以避免无意义的重复页面。
 */
export function pagePath(basePath: string, n: number): string {
    if (n <= 1) return basePath;
    const p = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return `${p}page/${n}/`;
}

export interface Pagination {
    current: number;
    total: number;
    /** 只在需要时给出相邻页链接，首页不产生自指 */
    prev?: string;
    next?: string;
}

export function paginate<T>(items: T[], n: number, basePath: string): { items: T[]; pagination: Pagination } {
    const total = pageCount(items.length);
    const clamped = Math.min(Math.max(1, n), total);
    const start = (clamped - 1) * PER_PAGE;

    return {
        items: items.slice(start, start + PER_PAGE),
        pagination: {
            current: clamped,
            total,
            prev: clamped > 2 ? pagePath(basePath, clamped - 1) : clamped === 2 ? basePath : undefined,
            next: clamped < total ? pagePath(basePath, clamped + 1) : undefined,
        },
    };
}

/** 从正文 HTML 里抽出目录项，避免在模板里做正则 */
export function headingsFromHtml(html: string): Array<{ id: string; text: string; level: 2 | 3 }> {
    const out: Array<{ id: string; text: string; level: 2 | 3 }> = [];
    const re = /<h([23])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    for (const m of html.matchAll(re)) {
        const text = m[3]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        out.push({ id: m[2]!, text, level: Number(m[1]) as 2 | 3 });
    }
    return out;
}
