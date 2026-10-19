/**
 * 结构取样：把 qf-faq-item / qf-author-box / qf-cta-box / qf-toc / qf-references
 * 这几类要单独处理的块各取一个真实样例打出来，供转换规则对照。
 *
 *   npx tsx scripts/migrate/inspect-blocks.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR } from './lib/config.ts';
import type { WpPost } from './lib/types.ts';
import * as cheerio from 'cheerio';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);

const SELECTORS = [
    '.qf-faq-item', '.qf-faq', '.qf-author-box', '.qf-cta-box', '.qf-toc',
    '.qf-references', '.qf-pros-cons', '.qf-proscons', '.qf-compare-table',
    '.qf-testimonial', '.qf-glossary', '.qf-table-wrap', '.qf-highlight-box',
];

for (const sel of SELECTORS) {
    let hit: { slug: string; html: string } | null = null;
    let count = 0;
    for (const p of posts) {
        const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
        const n = $(sel).length;
        count += n;
        if (!hit && n > 0) hit = { slug: p.slug, html: $(sel).first().toString().trim() };
    }
    console.log(`\n${'='.repeat(70)}\n${sel}  —— 全站出现 ${count} 次`);
    if (!hit) { console.log('  (未找到实例)'); continue; }
    console.log(`  样例文章: ${hit.slug}`);
    console.log(`  ${hit.html.slice(0, 900).replace(/\n\s*/g, '\n  ')}`);
}

// CTA 按钮的链接到底指向哪，判断是否全部替换成 WhatsApp
const ctaTargets = new Map<string, number>();
for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('[class*="qf-cta-btn"], [class*="cta-button"], .qf-btn').each((_, el) => {
        const h = $(el).attr('href') ?? '(no href)';
        ctaTargets.set(h, (ctaTargets.get(h) ?? 0) + 1);
    });
}
console.log(`\n${'='.repeat(70)}\nCTA 按钮链接目标分布`);
for (const [h, n] of [...ctaTargets].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  x${String(n).padStart(3)}  ${h}`);
}

// 空 alt 的图片数（无障碍 + 图片 SEO）
let noAlt = 0;
let imgTotal = 0;
for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('img').each((_, el) => {
        imgTotal += 1;
        const alt = ($(el).attr('alt') ?? '').trim();
        if (!alt) noAlt += 1;
    });
}
console.log(`\n图片 alt：共 ${imgTotal} 个 <img>，其中空 alt ${noAlt} 个`);
