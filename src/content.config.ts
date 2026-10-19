import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 内容集合定义。
 *
 * 文章正文在迁移时保留了干净 HTML（而非 Markdown），原因见 04-articles 顶部说明：
 * 正文含 143 个表格与大量 qf-* 组件类名，Markdown 往返会丢类名。
 * 因此模板侧用 entry.body 取原始 HTML 直接渲染，不走 Markdown 编译。
 * 文件仍是 .md，Decap CMS 可以正常编辑其 frontmatter 与 HTML 源码。
 */

const faq = z.object({
    q: z.string(),
    a: z.string(),
});

const articles = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
    schema: z.object({
        /** 用于 <title> 与 og:title，不含站点后缀（后缀由模板统一拼接） */
        title: z.string(),
        /** 用于页面 H1；与 title 分开，因为 SEO 标题常需加修饰词 */
        heading: z.string(),
        /**
         * 强制必填：实测源站 113 篇已全部有 description，新增文章不允许漏。
         * 上限放到 255 而不是 Google 建议的 160 —— 源站确实有超长值，
         * 截断等于篡改原数据；超长项由迁移报告挑出，交后台人工改短。
         */
        description: z.string().min(30).max(255),
        slug: z.string(),
        /**
         * 可选：它是 slug 的派生值（/slug/），由 lib/content.ts 的 entryPath 兜底。
         * 设成必填会让后台新建文章时必须手填一个本可自动得出的字段。
         */
        canonical: z.string().optional(),
        date: z.coerce.date(),
        lastmod: z.coerce.date(),
        modified: z.coerce.date().optional(),

        categories: z.array(z.string()).default([]),
        /** 指向 src/data/authors.json 的键 */
        author: z.string().optional(),

        hero: z.string().optional(),
        heroAlt: z.string().optional(),
        heroWidth: z.number().int().positive().optional(),
        heroHeight: z.number().int().positive().optional(),

        /** 源站 Rank Math 的 robots 值，逐篇对齐，迁移期不擅自改动 */
        robots: z.string().default('follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'),

        wordCount: z.number().int().nonnegative().default(0),
        readingMinutes: z.number().int().positive().default(1),

        /** 抽取出的 FAQ，用于生成 FAQPage 结构化数据 */
        faq: z.array(faq).optional(),

        /** 迁移回溯用，不参与渲染 */
        sourceId: z.number().int().optional(),
    }),
});

/**
 * 博客分类：由 02 阶段的 categories.json 迁移而来。
 * count=0 的分类（Customer Stories）源站是 noindex，需保留该行为。
 */
const blogCategories = defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/data/blog-categories' }),
    schema: z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().default(''),
        /** 分类页 <title>，缺省时由模板按 "<name> - <site>" 生成 */
        title: z.string().optional(),
        robots: z.string().default('follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'),
        count: z.number().int().nonnegative().default(0),
    }),
});

/**
 * WordPress 页面。正文同样是清洗后的 HTML。
 * isListing 标记那些「主体为列表」的页（/blog/ /shop/ /products/ /news-and-media/），
 * 模板只把它们的正文当列表上方的引言区，列表本身仍由数据层生成。
 */
const pages = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
    schema: z.object({
        title: z.string(),
        heading: z.string(),
        description: z.string().default(''),
        slug: z.string(),
        canonical: z.string().optional(),
        robots: z.string().default('follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'),
        date: z.coerce.date().optional(),
        lastmod: z.coerce.date().optional(),
        hero: z.string().optional(),
        menuOrder: z.number().int().default(0),
        isListing: z.boolean().default(false),
        author: z.string().optional(),
        faq: z.array(faq).optional(),
        sourceId: z.number().int().optional(),
    }),
});

export const collections = { articles, blogCategories, pages };
