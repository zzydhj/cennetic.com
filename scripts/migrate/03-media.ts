/**
 * Phase 0-3 · 收集并下载真正被引用的图片，测出真实尺寸，产出 media-manifest.json。
 *
 * 为什么必须测尺寸而不是假设：抽样 45 张源图确实全是 1200x686 WebP，
 * 但正文里也混有图标、logo、旧文章残留，一律按 1200x686 写死会引入 CLS。
 * 逐张读出的宽高会写进正文 <img>，这是防布局位移，不属于"缩略图优化"范畴。
 *
 * 产物：media-staging/<YYYY>/<MM>/<file>   原图（暂存，后续整目录推 R2）
 *      media-staging/media-manifest.json  路径与尺寸索引
 *
 * 决策记录：源图本身已是统一 1200px WebP（中位 42KB），生成多尺寸变体的收益
 * 远小于其带来的对象数与维护分叉，故现阶段不做变体，mediaUrl() 直接返回原图。
 */
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { API_CACHE_DIR, SRC_ORIGIN, pathOf } from './lib/config.ts';
import { downloadTo } from './lib/http.ts';
import { writeJson, readJson, join, rel, log, step } from './lib/fs.ts';
import {
    STAGING_DIR,
    MANIFEST_FILE,
    keyFromSrcPath,
    publicPathFromKey,
    type MediaEntry,
    type MediaManifest,
} from './lib/images.ts';

const MIME_BY_EXT: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
};

/** 从文章 / 页面 / 产品正文里收集所有 <img> 与背景图引用 */
async function collectRefs(): Promise<Set<string>> {
    const found = new Set<string>();

    const push = (raw: string | undefined | null) => {
        if (!raw) return;
        // data-src / srcset 里可能带空格分隔的多候选，取第一个
        const first = raw.trim().split(/\s+/)[0]!;
        if (first.startsWith('data:')) return;
        let p: string;
        try {
            p = pathOf(new URL(first, SRC_ORIGIN).pathname);
        } catch {
            return;
        }
        if (!p.startsWith('/wp-content/uploads/')) return;
        found.add(decodeURIComponent(p));
    };

    const scanHtml = (html: string) => {
        const $ = cheerio.load(`<div>${html}</div>`);
        $('img').each((_, el) => {
            push($(el).attr('src'));
            push($(el).attr('data-src'));
            const ss = $(el).attr('srcset');
            if (ss) for (const cand of ss.split(',')) push(cand.trim().split(/\s+/)[0]);
        });
        // Elementor 背景图写在 style="background-image:url(...)"
        $('[style*="background-image"]').each((_, el) => {
            const m = ($(el).attr('style') ?? '').match(/url\(["']?([^"')]+)["']?\)/);
            if (m) push(m[1]);
        });
    };

    const posts = await readJson<{ content: { rendered: string } }[]>(join(API_CACHE_DIR, 'posts.json'), []);
    const pages = await readJson<{ content: { rendered: string } }[]>(join(API_CACHE_DIR, 'pages.json'), []);
    const products = await readJson<{
        images: { src: string }[];
        description?: string;
        short_description?: string;
    }[]>(join(API_CACHE_DIR, 'products.json'), []);

    for (const p of posts) scanHtml(p.content.rendered);
    for (const p of pages) scanHtml(p.content.rendered);

    // 产品不能只扫 images 数组：description / short_description 的 HTML 里同样有配图，
    // 漏扫会让产品详情页正文图集体破图（实测 v-856-vmc-main.webp 就是这么漏的）。
    for (const pr of products) {
        for (const im of pr.images) push(im.src);
        scanHtml(pr.description ?? '');
        scanHtml(pr.short_description ?? '');
    }

    return found;
}

