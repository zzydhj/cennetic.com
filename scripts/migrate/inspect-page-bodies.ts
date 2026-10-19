/**
 * 页面正文可用性排查：REST 的 content.rendered 对哪些页面是空的。
 * 空正文意味着该页内容由主题/WooCommerce 模板渲染，不走 post_content，
 * _passthrough 方案对它无效，必须由 Astro 模板自己供给内容。
 *
 *   npx tsx scripts/migrate/inspect-page-bodies.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR } from './lib/config.ts';
import type { WpPost } from './lib/types.ts';

const pages = await readJson<WpPost[]>(join(API_CACHE_DIR, 'pages.json'), [] as WpPost[]);

console.log('slug                        content   excerpt  template  id     link');
console.log('-'.repeat(96));
for (const p of pages) {
    console.log(
        `${p.slug.padEnd(28)}${String(p.content?.rendered?.length ?? 0).padStart(7)} ` +
        `${String(p.excerpt?.rendered?.length ?? 0).padStart(8)} ${(p.template ?? '').padEnd(10)} ${String(p.id).padStart(5)}  ${p.link}`,
    );
}

const empty = pages.filter((p) => (p.content?.rendered ?? '').trim().length === 0);
console.log(`\n正文为空的页面 ${empty.length} 个：${empty.map((p) => p.slug).join(', ')}`);

// 空正文的页面，看它在 REST 里是否带 elementor 元数据
for (const p of empty) {
    const meta = (p as unknown as Record<string, unknown>).meta;
    console.log(`  ${p.slug}: meta=${JSON.stringify(meta ?? null).slice(0, 120)}`);
}
