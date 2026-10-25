/**
 * 决定性验证两件事，再动手写转换规则：
 *   1. 那 340KB 内联 CSS 到底是「一份重复 106 遍」还是「有好几个变体」
 *      —— 决定 article.css 要拆成几份，以及 frontmatter 需不需要 template 字段
 *   2. 文章正文里的内链目标是否真实存在
 *      —— 实测发现 /blog/<slug>/ 形态的链接，但文章实际挂在顶级 /<slug>/
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR, SRC_ORIGIN, isSiteHost } from './lib/config.ts';
import { headStatus } from './lib/http.ts';
import type { WpPost } from './lib/types.ts';
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);

// ── 1. style 变体归并 ─────────────────────────────────────────
console.log('=== 内联 CSS 变体分析 ===');

const variants = new Map<string, { hash: string; bytes: number; posts: string[]; preview: string }>();
let noStyle = 0;

for (const p of posts) {
    const $ = cheerio.load(`<div id="root">${p.content.rendered}</div>`);
    const styles = $('#root style');
    if (styles.length === 0) {
        noStyle += 1;
        continue;
    }
    // 选择器集合归一化后做指纹：忽略顺序与空白差异
    const css = styles.text();
    const selectors = (css.match(/(^|\})\s*([^{}@][^{}]*)\{/gm) ?? [])
        .map((s) => s.replace(/^[}\s]*/, '').replace(/\{$/, '').trim())
        .filter(Boolean)
        .sort()
        .join(',');
    const hash = createHash('sha1').update(selectors).digest('hex').slice(0, 10);

    if (!variants.has(hash)) {
        variants.set(hash, { hash, bytes: css.length, posts: [], preview: css.slice(0, 160) });
    }
    const v = variants.get(hash)!;
    v.posts.push(p.slug);
}

console.log(`  无内联 style 的文章：${noStyle}`);
console.log(`  按选择器指纹归并后：${variants.size} 个变体\n`);

for (const v of [...variants.values()].sort((a, b) => b.posts.length - a.posts.length)) {
    console.log(`  [${v.hash}] 覆盖 ${v.posts.length} 篇  ~${v.bytes}B`);
    console.log(`      ${v.preview.replace(/\s+/g, ' ').slice(0, 120)}`);
    if (v.posts.length <= 4) console.log(`      slugs: ${v.posts.join(', ')}`);
    console.log('');
}

// ── 正文外层容器统计 ──────────────────────────────────────────
const wrappers = new Map<string, number>();
for (const p of posts) {
    const $ = cheerio.load(`<div id="root">${p.content.rendered}</div>`);
    const first = $('#root > div').first();
    wrappers.set(first.attr('class') ?? '(none)', (wrappers.get(first.attr('class') ?? '(none)') ?? 0) + 1);
}
console.log('=== 正文最外层 div 的 class ===');
for (const [k, v] of [...wrappers].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
}

// ── 2. 内链目标真实状态 ───────────────────────────────────────
console.log('\n=== 文章正文内链目标状态实测 ===');
const targets = new Map<string, number>();
for (const p of posts) {
    const $ = cheerio.load(`<div id="root">${p.content.rendered}</div>`);
    $('#root a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        if (!href.startsWith('http')) return;
        try {
            const u = new URL(href);
            if (!isSiteHost(u.host)) return;
            targets.set(u.pathname, (targets.get(u.pathname) ?? 0) + 1);
        } catch { /* 相对链接另计 */ }
    });
}

const sorted = [...targets].sort((a, b) => b[1] - a[1]);
let broken = 0;
for (const [path, n] of sorted.slice(0, 28)) {
    const status = await headStatus(`${SRC_ORIGIN}${path}`);
    const flag = status === 200 ? 'ok  ' : 'BROKEN';
    if (status !== 200) broken += 1;
    console.log(`  ${flag} ${String(status).padStart(3)}  x${String(n).padStart(3)}  ${path}`);
}
console.log(`\n  抽样 ${Math.min(28, sorted.length)} 个目标中，非 200 的有 ${broken} 个`);
