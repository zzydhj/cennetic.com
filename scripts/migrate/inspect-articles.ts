/**
 * 内容结构探查：在写转换规则之前先摸清文章正文到底由哪些元素、类名、图片形态构成。
 * 目的是让 03-articles 的 turndown 规则基于实测而不是猜测。
 *
 *   npx tsx scripts/migrate/inspect-articles.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR, SRC_ORIGIN, pathOf, isSiteHost } from './lib/config.ts';
import type { WpPost } from './lib/types.ts';
import * as cheerio from 'cheerio';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);
console.log(`文章数：${posts.length}\n`);

// ── 标签频率（全站汇总）────────────────────────────────────────
const tagCount = new Map<string, number>();
const classCount = new Map<string, number>();
let styleTotal = 0;
let styleMax = 0;
let withStyle = 0;
let withH1 = 0;
const imgHosts = new Map<string, number>();
const imgExts = new Map<string, number>();
let srcsetCount = 0;
let lazyCount = 0;
let iframeCount = 0;
let tableCount = 0;

for (const p of posts) {
    const html = p.content.rendered;
    const $ = cheerio.load(`<div id="root">${html}</div>`);

    const styles = $('#root style');
    if (styles.length > 0) {
        withStyle += 1;
        const len = styles.text().length;
        styleTotal += len;
        styleMax = Math.max(styleMax, len);
    }
    if ($('#root h1').length > 0) withH1 += 1;

    $('#root *').each((_, el) => {
        const t = (el as { tagName?: string }).tagName?.toLowerCase();
        if (!t) return;
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
        for (const c of ($(el).attr('class') || '').split(/\s+/).filter(Boolean)) {
            classCount.set(c, (classCount.get(c) ?? 0) + 1);
        }
    });

    $('#root img').each((_, el) => {
        const src = $(el).attr('src') || '';
        if ($(el).attr('srcset') || $(el).attr('sizes')) srcsetCount += 1;
        if (($($(el).attr('loading')).length && $(el).attr('loading') !== 'eager')) lazyCount += 1;
        try {
            const u = new URL(src.startsWith('http') ? src : `${SRC_ORIGIN}${src}`);
            imgHosts.set(u.host, (imgHosts.get(u.host) ?? 0) + 1);
            const ext = (u.pathname.match(/\.\w+$/) ?? ['.'])[0]!;
            imgExts.set(ext, (imgExts.get(ext) ?? 0) + 1);
        } catch {
            imgHosts.set(`<unparseable> ${src.slice(0, 40)}`, (imgHosts.get('<unparseable>') ?? 0) + 1);
        }
    });

    iframeCount += $('#root iframe').length;
    tableCount += $('#root table').length;
}

const top = (m: Map<string, number>, n = 30) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

console.log('=== 标签频率 ===');
console.log(top(tagCount, 40).map(([k, v]) => `${k}:${v}`).join('  '));

console.log('\n=== 高频类名（出现 >= 3 次）===');
console.log(
    top(classCount, 60)
        .filter(([, v]) => v >= 3)
        .map(([k, v]) => `${k}(${v})`)
        .join(', '),
);

console.log('\n=== 内联 <style> ===');
console.log(`  含 style 的文章：${withStyle}/${posts.length}`);
console.log(`  平均字节：${Math.round(styleTotal / posts.length)}  最大：${styleMax}  总计：${styleTotal}`);

console.log('\n=== H1（正文内）===');
console.log(`  含正文 H1 的文章：${withH1}/${posts.length}  —— 若 >0 则与新模板的 H1 冲突，需降级处理`);

console.log('\n=== 图片 ===');
console.log(`  带 srcset/sizes：${srcsetCount}   带 lazy：${lazyCount}   iframe：${iframeCount}   table：${tableCount}`);
console.log('  host 分布：', top(imgHosts, 10).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('  扩展名分布：', top(imgExts, 10).map(([k, v]) => `${k}:${v}`).join('  '));

// ── 一篇典型文章的骨架 ────────────────────────────────────────
console.log('\n=== 典型文章正文骨架（第 1 篇，style 已剔除）===');
const sample = cheerio.load(`<div id="root">${posts[0].content.rendered}</div>`);
sample('#root style').remove();
const outline: string[] = [];
sample('#root > *, #root h2, #root h3').each((_, el) => {
    const t = (el as { tagName?: string }).tagName?.toLowerCase() ?? '?';
    const cls = (sample(el).attr('class') || '').slice(0, 40);
    const txt = sample(el).text().trim().slice(0, 48).replace(/\s+/g, ' ');
    outline.push(`  <${t}${cls ? ` class="${cls}"` : ''}> ${txt}`);
});
console.log(outline.slice(0, 40).join('\n'));

// ── 内链目标分布：判断哪些是站内链接需要重映射 ──────────────────
const linkPaths = new Map<string, number>();
for (const p of posts) {
    const $ = cheerio.load(`<div id="root">${p.content.rendered}</div>`);
    $('#root a[href]').each((_, el) => {
        const href = $(el).attr('href')!;
        if (!href.startsWith('http')) return;
        const u = new URL(href);
        if (!isSiteHost(u.host)) return;
        linkPaths.set(pathOf(u.pathname), (linkPaths.get(pathOf(u.pathname)) ?? 0) + 1);
    });
}
console.log(`\n=== 文章正文中的站内链接（唯一目标 ${linkPaths.size} 个）===`);
console.log(top(linkPaths, 20).map(([k, v]) => `${k}(${v})`).join('  '));
