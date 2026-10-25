import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema, blogCategorySchema, pageSchema } from './lib/content-schema';

/**
 * 内容集合定义。字段契约的唯一真相在 ./lib/content-schema.ts（与灌库/快照/后台共用），
 * 这里只负责把 schema 绑定到具体 loader。
 *
 * 文章正文在迁移时保留了干净 HTML（而非 Markdown），原因见 04-articles 顶部说明：
 * 正文含 143 个表格与大量 qf-* 组件类名，Markdown 往返会丢类名。
 * 因此模板侧用 entry.body 取原始 HTML 直接渲染，不走 Markdown 编译。
 * 文件仍是 .md，后台可以正常编辑其 frontmatter 与 HTML 源码。
 */

const articles = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
    schema: articleSchema,
});

/**
 * 博客分类：由 02 阶段的 categories.json 迁移而来。
 * count=0 的分类（Customer Stories）源站是 noindex，需保留该行为。
 */
const blogCategories = defineCollection({
    loader: glob({ pattern: '**/*.json', base: './src/data/blog-categories' }),
    schema: blogCategorySchema,
});

/**
 * WordPress 页面。正文同样是清洗后的 HTML。
 * isListing 标记那些「主体为列表」的页（/blog/ /shop/ /products/ /news-and-media/），
 * 模板只把它们的正文当列表上方的引言区，列表本身仍由数据层生成。
 */
const pages = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
    schema: pageSchema,
});

export const collections = { articles, blogCategories, pages };
