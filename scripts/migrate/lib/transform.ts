/**
 * 正文 HTML 转换层 —— 文章与页面共用。
 *
 * 单独成模块的原因：文章（113 篇）和页面（10 个）需要完全相同的清洗规则
 * （剥内联样式、修坏内链、图片本地化并写死宽高、CTA 转 WhatsApp、标题补 id、
 * 层级归一）。两处各写一份必然逐渐漂移，最终同一篇文章和一个页面的正文
 * 表现不一致，这类 bug 极难从现象定位回来。
 */
import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import { SRC_ORIGIN, pathOf, isSiteHost } from './config.ts';
import { renameTag } from './html.ts';
import { lookup, type MediaEntry } from './images.ts';
import type { AuthorVariant } from './authors.ts';
import { readAuthorBox, canonicalize } from './authors.ts';
import type { RuleBucket } from './css-merge.ts';
import { absorb } from './css-merge.ts';

/**
 * 当 REST 的 content.rendered 为空时，从阶段 02 已缓存的整页 HTML 里抽取正文区。
 *
 * 实测 /products/ 与 /service/ 两个页面 REST 给的是空正文（内容由 WoodMart 主题
 * 模板渲染，不走 post_content），但它们在现站确实是有内容的 200 页。
 * 不回落就会建出两个空页，对用户和 Google 都是低质量页。
 *
 * 选择器按优先级尝试，取第一个非空结果；都拿不到则返回空串，由调用方记录告警。
 */
export function extractRenderedBody(pageHtml: string): string {
    const $ = cheerio.load(pageHtml);

    // Elementor 渲染的整页容器优先
    const candidates = [
        '[data-elementor-type="p-page"]',
        '.elementor .e-loop-item',
        'article .entry-content',
        '#l-main .content-area',
        '.site-main',
        '#main',
    ];

    for (const sel of candidates) {
        const node = $(sel).first();
        if (node.length === 0) continue;
        // 剔除主题自己注入的导航/面包屑/页脚，它们由布局组件统一输出
        node.find('header, footer, nav, .site-breadcrumbs, .woodmart-breadcrumbs').remove();
        const inner = node.html();
        if (inner && inner.trim().length > 200) return inner.trim();
    }

    return '';
}

/**
 * 去掉源站 <title> 自带的站点后缀。
 *
 * 必须去：新站模板会按自己的规则重新拼品牌名，不去就会出「X - Qiaofeng CNC Machine - Cennetic CNC Machine」
 * 这种双品牌标题（实测分类页全部命中），还会把长度顶到 90+ 字而被 Google 截断。
 *
 * 旧品牌后缀一个都不能删：源站抓回来的 title 里写的就是旧品牌，
 * 换成新域名后那些字面量就不存在于任何真实数据里，剩下只有重复项。
 *
 * 三个阶段（文章/分类/页面）共用这一份实现，避免各自写一份逐期漂移。
 */
