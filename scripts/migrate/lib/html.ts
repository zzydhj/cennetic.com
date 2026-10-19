/**
 * 从源站已渲染 HTML 的 <head> 中提取 Rank Math 输出的 SEO 元数据。
 * REST API 不暴露这些 postmeta，因此必须回落到 HTML 解析。
 */
import * as cheerio from 'cheerio';

export interface HeadSeo {
    title: string;
    description: string;
    canonical: string;
    robots: string;
    og: Record<string, string>;
    /** 原始 JSON-LD 脚本块，迁移后按类型重建 */
    jsonLd: unknown[];
    ogImage: string;
    publishedTime: string;
    modifiedTime: string;
    breadcrumb: Array<{ name: string; url: string }> | null;
}

export function extractHeadSeo(html: string): HeadSeo {
    const $ = cheerio.load(html);

    const og: Record<string, string> = {};
    $('meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"]').each((_, el) => {
        const key = ($(el).attr('property') || $(el).attr('name') || '').trim();
        const content = ($(el).attr('content') || '').trim();
        if (key && content) og[key] = content;
    });

    const jsonLd: unknown[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            jsonLd.push(JSON.parse($(el).text()));
        } catch {
            /* 源站偶尔有非法 JSON-LD，跳过而不是中断管道 */
        }
    });

    const breadcrumb = extractBreadcrumb(jsonLd);

    return {
        title: ($('title').first().text() || '').trim(),
        description: ($('meta[name="description"]').attr('content') || '').trim(),
        canonical: ($('link[rel="canonical"]').attr('href') || '').trim(),
        robots: ($('meta[name="robots"]').attr('content') || '').trim(),
        og,
        jsonLd,
        ogImage: og['og:image'] || '',
        publishedTime: og['article:published_time'] || '',
        modifiedTime: og['article:modified_time'] || '',
        breadcrumb,
    };
}

/** 从 BreadcrumbList JSON-LD 还原面包屑，供新站复用同名结构 */
function extractBreadcrumb(jsonLd: unknown[]): Array<{ name: string; url: string }> | null {
    for (const block of jsonLd) {
        const items = Array.isArray(block) ? block : [block];
        for (const node of items) {
            const graph = (node as { '@graph'?: unknown[] })?.['@graph'];
            const candidates = graph ? [...graph, node] : [node];
            for (const c of candidates) {
                const item = c as { '@type'?: string; itemListElement?: unknown[] };
                if (item?.['@type'] === 'BreadcrumbList' && Array.isArray(item.itemListElement)) {
                    return item.itemListElement.map((raw) => {
                        const e = raw as { name?: string; item?: string };
                        return { name: e.name ?? '', url: e.item ?? '' };
                    });
                }
            }
        }
    }
    return null;
}

/**
 * 判断某段 <style> 是否属于文章正文的作用域样式。
 * 源站每篇文章头部都重复内联一份 .qf-article-body CSS —— 迁移时抽成唯一一份共享样式表。
 */
export function isArticleScopedStyle(css: string): boolean {
    return /\.qf-article|\.qf-competitor|\.qf-table|\.qf-spec|\.qf-faq|\.qf-tip|\.qf-warning|\.qf-checklist/.test(css);
}

/** 去掉 WordPress 自动插入的段落包裹，便于 turndown 更干净地识别块级结构 */
export function normalizeWpContent(html: string): string {
    return html
        .replace(/<p class="wp-block-embed__wrapper">/g, '<p>')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/** HTML 实体解码，用于标题等纯文本字段 */
export function decodeEntities(text: string): string {
    if (!text) return text;
    const $ = cheerio.load(`<i>${text}</i>`);
    return $('i').first().text().trim();
}

/**
 * 直接改 DOM 节点标签名实现降级/升级（如 h1→h2）。
 * 不用对 outerHTML 做正则替换：那种写法在属性里出现同名子串时会误伤，
 * 且 cheerio 的 prop('outerHTML') 类型为可空，容易引入空值分支。
 */
export function renameTag(nodes: cheerio.Cheerio<never>, to: string): number {
    let n = 0;
    nodes.each((_, el) => {
        const node = el as unknown as { tagName?: string; name?: string };
        if (!node.tagName) return;
        node.tagName = to;
        node.name = to;
        n += 1;
    });
    return n;
}

/** 当前标签名（小写） */
export function tagOf(el: unknown): string {
    return ((el as { tagName?: string })?.tagName ?? '').toLowerCase();
}
