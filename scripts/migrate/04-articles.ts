/**
 * Phase 2 · 文章迁移：113 篇 WP 文章 → src/content/articles/*.md
 *
 * 格式决策（与原方案的偏离及原因）：
 *   原计划用 turndown 转 Markdown，但实测正文含 143 个表格与 65 套 qf-* 组件类名
 *   （pros/cons、compare-table、faq-item、testimonial、highlight-box…）。
 *   HTML→Markdown 往返必然丢类名，再靠 CSS 硬凑回来既不保真也难维护。
 *   因此文件仍是 .md（便于后台编辑与版本管理），但正文保留干净 HTML 直接渲染。
 *
 * 具体的清洗规则都在 lib/transform.ts（文章与页面共用），本文件只负责：
 * 读取 REST 与 head 元数据 → 调用转换 → 写 frontmatter → 汇总报告。
 *
 * 产出：
 *   src/content/articles/<slug>.md
 *   src/styles/article.migrated.css   （机器所有，人工微调写在 article.css）
 *   src/data/authors.json             （104 个署名框归一为一条记录）
 *   migration/articles-report.json
 */
import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';
import {
    API_CACHE_DIR, CONTENT_DIR, DATA_DIR, ROOT, STYLES_DIR, pathOf,
} from './lib/config.ts';
import { fetchText } from './lib/http.ts';
import { join, writeJson, writeText, readJson, rel, log, step } from './lib/fs.ts';
import { extractHeadSeo } from './lib/html.ts';
import { resolve, type RuleBucket } from './lib/css-merge.ts';
import { loadMediaIndex, lookup } from './lib/images.ts';
import { toFrontmatter } from './lib/frontmatter.ts';
import { waLinkForArticle } from '../../src/lib/whatsapp.ts';
import {
    plainText, stripSiteSuffix, harvestStyles, normalizeContainer, demoteH1, removeManualToc,
    collectAuthorBoxes, canonicalAuthorOf, dropAuthorBoxes, extractFaq,
    normalizeProsCons, normalizeTestimonials, ensureHeadingIds, annotateTableHeaders,
    rewriteImages, rewriteLinks,
} from './lib/transform.ts';
import type { WpPost, WpCategory, UrlRecord } from './lib/types.ts';

const ARTICLES_DIR = join(CONTENT_DIR, 'articles');
const REPORT_FILE = join(ROOT, 'migration', 'articles-report.json');
const ROOT_SELECTOR = '#qf-root';

interface SiteConfig {
    whatsapp: { number: string };
    url: string;
    name: string;
}

/** 每篇的转换账，全部落盘供人工复核，不静默吞掉任何一次改动 */
interface ArticleLog {
    slug: string;
    removedStyles: number;
    demotedH1: number;
    removedToc: number;
    extractedAuthor: boolean;
    faqItems: number;
    imagesRewritten: number;
    imagesDropped: string[];
    linksRewritten: number;
    linksFixedFromBlogPrefix: number;
    ctaToWhatsapp: number;
    headingsWithoutId: number;
    prosConsNormalized: number;
    missingDescription: boolean;
    missingHero: boolean;
}

