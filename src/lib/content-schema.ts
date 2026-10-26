/**
 * 内容字段契约的唯一真相（camelCase，与 .md frontmatter / 快照 JSON 对齐）。
 *
 * 为什么放这里：这是「前台渲染所依赖的契约」，归属内容层；content.config.ts 用它建集合，
 * scripts/cms/*（灌库/快照）与后台 admin 也 import 它，避免同一组字段在多处各写一遍而漂移。
 * DB 是 snake_case，映射规则集中在 scripts/cms，字段类型/约束只在这一处定义。
 *
 * zod 取顶层 `zod`（astro 依赖并已提升到 node_modules，同一实例，类型一致）。
 */
import { z } from 'zod';

/** 默认 robots（与迁移期源站 Rank Math 输出对齐） */
export const DEFAULT_ROBOTS =
    'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large';

export const faqItemSchema = z.object({
    q: z.string(),
    a: z.string(),
});

/** 文章 frontmatter（对应集合 articles；正文 body 由 loader 提供，不在此列） */
export const articleSchema = z.object({
    title: z.string(),
    heading: z.string(),
    description: z.string().min(30).max(255),
    slug: z.string(),
    canonical: z.string().optional(),
    date: z.coerce.date(),
    lastmod: z.coerce.date(),
    modified: z.coerce.date().optional(),
    categories: z.array(z.string()).default([]),
    author: z.string().optional(),
    hero: z.string().optional(),
    heroAlt: z.string().optional(),
    heroWidth: z.number().int().positive().optional(),
    heroHeight: z.number().int().positive().optional(),
    robots: z.string().default(DEFAULT_ROBOTS),
    wordCount: z.number().int().nonnegative().default(0),
    readingMinutes: z.number().int().positive().default(1),
    faq: z.array(faqItemSchema).optional(),
    sourceId: z.number().int().optional(),
});

/** 固定页面 frontmatter（对应集合 pages） */
export const pageSchema = z.object({
    title: z.string(),
    heading: z.string(),
    description: z.string().default(''),
    slug: z.string(),
    canonical: z.string().optional(),
    robots: z.string().default(DEFAULT_ROBOTS),
    date: z.coerce.date().optional(),
    lastmod: z.coerce.date().optional(),
    hero: z.string().optional(),
    menuOrder: z.number().int().default(0),
    isListing: z.boolean().default(false),
    author: z.string().optional(),
    faq: z.array(faqItemSchema).optional(),
    sourceId: z.number().int().optional(),
});

/** 博客分类（对应集合 blogCategories，数据在 src/data/blog-categories/*.json） */
export const blogCategorySchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().default(''),
    title: z.string().optional(),
    robots: z.string().default(DEFAULT_ROBOTS),
    count: z.number().int().nonnegative().default(0),
});

/** 产品（非内容集合，走 import.meta.glob 读 src/data/products/*.json） */
export const productImageSchema = z.object({
    src: z.string(),
    alt: z.string(),
    width: z.number().int(),
    height: z.number().int(),
});

export const productCategoryRefSchema = z.object({
    slug: z.string(),
    name: z.string(),
    canonical: z.string(),
});

export const productSpecSchema = z.object({
    name: z.string(),
    values: z.array(z.string()),
});

export const productSchema = z.object({
    slug: z.string(),
    name: z.string(),
    canonical: z.string(),
    summary: z.string().default(''),
    body: z.string().default(''),
    images: z.array(productImageSchema).default([]),
    categories: z.array(productCategoryRefSchema).default([]),
    specs: z.array(productSpecSchema).default([]),
    faq: z.array(faqItemSchema).optional(),
});

/** 产品分类（src/data/product-categories.json，数组） */
export const productCategorySchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string().default(''),
    parent: z.union([z.string(), z.number()]),
    count: z.number().int().nonnegative().default(0),
    canonical: z.string(),
    trail: z.array(z.string()).default([]),
    robots: z.string().default(DEFAULT_ROBOTS),
    title: z.string().default(''),
});

/** 作者（src/data/authors.json，键为 slug 的对象表） */
export const authorSchema = z.object({
    slug: z.string(),
    name: z.string(),
    role: z.string().default(''),
    bio: z.string().default(''),
    avatar: z.string().default(''),
});

/** 站点设置：镜像 src/data/site.json；用 passthrough 容忍新增键，快照整块 JSON 存储 */
export const siteSettingsSchema = z
    .object({
        name: z.string(),
        legalName: z.string(),
        shortName: z.string(),
        url: z.string(),
        language: z.string().default('en'),
        logo: z.string().default(''),
        description: z.string().default(''),
        email: z.string().default(''),
        phone: z.string().default(''),
        phoneDisplay: z.string().default(''),
    })
    .passthrough();

/** R2 媒体资产登记（后台素材库复用） */
export const mediaAssetSchema = z.object({
    key: z.string(),
    public_url: z.string(),
    alt: z.string().default(''),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    bytes: z.number().int().nonnegative().optional(),
    mime: z.string().optional(),
});

export type FaqItem = z.infer<typeof faqItemSchema>;
export type ArticleFrontmatter = z.infer<typeof articleSchema>;
export type PageFrontmatter = z.infer<typeof pageSchema>;
export type BlogCategory = z.infer<typeof blogCategorySchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductCategory = z.infer<typeof productCategorySchema>;
export type Author = z.infer<typeof authorSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
