import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema, blogCategorySchema } from './lib/content-schema';

/**
 * 内容集合定义。字段契约的唯一真相在 ./lib/content-schema.ts（与灌库/快照/后台共用），
 * 这里只负责把 schema 绑定到具体 loader。
 *
 * 文章正文在迁移时保留了干净 HTML（而非 Markdown），原因见 04-articles 顶部说明：
 * 正文含 143 个表格与大量 qf-* 组件类名，Markdown 往返会丢类名。
 * 因此模板侧用 entry.body 取原始 HTML 直接渲染，不走 Markdown 编译。
 * 文件仍是 .md，后台可以正常编辑其 frontmatter 与 HTML 源码。
 *
 * 没有 pages 集合：后台的「页面」类型已整体取消（模板结构一直在代码里，那一类行能改的
 * 只有几行 meta，其中两行前台根本不读）。列表页与首页文案内联在各模板，公司与政策页走
 * src/content/locked/*.md + src/lib/locked-page.ts，都不经过这里。
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

export const collections = { articles, blogCategories };
