/**
 * 打印 59 个「标题为空」作者框的真实 markup，以及若干非空的对照。
 * 只想知道名字到底写在哪个元素里。
 *
 *   npx tsx scripts/migrate/inspect-author-raw.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR } from './lib/config.ts';
import type { WpPost } from './lib/types.ts';
import * as cheerio from 'cheerio';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);

let shownEmpty = 0;
let shownFilled = 0;

for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('.qf-author-box').each((_, el) => {
        const $b = $(el);
        const hText = $b.find('h1,h2,h3,h4,h5,h6').first().text().trim();
        const isEmpty = hText === '';

        if (isEmpty && shownEmpty < 2) {
            shownEmpty += 1;
            console.log(`\n${'='.repeat(72)}\n[空标题 ${shownEmpty}] slug=${p.slug}`);
            console.log($b.toString().trim().slice(0, 1400));
        }
        if (!isEmpty && shownFilled < 1) {
            shownFilled += 1;
            console.log(`\n${'='.repeat(72)}\n[有标题] slug=${p.slug}`);
            console.log($b.toString().trim().slice(0, 1000));
        }
    });
    if (shownEmpty >= 2 && shownFilled >= 1) break;
}

// 空标题框里，内层 info div 的第一个非空子元素是什么
console.log(`\n${'='.repeat(72)}\n[空标题] info div 首个子元素形态统计`);
const shapes = new Map<string, number>();
for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('.qf-author-box').each((_, el) => {
        const $b = $(el);
        if ($b.find('h1,h2,h3,h4,h5,h6').first().text().trim() !== '') return;
        const info = $b.find('[class*="author-info"], [class*="author-name"], div').eq(1);
        const first = info.children().first();
        const tag = (first.get(0) as { tagName?: string } | undefined)?.tagName?.toLowerCase() ?? '(none)';
        const cls = first.attr('class') ?? '';
        shapes.set(`<${tag} class="${cls}"> ${first.text().trim().slice(0, 40)}`, (shapes.get(`<${tag} class="${cls}"> ${first.text().trim().slice(0, 40)}`) ?? 0) + 1);
    });
}
for (const [s, n] of [...shapes].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  x${String(n).padStart(3)}  ${s}`);