export function stripSiteSuffix(title: string, siteName: string): string {
    const suffixes = [
        ` - ${siteName}`,
        // 源站（WordPress + WoodMart）实际使用的旧品牌后缀
        ' - Qiaofeng CNC Machine',
        ' - QiaoFeng CNC Machine',
        ' | Qiaofeng CNC Machine',
        ' | QiaoFeng CNC Machine',
        ' | QFCNCMACHINE',
        // 品牌迁移后重跑管道可能碰到的新品牌后缀
        ' - Cennetic CNC Machine',
        ' | Cennetic CNC Machine',
        ' | Cennetic',
    ];
    let t = title;
    for (const s of suffixes) {
        t = t.replace(new RegExp(`${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '');
    }
    // 源站 title 字段可能带 HTML 实体，顺手干净化
    return plainText(t.trim() || title.trim());
}

/** WP 摘要/标题字段带实体码与残留标签，压成干净纯文本 */
export function plainText(text: string): string {
    return text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#8217;|&rsquo;/g, "'")
        .replace(/&#8216;|&lsquo;/g, "'")
        .replace(/&#8220;|&ldquo;/g, '"')
        .replace(/&#8221;|&rdquo;/g, '"')
        .replace(/&#8211;|&ndash;/g, '–')
        .replace(/&#8212;|&mdash;/g, '—')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 剥掉正文内联 <style>，同时并入 CSS 归并器 */
export function harvestStyles($: CheerioAPI, buckets: Map<string, RuleBucket>): number {
    const nodes = $('style');
    const n = nodes.length;
    nodes.each((_, el) => absorb(buckets, $(el).text()));
    nodes.remove();
    return n;
}

/** .qf-body → .qf-article-body，统一容器契约 */
export function normalizeContainer($: CheerioAPI): void {
    $('.qf-body').each((_, el) => {
        $(el).attr('class', ($(el).attr('class') ?? '').replace(/\bqf-body\b/g, 'qf-article-body').trim());
    });
}

/** 正文 h1 降为 h2：模板已输出唯一 H1，两个 H1 会稀释主题信号 */
export function demoteH1($: CheerioAPI, rootSelector: string): number {
    return renameTag($(`${rootSelector} h1`) as never, 'h2');
}

/** 手写目录删掉，模板按实际标题生成，锚点不会失配 */
export function removeManualToc($: CheerioAPI): number {
    const toc = $('.qf-toc');
    const n = toc.length;
    toc.remove();
    return n;
}

/** 采集全站作者框，供归一为单一记录 */
export function collectAuthorBoxes(html: string, slug: string, into: AuthorVariant[]): void {
    const $ = cheerio.load(`<div>${html}</div>`);
    $('.qf-author-box').each((_, el) => {
        const v = readAuthorBox($, $(el));
        if (v) into.push({ ...v, slug });
    });
}

export const canonicalAuthorOf = canonicalize;

/** 从正文移除作者框 */
export function dropAuthorBoxes($: CheerioAPI): boolean {
    const box = $('.qf-author-box');
    if (box.length === 0) return false;
    box.remove();
    return true;
}

/** FAQ 抽出用于 FAQPage 结构化数据；正文块保留 */
export function extractFaq($: CheerioAPI): Array<{ q: string; a: string }> {
    const out: Array<{ q: string; a: string }> = [];
    $('.qf-faq-item').each((_, el) => {
        const q = $(el).find('h3, h4').first().text().trim();
        const a = $(el).find('p').first().text().trim();
        if (q && a) out.push({ q, a });
    });
    return out;
}

/**
 * pros/cons 两种写法归一：.qf-pros-cons（内用 h4）与 .qf-proscons（内用 h3）。
 * 类名统一让样式只需一套；层级统一到 h3 让文档大纲可信（h2 直跳 h4 是无效层级）。
 */
export function normalizeProsCons($: CheerioAPI): number {
    let changed = 0;
    $('.qf-proscons').each((_, el) => {
        $(el).attr('class', ($(el).attr('class') ?? '').replace(/\bqf-proscons\b/g, 'qf-pros-cons').trim());
        changed += 1;
    });
    changed += renameTag($('.qf-pros-cons').find('h4') as never, 'h3');
    return changed;
}

/** 读者评价改为 blockquote/figcaption —— 语义化，且便于 Google 识别引述 */
export function normalizeTestimonials($: CheerioAPI): void {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    $('.qf-testimonial').each((_, el) => {
        const $t = $(el);
        const quote = $t.children('p').first().text().trim();
        const author = $t.find('.qf-t-author, .qf-testimonial-author').first().text().trim();
        if (!quote) return;
        $t.html(
            `<blockquote>${esc(quote)}</blockquote>` + (author ? `<figcaption>${esc(author)}</figcaption>` : ''),
        );
    });
}

/** h2/h3 补 id，供目录与深链使用 */
export function ensureHeadingIds($: CheerioAPI, rootSelector: string): number {
    let missing = 0;
    $(`${rootSelector} h2, ${rootSelector} h3`).each((_, el) => {
        if ($(el).attr('id')) return;
        const slug = $(el).text().trim().toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60);
        if (!slug) {
            missing += 1;
            return;
        }
        $(el).attr('id', slug);
    });
    return missing;
}

/** 列表头加 scope，屏幕阅读器才能正确朗读单元格归属 */
export function annotateTableHeaders($: CheerioAPI): void {
    $('table thead th').each((_, el) => {
        if (!$(el).attr('scope')) $(el).attr('scope', 'col');
    });
}

export interface ImageStat {
    rewritten: number;
    dropped: MediaEntry[];
}

/** 图片本地化 + 写死真实宽高（防 CLS）+ 剔除源站已 404 的图 */
export function rewriteImages($: CheerioAPI, index: Map<string, MediaEntry>): ImageStat {
    const stat: ImageStat = { rewritten: 0, dropped: [] };

    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        let p: string | null;
        try {
            p = pathOf(new URL(src, SRC_ORIGIN).pathname);
        } catch {
            return;
        }
        const entry = lookup(index, p);

        if (!entry || !entry.ok) {
            const holder = $(el).parent('figure, p');
            (holder.length ? holder : $(el)).remove();
            if (entry) stat.dropped.push(entry);
            return;
        }

        $(el).attr('src', entry.publicPath);
        if (entry.width > 0) $(el).attr('width', String(entry.width));
        if (entry.height > 0) $(el).attr('height', String(entry.height));
        $(el).attr('loading', 'lazy');
        $(el).attr('decoding', 'async');
        $(el).removeAttr('data-src');
        $(el).removeAttr('srcset');
        $(el).removeAttr('sizes');
        $(el).removeClass((_, cls) => cls.replace(/\b(wp-image-\d+|size-[\w-]+|align\w+)\b/g, '').trim());
        stat.rewritten += 1;
    });

    return stat;
}

export interface LinkContext {
    /** 全站已知文章 slug，用于把 /blog/<slug>/ 修回 /<slug>/ */
    articleSlugs: Set<string>;
    /** 本页 CTA 应指向的 WhatsApp 链接 */
    waUrl: string;
    /** 本页自身路径，自链接要去掉 href */
    canonicalPath: string;
    /** 收集指向未知目标的链接，供报告核对 */
    unresolved: Record<string, number>;
}

export interface LinkStat {
    rewritten: number;
    fixedFromBlogPrefix: number;
    ctaToWhatsapp: number;
}

/**
 * 链接改写。三件事：
 *   1. 修现存坏链 —— 正文写成 /blog/<slug>/ 而文章实际挂顶级 /<slug>/，实测 4 条直接 404
 *   2. CTA 按钮（原指向 /contact-us/）改走 WhatsApp；判据用类名而非文字，避免误伤正文普通链接
 *   3. 同域绝对链接转相对，外链补 rel，自链接去掉 href
 */
export function rewriteLinks($: CheerioAPI, ctx: LinkContext): LinkStat {
    const stat: LinkStat = { rewritten: 0, fixedFromBlogPrefix: 0, ctaToWhatsapp: 0 };

    $('a[href]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href')!;
        if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
        // 图片直达链接（灯箱常用）不能加尾斜杠，否则路径被破坏
        if (/\.(png|jpe?g|webp|avif|gif|svg|pdf)($|\?)/i.test(href)) return;

        let p = href;
        try {
            if (href.startsWith('http')) {
                const u = new URL(href);
                // 新旧域名及其 www 变体都算自家，否则旧域名内链会被当外链留着绝对地址
                if (!isSiteHost(u.host)) {
                    const rel = $a.attr('rel') ?? '';
                    if (!/\bnoopener\b/.test(rel)) $a.attr('rel', `${rel} noopener noreferrer`.trim());
                    return;
                }
                p = u.pathname;
            } else if (!p.startsWith('/')) {
                return;
            }
        } catch {
            return;
        }

        const cleanPath = p.endsWith('/') ? p : `${p}/`;
        let next = cleanPath;

        const blogPrefixed = cleanPath.match(/^\/blog\/([^/]+)\/$/);
        if (blogPrefixed && blogPrefixed[1] !== 'page' && ctx.articleSlugs.has(blogPrefixed[1]!)) {
            next = `/${blogPrefixed[1]}/`;
            stat.fixedFromBlogPrefix += 1;
        } else if (cleanPath === '/contact/') {
            next = '/contact-us/';
        }

        const isCta = /qf-cta-btn|qf-btn|cta-button/.test($a.attr('class') ?? '');
        if (isCta && next === '/contact-us/') {
            $a.attr('href', ctx.waUrl);
            $a.attr('target', '_blank');
            $a.attr('rel', 'noopener noreferrer');
            // 内联样式交回样式表管理，迁移已剥掉 style 属性
            $a.removeAttr('style');
            stat.ctaToWhatsapp += 1;
            stat.rewritten += 1;
            return;
        }

        if (next === ctx.canonicalPath) {
            $a.removeAttr('href');
            return;
        }

        if (next !== href) stat.rewritten += 1;
        $a.attr('href', next);

        const known = /^\/(product|product-category|category|blog|about-us|contact-us|service|products|shop|privacy-policy|cnc-machine-refund-policy|news-and-media)/.test(next);
        const isArticle = ctx.articleSlugs.has(next.replace(/^\//, '').replace(/\/$/, ''));
        if (!known && !isArticle && next !== '/') {
            ctx.unresolved[next] = (ctx.unresolved[next] ?? 0) + 1;
        }
    });

    return stat;
}