/** 读一张图的真实宽高；SVG 走 metadata，拿不到 viewBox 时记 0 由模板兜底 */
async function measure(buf: Buffer, ext: string): Promise<{ w: number; h: number }> {
    if (ext === '.svg') {
        const text = buf.toString('utf8');
        const wh = text.match(/\swidth="(\d+(?:\.\d+)?)"[\s\S]*?\sheight="(\d+(?:\.\d+)?)"/);
        if (wh) return { w: Math.round(Number(wh[1])), h: Math.round(Number(wh[2])) };
        const vb = text.match(/viewBox="[\d.\s-]+?([\d.]+)\s+([\d.]+)"/);
        if (vb) return { w: Math.round(Number(vb[1])), h: Math.round(Number(vb[2])) };
        return { w: 0, h: 0 };
    }
    try {
        const meta = await sharp(buf).metadata();
        return { w: meta.width ?? 0, h: meta.height ?? 0 };
    } catch {
        return { w: 0, h: 0 };
    }
}

export async function buildMedia(refresh = false): Promise<void> {
    step('Phase 0-3 · 下载被引用的图片并测量尺寸');

    const refs = await collectRefs();
    log(`  正文 / 页面 / 产品共引用唯一图片 ${refs.size} 张`);

    const entries: MediaEntry[] = [];
    let failed = 0;
    let n = 0;

    for (const srcPath of [...refs].sort()) {
        n += 1;
        const key = keyFromSrcPath(srcPath);
        const localFile = join(STAGING_DIR, key);
        const ext = (srcPath.match(/\.\w+$/) ?? ['.'])[0]!.toLowerCase();

        if (existsSync(localFile) && !refresh) {
            const { readFile } = await import('node:fs/promises');
            const buf = await readFile(localFile);
            const { w, h } = await measure(buf, ext);
            entries.push({
                srcPath, key, publicPath: publicPathFromKey(key), localFile,
                width: w, height: h, bytes: buf.length,
                mime: MIME_BY_EXT[ext] ?? 'application/octet-stream', ok: true,
            });
            continue;
        }

        const { bytes, status } = await downloadTo(`${SRC_ORIGIN}${srcPath}`, localFile, { refresh });

        if (!bytes) {
            failed += 1;
            entries.push({
                srcPath, key, publicPath: publicPathFromKey(key), localFile,
                width: 0, height: 0, bytes: 0, mime: MIME_BY_EXT[ext] ?? '', ok: false,
                note: `源站返回 ${status}`,
            });
            log(`  ! 缺失 ${srcPath} (HTTP ${status})`);
            continue;
        }

        const { w, h } = await measure(bytes, ext);
        entries.push({
            srcPath, key, publicPath: publicPathFromKey(key), localFile,
            width: w, height: h, bytes: bytes.length,
            mime: MIME_BY_EXT[ext] ?? 'application/octet-stream',
            ok: true,
            ...(w === 0 || h === 0 ? { note: '未能读出尺寸，模板需兜底' } : {}),
        });

        if (n % 50 === 0) log(`  ${n}/${refs.size}`);
    }

    entries.sort((a, b) => a.srcPath.localeCompare(b.srcPath));

    const manifest: MediaManifest = {
        generatedAt: new Date().toISOString(),
        uploadsPrefix: '/wp-content/uploads/',
        baseUrl: '/images',
        total: entries.length,
        failed,
        images: entries,
    };

    await writeJson(MANIFEST_FILE, manifest);

    const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
    const noDim = entries.filter((e) => e.ok && (e.width === 0 || e.height === 0));
    log('');
    log(`✓ 图片落库 ${entries.length} 张，失败 ${failed} 张，合计 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
    log(`  暂存目录：${rel(STAGING_DIR)}（不入库，后续整目录推 R2）`);
    log(`  清单：${rel(MANIFEST_FILE)}`);
    if (noDim.length > 0) {
        log(`  ⚠ ${noDim.length} 张读不出宽高，写 <img> 时需要模板兜底：`);
        for (const e of noDim.slice(0, 15)) log(`      ${e.srcPath}`);
    }
}
