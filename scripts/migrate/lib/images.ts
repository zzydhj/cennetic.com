/**
 * 图片注册表：源站图片路径 → 新站 key / 公开路径 / 真实尺寸。
 *
 * 全站图片只有一个出口 mediaUrl()，将来要加 Cloudflare 按需变形，
 * 只需给它加一个可选 width 参数，业务侧代码一行都不用改。
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from './fs.ts';
import { ROOT } from './config.ts';

export interface MediaEntry {
    /** 源站绝对路径，如 /wp-content/uploads/2026/06/foo.webp */
    srcPath: string;
    /** 存储 key（相对 uploads 根），如 2026/06/foo.webp */
    key: string;
    /** 站点公开路径，如 /images/2026/06/foo.webp */
    publicPath: string;
    /** media-staging 下的本地文件绝对路径 */
    localFile: string;
    width: number;
    height: number;
    bytes: number;
    mime: string;
    /** 源站 404 或读取失败时标记，正文里据此决定是否保留该图 */
    ok: boolean;
    note?: string;
}

export interface MediaManifest {
    generatedAt: string;
    /** uploads 根前缀，便于以后整仓切到 R2 */
    uploadsPrefix: string;
    /** 对外基址；上线 R2 后改为 https://media.cennetic.com */
    baseUrl: string;
    total: number;
    failed: number;
    images: MediaEntry[];
}

export const STAGING_DIR = join(ROOT, 'media-staging');
export const MANIFEST_FILE = join(STAGING_DIR, 'media-manifest.json');

const UPLOADS_PREFIX = '/wp-content/uploads/';

/** 从 uploads 绝对路径推出存储 key */
export function keyFromSrcPath(srcPath: string): string {
    const idx = srcPath.indexOf(UPLOADS_PREFIX);
    return idx === -1 ? srcPath.replace(/^\//, '') : srcPath.slice(idx + UPLOADS_PREFIX.length);
}

/** 由 key 得出站点公开路径 */
export function publicPathFromKey(key: string): string {
    return `/images/${key.replace(/^\/+/, '')}`;
}

/** 读 manifest，建立 srcPath → entry 的索引 */
export async function loadMediaIndex(): Promise<Map<string, MediaEntry>> {
    if (!existsSync(MANIFEST_FILE)) {
        throw new Error(`缺少 ${MANIFEST_FILE}，请先执行：npm run migrate -- 03`);
    }
    const m = JSON.parse(await readFile(MANIFEST_FILE, 'utf8')) as MediaManifest;
    const index = new Map<string, MediaEntry>();
    for (const img of m.images) {
        index.set(img.srcPath, img);
        // WP 有时用相对 uploads、有时用绝对 URL，两种都指向同一条目
        index.set(img.key, img);
    }
    return index;
}

/** 查图；查不到返回 undefined，由调用方决定降级策略 */
export function lookup(index: Map<string, MediaEntry>, srcPath: string): MediaEntry | undefined {
    const clean = srcPath.split('?')[0].split('#')[0];
    return index.get(clean) ?? index.get(keyFromSrcPath(clean));
}

/**
 * 全站唯一的图片 URL 出口。
 * 现阶段返回原图公开路径；将来接 Cloudflare transformations 时在此加 width/format 参数。
 */
export function mediaUrl(entry: MediaEntry): string {
    return entry.publicPath;
}
