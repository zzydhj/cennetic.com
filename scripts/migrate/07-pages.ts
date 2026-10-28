/**
 * Phase 2 · 页面迁移：WordPress 页面 → src/content/pages/<slug>.md
 *
 * 已退役（不再挂在 migrate/index.ts 上）：后台的「页面」类型已整体取消，
 * src/content/pages/ 目录也已删除。保留本文件是因为里面的正文清洗规则（Elementor
 * 残骸→干净 HTML、FAQ 抽取、图片/链接改写）是当时人工核对过的唯一记录，将来要
 * 从源站重拉一类新页面时仍要用。直接重跑会重建一个没人读的目录，所以不要跑。
 *
 * 覆盖源站的 10 个 WP 页面。其中 /blog/ /shop/ /products/ /news-and-media/
 * 虽然也是 WP 页面，但主体内容是文章/产品列表 —— 这些页面的正文只作为「列表上方的
 * 引言区」使用，列表由模板从数据层生成，不搬运正文里的硬编码卡片（那会与实际内容脱节）。
 *
 * 与文章共用 lib/transform.ts 的清洗规则，保证正文表现一致。
 * 页面的内联样式不再进 article.migrated.css —— 它们是 Elementor 的布局 CSS，
 * 与文章正文样式是两套东西，混在一起会互相污染，所以单独留档到 .cache 供复刻比对。
 */
import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import {
    API_CACHE_DIR, CONTENT_DIR, DATA_DIR, ROOT, pathOf, safeSitePath,
} from './lib/config.ts';
import { fetchText } from './lib/http.ts';
import { join, writeJson, writeText, readJson, rel, log, step } from './lib/fs.ts';
import { extractHeadSeo } from './lib/html.ts';
import { loadMediaIndex } from './lib/images.ts';
import { toFrontmatter } from './lib/frontmatter.ts';
import { waLink } from '../../src/lib/whatsapp.ts';
import {
    plainText, stripSiteSuffix, normalizeContainer, demoteH1, dropAuthorBoxes, extractFaq,
    normalizeProsCons, normalizeTestimonials, ensureHeadingIds, annotateTableHeaders,
    rewriteImages, rewriteLinks, collectAuthorBoxes, canonicalAuthorOf, extractRenderedBody,
} from './lib/transform.ts';
import type { WpPost, UrlRecord } from './lib/types.ts';

const PAGES_DIR = join(CONTENT_DIR, 'pages');
const REPORT_FILE = join(ROOT, 'migration', 'pages-report.json');
const ROOT_SELECTOR = '#qf-root';

/**
 * 这些页主体是列表，正文仅作引言区。
 * 实测 /products/ 与 /service/ 在源站 .entry-content 为空（22 字节），
 * 页内内容全是 WooCommerce 产品循环卡片 —— 它们本就是自动生成列表页，
 * 没有作者撰写的文案可迁，所以归到这里由模板从产品数据生成，比搬空壳更贴近实际渲染。
 */
const ARCHIVE_SLUGS = new Set(['blog', 'shop', 'products', 'service', 'news-and-media', 'home']);

interface SiteConfig {
    whatsapp: { number: string };
    url: string;
    name: string;
}

