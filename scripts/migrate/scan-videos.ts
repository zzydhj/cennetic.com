/**
 * 视频资源穷尽扫描：确认源站到底有几个视频、有没有第三方嵌入被漏掉。
 *
 * 背景：源站的背景视频是 Elementor section 配置 + JS 注入，静态抓取时 <video> 标签
 * 是空的，只看 DOM 会漏。所以必须同时扫：视频文件后缀、<video>/<iframe> 标签、
 * 第三方视频平台域名、以及 Elementor 的 background_video_link 配置。
 *
 *   npx tsx scripts/migrate/scan-videos.ts
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, ROOT } from './lib/config.ts';

const PATTERNS: Array<{ label: string; re: RegExp }> = [
    { label: '视频文件', re: /[^"'()\s\\<>]*\.(?:mp4|webm|ogv|mov|m4v)/gi },
    { label: '<video> 标签', re: /<video\b[^>]*>/gi },
    { label: '<iframe> 标签', re: /<iframe\b[^>]*>/gi },
    { label: 'Elementor 背景视频配置', re: /background_video_link[^,}]{0,160}/gi },
    { label: 'YouTube', re: /(?:youtube\.com|youtu\.be)\/[^\s"'<>\\]{0,60}/gi },
    { label: 'Vimeo', re: /vimeo\.com\/[^\s"'<>\\]{0,40}/gi },
    { label: 'Bilibili', re: /player\.bilibili\.com[^\s"'<>\\]{0,40}/gi },
];

async function htmlFiles(): Promise<Array<{ name: string; text: string }>> {
    const dir = join(CACHE_DIR, 'page-html');
    const names = await readdir(dir);
    const out: Array<{ name: string; text: string }> = [];

    for (const n of names) {
        const raw = await readFile(join(dir, n), 'utf8');
        // 缓存里存的是整页 HTML 原文（可能被 JSON 引号转义），统一还原便于匹配
        let text = raw;
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'string') text = parsed;
        } catch {
            /* 直接是文本 */
        }
        out.push({ name: n, text });
    }
    return out;
}

const files = await htmlFiles();
console.log(`扫描 ${files.length} 个已缓存页面\n`);

const totals = new Map<string, Set<string>>();

for (const { label, re } of PATTERNS) {
    const hits = new Map<string, string[]>(); // value -> pages
    for (const f of files) {
        for (const m of f.text.matchAll(re)) {
            const v = m[0].replace(/&quot;/g, '"').replace(/\\\//g, '/').trim();
            if (!hits.has(v)) hits.set(v, []);
            hits.get(v)!.push(f.name.slice(0, 8));
        }
    }
    if (!totals.has(label)) totals.set(label, new Set());
    for (const k of hits.keys()) totals.get(label)!.add(k);

    console.log(`── ${label}：${hits.size} 个唯一值`);
    for (const [v, pages] of [...hits].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
        const shown = v.length > 96 ? `${v.slice(0, 96)}…` : v;
        console.log(`   x${String(pages.length).padStart(3)}  ${shown}`);
    }
    if (hits.size > 12) console.log(`   … 其余 ${hits.size - 12} 个`);
    console.log('');
}

// 迁移后的内容里是否还残留源站绝对视频地址（应该全部被本地化或剔除）
console.log('=== 迁移产物中的视频残留 ===');
for (const dir of ['src/content', 'src/data']) {
    const abs = join(ROOT, dir);
    const names = await readdir(abs, { recursive: true }).then((l) =>
        l.map(String).filter((f) => /\.(md|json)$/.test(f)),
    );
    let n = 0;
    for (const rel of names) {
        const text = await readFile(join(abs, rel), 'utf8');
        const hits = text.match(/[\w./-]*\.(?:mp4|webm)|youtube\.com|youtu\.be|vimeo\.com/gi) ?? [];
        if (hits.length > 0) {
            n += 1;
            console.log(`  ${dir}/${rel}`);
            console.log(`     ${[...new Set(hits)].slice(0, 6).join(' | ')}`);
        }
    }
    if (n === 0) console.log(`  ${dir}/ — 干净，无视频残留`);
}
