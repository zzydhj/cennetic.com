/**
 * 图片体量实测：抽样读取源站被引用图片的真实尺寸与字节数。
 * 用来回答「全部先用原图，不做变体」的代价到底有多大。
 *
 *   npx tsx scripts/migrate/inspect-images.ts
 */
import { readJson, join } from './lib/fs.ts';
import { API_CACHE_DIR, SRC_ORIGIN, pathOf } from './lib/config.ts';
import type { WpPost, StoreProduct } from './lib/types.ts';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const posts = await readJson<WpPost[]>(join(API_CACHE_DIR, 'posts.json'), [] as WpPost[]);
const products = await readJson<StoreProduct[]>(join(API_CACHE_DIR, 'products.json'), [] as StoreProduct[]);

// 收集正文里真正被引用的图片路径
const referenced = new Set<string>();
for (const p of posts) {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src) referenced.add(pathOf(new URL(src, SRC_ORIGIN).pathname));
    });
}
for (const pr of products) {
    for (const im of pr.images) referenced.add(pathOf(new URL(im.src, SRC_ORIGIN).pathname));
}

console.log(`文章+产品实际引用的唯一图片数：${referenced.size}`);

// 抽样下载并测量
const paths = [...referenced];
const stepN = Math.max(1, Math.floor(paths.length / 45));
const sample = paths.filter((_, i) => i % stepN === 0).slice(0, 45);
console.log(`抽样 ${sample.length} 张进行测量\n`);

type Row = { path: string; bytes: number; w: number; h: number; ext: string };
const rows: Row[] = [];

for (const p of sample) {
    try {
        const res = await fetch(`${SRC_ORIGIN}${p}`);
        if (!res.ok) { console.log(`  跳过 ${res.status} ${p}`); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(buf).metadata();
        rows.push({
            path: p,
            bytes: buf.length,
            w: meta.width ?? 0,
            h: meta.height ?? 0,
            ext: meta.format ?? '?',
        });
    } catch (e) {
        console.log(`  失败 ${p}: ${(e as Error).message}`);
    }
}

rows.sort((a, b) => b.bytes - a.bytes);

const kb = (n: number) => (n / 1024).toFixed(1);
console.log('=== 抽样明细（按体积降序，前 20）===');
for (const r of rows.slice(0, 20)) {
    console.log(`  ${kb(r.bytes).padStart(8)} KB  ${String(r.w).padStart(5)}x${String(r.h).padEnd(5)} ${r.ext.padEnd(5)} ${r.path.slice(-58)}`);
}

const total = rows.reduce((s, r) => s + r.bytes, 0);
const widths = rows.map((r) => r.w).sort((a, b) => a - b);
console.log('\n=== 汇总 ===');
console.log(`  样本数        : ${rows.length}`);
console.log(`  平均体积      : ${kb(total / Math.max(rows.length, 1))} KB`);
console.log(`  中位数体积    : ${kb(rows[Math.floor(rows.length / 2)]?.bytes ?? 0)} KB`);
console.log(`  最大体积      : ${kb(rows[0]?.bytes ?? 0)} KB`);
console.log(`  宽度中位数    : ${widths[Math.floor(widths.length / 2)] ?? '?'} px`);
console.log(`  宽度 >=1600px : ${widths.filter((w) => w >= 1600).length} 张`);
console.log(`  宽度 <=900px  : ${widths.filter((w) => w <= 900).length} 张`);
console.log(`  >150KB 的张数 : ${rows.filter((r) => r.bytes > 150 * 1024).length}`);

// 推算全站：一篇文章通常几张图，按页面图片数估算传输量
const imgsPerPage = posts.reduce((s, p) => {
    const $ = cheerio.load(`<div>${p.content.rendered}</div>`);
    return s + $('img').length;
}, 0) / Math.max(posts.length, 1);
const avgBytes = total / Math.max(rows.length, 1);
console.log(`\n  平均每篇文章图片数：${imgsPerPage.toFixed(1)}`);
console.log(`  → 一篇文章仅图片传输量估算：${kb(imgsPerPage * avgBytes)} KB（不做变体的代价）`);