export async function buildArticles(): Promise<void> {
    step('Phase 2 · 文章迁移');

    const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);
    const cats = await readJson<WpCategory[]>(join(API_CACHE_DIR, 'categories.json'), [] as WpCategory[]);
    const site = JSON.parse(await readFile(join(ROOT, 'src/data/site.json'), 'utf8')) as SiteConfig;
    const mediaIndex = await loadMediaIndex();

    const catById = new Map(cats.map((c) => [c.id, c]));
    const articleSlugs = new Set(posts.map((p) => p.slug));

    // 作者归一必须先跑完：frontmatter 里要写唯一的 author slug
    const variants: Parameters<typeof canonicalAuthorOf>[0] = [];
    for (const p of posts) collectAuthorBoxes(p.content.rendered, p.slug, variants);
    const { author: canonicalAuthor, markupMix } = canonicalAuthorOf(variants);
    const authorSlug = canonicalAuthor?.slug ?? '';

    const cssBuckets = new Map<string, RuleBucket>();
    const unresolved: Record<string, number> = {};
    const logs: ArticleLog[] = [];

    log(`  待转换 ${posts.length} 篇`);

    for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i]!;
        const canonicalPath = pathOf(post.link);
        const heading = plainText(post.title.rendered);

        // head 元数据来自阶段 02 已缓存的整页 HTML —— Rank Math 字段不在 REST 里
        const html = await fetchText(post.link, { kind: 'page-html', allow404: true });
        const seo = html ? extractHeadSeo(html) : null;

        const $ = cheerio.load(`<div id="qf-root">${post.content.rendered}</div>`);

        const removedStyles = harvestStyles($, cssBuckets);
        normalizeContainer($);
        const demoted = demoteH1($, ROOT_SELECTOR);
        const removedToc = removeManualToc($);
        const extractedAuthor = dropAuthorBoxes($);
        const faq = extractFaq($);
        const prosCons = normalizeProsCons($);
        normalizeTestimonials($);
        const headingsWithoutId = ensureHeadingIds($, ROOT_SELECTOR);
        annotateTableHeaders($);

        const images = rewriteImages($, mediaIndex);
        const links = rewriteLinks($, {
            articleSlugs,
            waUrl: waLinkForArticle({ number: site.whatsapp.number, siteUrl: site.url }, heading, post.link),
            canonicalPath,
            unresolved,
        });

        const body = ($('#qf-root').html() ?? '').trim();
        const wordCount = ($(`${ROOT_SELECTOR}`).text().match(/\b[\w'-]+\b/g) ?? []).length;

        // 主图优先级：REST 特色图 → Rank Math og:image → 正文首图
        const featured = post._embedded?.['wp:featuredmedia']?.[0];
        const ogPath = seo?.ogImage ? pathOf(new URL(seo.ogImage).pathname) : null;
        const heroKey = featured?.source_url ? pathOf(new URL(featured.source_url).pathname) : ogPath;
        const hero = heroKey ? lookup(mediaIndex, heroKey) : undefined;
        const firstImg = body.match(/<img[^>]+src="([^"]+)"/)?.[1];

        const description = seo?.description || plainText(post.excerpt?.rendered ?? '');

        await writeText(join(ARTICLES_DIR, `${post.slug}.md`), toFrontmatter({
            // <title> 用 Rank Math 的原值（去掉站点后缀，后缀由模板统一拼接）
            title: seo?.title ? stripSiteSuffix(seo.title, site.name) : heading,
            // H1 用文章本体标题，与 SEO 标题分开，因为后者常需要加修饰词
            heading,
            description,
            slug: post.slug,
            canonical: canonicalPath,
            date: post.date,
            lastmod: post.modified,
            modified: post.modified,
            categories: (post.categories ?? []).map((id) => catById.get(id)?.slug).filter(Boolean),
            author: authorSlug || undefined,
            hero: hero?.publicPath ?? firstImg,
            heroAlt: featured?.alt_text || undefined,
            heroWidth: hero?.width || undefined,
            heroHeight: hero?.height || undefined,
            robots: seo?.robots || undefined,
            wordCount,
            readingMinutes: Math.max(1, Math.round(wordCount / 220)),
            faq: faq.length > 0 ? faq : undefined,
            sourceId: post.id,
        } as Record<string, unknown>) + `\n${body}\n`);

        logs.push({
            slug: post.slug,
            removedStyles,
            demotedH1: demoted,
            removedToc,
            extractedAuthor,
            faqItems: faq.length,
            imagesRewritten: images.rewritten,
            imagesDropped: images.dropped.map((d) => d.srcPath),
            linksRewritten: links.rewritten,
            linksFixedFromBlogPrefix: links.fixedFromBlogPrefix,
            ctaToWhatsapp: links.ctaToWhatsapp,
            headingsWithoutId,
            prosConsNormalized: prosCons,
            missingDescription: !description,
            missingHero: !hero && !firstImg,
        });

        if ((i + 1) % 25 === 0) log(`  ${i + 1}/${posts.length}`);
    }

    const merged = resolve(cssBuckets);
    await writeText(join(STYLES_DIR, 'article.migrated.css'), merged.css);
    await writeJson(join(DATA_DIR, 'authors.json'), canonicalAuthor ? { [canonicalAuthor.slug]: canonicalAuthor } : {});

    const missingImages = [...new Set(logs.flatMap((l) => l.imagesDropped))];
    await writeJson(REPORT_FILE, {
        total: logs.length,
        cssSelectors: cssBuckets.size,
        cssRules: merged.totalRules,
        cssConflicts: merged.conflicts.length,
        authorVariants: variants.length,
        authorCanonical: canonicalAuthor,
        authorMarkupMix: markupMix,
        missingImages,
        unresolvedLinks: unresolved,
        perArticle: logs,
        // 分歧明细只留前 400 条，完整信息在 merged 结果里可按需重跑
        cssConflictsDetail: merged.conflicts.slice(0, 400),
        cssLowSupport: merged.lowSupport.slice(0, 200),
    });

    const sum = (pick: (l: ArticleLog) => number) => logs.reduce((s, l) => s + pick(l), 0);

    log('');
    log('✓ 文章转换完成');
    log(`  Markdown 文件      : ${logs.length} 个 → ${rel(ARTICLES_DIR)}`);
    log(`  CSS 选择器归并     : ${cssBuckets.size} 个 → ${merged.totalRules} 条规则，单一 ${rel(join(STYLES_DIR, 'article.migrated.css'))}`);
    log(`  CSS 投票分歧       : ${merged.conflicts.length} 处（已取多数值）`);
    log(`  作者署名归一       : ${variants.length} 个框 → 1 条记录（${Object.entries(markupMix).map(([k, n]) => `${k}:${n}`).join(' ')}）`);
    if (canonicalAuthor) log(`      ${canonicalAuthor.name} — ${canonicalAuthor.role}，简介 ${canonicalAuthor.bio.length} 字`);
    log(`  移除手写目录       : ${sum((l) => l.removedToc)} 处`);
    log(`  降级正文 H1        : ${sum((l) => l.demotedH1)} 处`);
    log(`  归一 pros/cons     : ${sum((l) => l.prosConsNormalized)} 处`);
    log(`  FAQ 可上结构化     : ${sum((l) => l.faqItems)} 条（FAQPage）`);
    log(`  改写图片           : ${sum((l) => l.imagesRewritten)} 个，写死宽高防 CLS`);
    log(`  剔除源站 404 图    : ${missingImages.length} 个`);
    log(`  修复 /blog/ 坏内链 : ${sum((l) => l.linksFixedFromBlogPrefix)} 条`);
    log(`  CTA 转 WhatsApp    : ${sum((l) => l.ctaToWhatsapp)} 个`);
    log(`  缺 description     : ${logs.filter((l) => l.missingDescription).length} 篇`);
    log(`  缺主图             : ${logs.filter((l) => l.missingHero).length} 篇`);
    log(`  标题拿不到 id      : ${sum((l) => l.headingsWithoutId)} 处`);

    const unknown = Object.entries(unresolved).sort((a, b) => b[1] - a[1]);
    if (unknown.length > 0) {
        log(`  ⚠ 链接指向清单外目标 ${unknown.length} 种：`);
        for (const [p, n] of unknown.slice(0, 15)) log(`      x${n}  ${p}`);
    }

    log(`  报告：${rel(REPORT_FILE)}`);
}
