/**
 * 从阶段 02 已缓存的首页 HTML 里提取真实导航与页脚链接。
 * 菜单必须来自实测，不能凭分类名推测 slug —— 猜错就是 404。
 *
 *   npx tsx scripts/migrate/inspect-nav.ts
 */
import { SRC_ORIGIN } from './lib/config.ts';
import { fetchText } from './lib/http.ts';
import { pathOf } from './lib/config.ts';
import * as cheerio from 'cheerio';

const html = await fetchText(`${SRC_ORIGIN}/`, { kind: 'page-html' });
if (!html) throw new Error('首页 HTML 缓存缺失，请先跑 npm run migrate -- 02');

const $ = cheerio.load(html);

console.log('=== header 内的链接 ===');
const seen = new Set<string>();
$('header a[href], nav a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('http')) return;
    const p = pathOf(new URL(href).pathname);
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    const key = `${p}|${label}`;
    if (seen.has(key) || !label) return;
    seen.add(key);
    console.log(`  ${p.padEnd(72)} ${label.slice(0, 46)}`);
});

console.log('\n=== footer 内的链接 ===');
const fseen = new Set<string>();
$('footer a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('http')) return;
    const p = pathOf(new URL(href).pathname);
    const label = $(el).text().replace(/\s+/g, ' ').trim();
    const key = `${p}|${label}`;
    if (fseen.has(key) || !label) return;
    fseen.add(key);
    console.log(`  ${p.padEnd(72)} ${label.slice(0, 46)}`);
});

console.log('\n=== 首页正文里的 product-category 链接（去重）===');
const pc = new Map<string, string>();
$('a[href*="product-category"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('http')) return;
    const p = pathOf(new URL(href).pathname);
    if (!pc.has(p)) pc.set(p, $(el).text().replace(/\s+/g, ' ').trim());
});
for (const [p, label] of [...pc].sort()) console.log(`  ${p.padEnd(78)} ${label.slice(0, 44)}`);

console.log('\n=== widget / 侧栏标题（判断分类命名）===');
$('.woodmart-widget, .widget, aside').find('a[href*="product-category"]').each((_, el) => {
    console.log(`  ${pathOf(new URL($(el).attr('href') ?? SRC_ORIGIN).pathname)}  ${$(el).text().trim()}`);
});