export async function buildPages(): Promise<void> {
    step('Phase 2 · 页面迁移');

    const pages = await readJson<WpPost[]>(join(API_CACHE_DIR, 'pages.json'), [] as WpPost[]);
    const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);
    const manifest = await readJson<{ urls: UrlRecord[] }>(join(ROOT, 'migration', 'url-manifest.json'));
    const site = JSON.parse(await readFile(join(ROOT, 'src/data/site.json'), 'utf8')) as SiteConfig;
    const mediaIndex = await loadMediaIndex();

    const articleSlugs = new Set(posts.map((p) => p.slug));
    const byPath = new Map(manifest.urls.map((u) => [u.path, u]));

    // 作者框只在文章里出现，但页面若也有则一并纳入同一条记录，避免两处定义
    const variants: Parameters<typeof canonicalAuthorOf>[0] = [];
    for (const p of pages) collectAuthorBoxes(p.content.rendered, p.slug, variants);
    const { author: canonicalAuthor } = canonicalAuthorOf(variants);

    const elementorCss: Array<{ slug: string; bytes: number; source: string }> = [];
    const unresolved: Record<string, number> = {};
    const logs: Array<Record<string, unknown>> = [];

    log(`  待转换 ${pages.length} 个页面`);

    for (const page of pages) {
        const canonicalPath = pathOf(page.link);
        const heading = plainText(page.title.rendered);

        const html = await fetchText(page.link, { kind: 'page-html', allow404: true });
        const seo = html ? extractHeadSeo(html) : null;

        // REST 正文为空时（products / service），回落到阶段 02 缓存的整页 HTML 取正文区
        let source = (page.content?.rendered ?? '').trim();
        let bodySource: 'rest' | 'rendered-html' = 'rest';
        if (!source && html) {
            source = extractRenderedBody(html);
            bodySource = source ? 'rendered-html' : 'rest';
        }

        const $ = cheerio.load(`<div id="qf-root">${source}</div>`);

        // Elementor 页面样式单独留档，不混入文章样式表
        const styles = $('style');
        if (styles.length > 0) {
            elementorCss.push({ slug: page.slug, bytes: styles.text().length, source: bodySource });
            styles.remove();
        }

        normalizeContainer($);
        const demoted = demoteH1($, ROOT_SELECTOR);
        const extractedAuthor = dropAuthorBoxes($);
        const faq = extractFaq($);
        const prosCons = normalizeProsCons($);
        normalizeTestimonials($);
        const headingsWithoutId = ensureHeadingIds($, ROOT_SELECTOR);
        annotateTableHeaders($);

        const images = rewriteImages($, mediaIndex);
        const links = rewriteLinks($, {
            articleSlugs,
            waUrl: waLink({ number: site.whatsapp.number, siteUrl: site.url }, { subject: heading }),
            canonicalPath,
            unresolved,
        });

        const body = ($('#qf-root').html() ?? '').trim();

        // Rank Math 的页面标题本身就含品牌信息，优先用清单里记录的原值
        const rec = byPath.get(canonicalPath);
        const title = stripSiteSuffix(rec?.title ?? seo?.title ?? heading, site.name);

        await writeText(join(PAGES_DIR, `${page.slug}.md`), toFrontmatter({
            title,
            heading,
            slug: page.slug,
            canonical: canonicalPath,
            description: seo?.description || plainText(page.excerpt?.rendered ?? ''),
            robots: rec?.robots ?? seo?.robots ?? undefined,
            date: page.date,
            lastmod: page.modified,
            hero: seo?.ogImage ? safeSitePath(seo.ogImage) ?? undefined : undefined,
            sourceId: page.id,
            menuOrder: page.menu_order ?? 0,
            /** 标记该页主体为列表，模板据此决定正文用法 */
            isListing: ARCHIVE_SLUGS.has(page.slug),
            faq: faq.length > 0 ? faq : undefined,
            author: extractedAuthor && canonicalAuthor ? canonicalAuthor.slug : undefined,
        } as Record<string, unknown>) + `\n${body}\n`);

        logs.push({
            slug: page.slug,
            canonical: canonicalPath,
            bodySource,
            bodyChars: body.length,
            elementorStyleBlocks: styles.length,
            demotedH1: demoted,
            prosConsNormalized: prosCons,
            faqItems: faq.length,
            imagesRewritten: images.rewritten,
            imagesDropped: images.dropped.map((d) => d.srcPath),
            ctaToWhatsapp: links.ctaToWhatsapp,
            headingsWithoutId,
        });

        log(`  ${page.slug.padEnd(28)} ${bodySource.padEnd(14)} 正文 ${String(body.length).padStart(7)} 字  图 ${images.rewritten}  CTA→WA ${links.ctaToWhatsapp}`);
    }

    await writeJson(REPORT_FILE, {
        total: logs.length,
        elementorCss,
        unresolvedLinks: unresolved,
        perPage: logs,
    });

    log('');
    log(`✓ 页面数据 → ${rel(PAGES_DIR)}`);
    const noBody = logs.filter((l) => l.bodyChars === 0).map((l) => l.slug);
    if (noBody.length > 0) {
        log(`  ⓘ 正文为空、需由模板供给内容的页面 ${noBody.length} 个：${noBody.join(', ')}`);
    }
    log(`  Elementor 内联样式已剥离并留档：${elementorCss.reduce((s, e) => s + e.bytes, 0)} 字节（不进入站点样式表）`);
    const unknown = Object.entries(unresolved).sort((a, b) => b[1] - a[1]);
    if (unknown.length > 0) {
        log(`  ⚠ 页面链接指向清单外目标 ${unknown.length} 种：`);
        for (const [p, n] of unknown.slice(0, 12)) log(`      x${n}  ${p}`);
    }
    log(`  报告：${rel(REPORT_FILE)}`);
}
