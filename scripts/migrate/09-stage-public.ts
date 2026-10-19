/**
 * Phase 5 · 把图片同步到 public/images，供 Pages 托管。
 *
 * 两个来源，后者叠加在前者之上：
 *
 *   media-staging/  WordPress 原图（由 03 抓取，不入 Git）
 *   site-assets/    人工产物（不入源站、也不能重新抓取，**必须入 Git**）
 *
 * 同步目标 public/images/ **现在是入 Git 的正式内容**，不是可随意重建的中间产物：
 * 裸 clone 就要能直接构建出带图的站点，而不是依赖源站在线。因此本阶段只在
 * 显式运行（npm run stage:media）时工作，缺 media-staging 则直接中止，
 * 避免孤儿清理把仓库里的图删掉。
 *
 * 为什么要单独分一层：首屏背景视频的 poster 与压缩版 mp4 是我用 ffmpeg 从源站
 * 10.38MB 原片转出来的，它不是 WordPress 媒体库里的东西，prebuild 重跑抓不回来；
 * 而 media-staging/ 与 public/images/ 都在 .gitignore 里。不单独存一份进仓库，
 * 裸 clone 就永远得不到这两个文件 —— 首页会没背景视频。
 *
 * 这是**切到 Cloudflare R2 之前**的临时链路：图片随构建产物一起发边缘节点。
 * 定案是原图存 R2、经 media.qfcncmachine.com 访问，届时本阶段退役，
 * 只需把图片 URL 出口（scripts/migrate/lib/images.ts 的 publicPathFromKey）
 * 改成指向 R2 域名，业务代码不用动。
 *
 * 同步是幂等的：只复制比目标新的文件，删掉源里已不存在的孤儿文件，
 * 所以重跑不会把 public/images 变成垃圾堆积场。
 */
import { cp, readdir, rm, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib/config.ts';
import { STAGING_DIR } from './lib/images.ts';
import { rel, log, step } from './lib/fs.ts';

const PUBLIC_IMAGES = join(ROOT, 'public/images');
const SITE_ASSETS = join(ROOT, 'site-assets');
const MANIFEST_NAME = 'media-manifest.json';

/** 递归列出目录下所有文件的相对路径 */
async function listFiles(dir: string, base = dir): Promise<string[]> {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const name of await readdir(dir)) {
        const p = join(dir, name);
        const s = await stat(p);
        if (s.isDirectory()) out.push(...(await listFiles(p, base)));
        else out.push(relative(base, p).replace(/\\/g, '/'));
    }
    return out;
}

export async function stagePublicImages(): Promise<void> {
    step('Phase 5 · 同步图片到 public/images');

    // public/images 现在是入 Git 的正式内容，不再是可重建的中间产物。
    // 少了 media-staging 就绝不能跑下面的孤儿清理：那样 source 只剩 site-assets
    // 两项，其余 467 张图全会被当成孤儿删掉，一次误操作就把仓库里的图清空。
    const stagingPresent = existsSync(STAGING_DIR);
    if (!stagingPresent) {
        throw new Error(
            `缺少 ${rel(STAGING_DIR)}，中止。public/images 已随仓库提交，` +
                `此时做孤儿清理会把它们误删。如确需重抓：npm run migrate -- 03`,
        );
    }

    await mkdir(PUBLIC_IMAGES, { recursive: true });

    /** 单个来源目录 → public/images 下的相对路径列表 */
    const sourceFiles = (dir: string) =>
        existsSync(dir)
            ? listFiles(dir).then((l) => l.filter((f) => f !== MANIFEST_NAME))
            : Promise.resolve<string[]>([]);

    const staged = await sourceFiles(STAGING_DIR);
    const site = await sourceFiles(SITE_ASSETS);

    // 叠加：site-assets 优先，同路径时盖掉抓下来的版本
    const byPath = new Map<string, string>();
    for (const f of staged) byPath.set(f, join(STAGING_DIR, f));
    for (const f of site) byPath.set(f, join(SITE_ASSETS, f));

    const source = [...byPath.keys()].sort();
    const target = await listFiles(PUBLIC_IMAGES);

    let copied = 0;
    let skipped = 0;

    for (const f of source) {
        const from = byPath.get(f)!;
        const to = join(PUBLIC_IMAGES, f);
        // 大小相同即视为已同步：图片内容寻址，不做逐字节比对以省下几百 MB 的读
        const [a, b] = await Promise.all([stat(from), existsSync(to) ? stat(to) : null]);
        if (b && b.size === a.size) {
            skipped += 1;
            continue;
        }
        await mkdir(join(to, '..'), { recursive: true });
        await cp(from, to);
        copied += 1;
    }

    // 清掉源里已不存在的孤儿文件，避免旧图长期留在产物里
    const keep = new Set(source);
    const orphans = target.filter((f) => !keep.has(f));
    for (const f of orphans) await rm(join(PUBLIC_IMAGES, f), { force: true });

    const bytes = (await Promise.all(source.map((f) => stat(join(PUBLIC_IMAGES, f)))))
        .reduce((s, x) => s + x.size, 0);

    log('');
    log(`✓ public/images 就绪：${source.length} 个文件，合计 ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    log(`    来源 WordPress 原图 ${staged.length} + 人工产物 ${site.length}（site-assets）`);
    log(`    新复制 ${copied}，已存在跳过 ${skipped}，清理孤儿 ${orphans.length}`);
    log(`  注：这是切换到 Cloudflare R2 之前的临时托管方式`);
}
