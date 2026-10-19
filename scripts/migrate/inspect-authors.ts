/**
 * 作者框写法取样：抽出所有 .qf-author-box 的 h3/h4 原文，按出现频次排序。
 * 目的是看清真人是怎么写的，再决定归一规则 —— 而不是拿一条正则去猜 113 篇。
 *
 *   npx tsx scripts/migrate/inspect-authors.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR } from './lib/config.ts';
import type { WpPost } from './lib/types.ts';
import * as cheerio from 'cheerio';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);

const headings = new Map<string, number>();
const bios = new Map<string, number>();
const shapes = new Map<string, number>();
let boxes = 0;

for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('.qf-author-box').each((_, el) => {
        boxes += 1;
        const $b = $(el);
        const h = $b.find('h1,h2,h3,h4,h5,h6').first();
        const hText = h.text().replace(/\s+/g, ' ').trim();
        headings.set(hText.slice(0, 140), (headings.get(hText.slice(0, 140)) ?? 0) + 1);

        const pText = $b.children('p').first().text().replace(/\s+/g, ' ').trim();
        bios.set(`${pText.slice(0, 60)}…(${pText.length}字)`, (bios.get(`${pText.slice(0, 60)}…(${pText.length}字)`) ?? 0) + 1);

        const tags = $b.children().toArray().map((c) => (c as { tagName?: string }).tagName?.toLowerCase());
        shapes.set(tags.join('>'), (shapes.get(tags.join('>')) ?? 0) + 1);
    });
}

console.log(`作者框总数：${boxes}（文章 ${posts.length} 篇）\n`);

console.log('=== 标题写法分布 ===');
for (const [t, n] of [...headings].sort((a, b) => b[1] - a[1])) console.log(`  x${String(n).padStart(3)}  ${t}`);

console.log('\n=== 内部结构形态 ===');
for (const [s, n] of [...shapes].sort((a, b) => b[1] - a[1])) console.log(`  x${String(n).padStart(3)}  ${s}`);

console.log('\n=== 简介前 60 字分布（前 20）===');
for (const [t, n] of [...bios].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  x${String(n).padStart(3)}  ${t}`);
