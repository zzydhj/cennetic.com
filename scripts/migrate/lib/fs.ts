/**
 * 文件读写辅助：JSON、YAML frontmatter、目录准备、日志。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './config.ts';

export async function ensureDir(filePath: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
    await ensureDir(filePath);
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJson<T>(filePath: string, fallback?: T): Promise<T> {
    if (!existsSync(filePath)) {
        if (fallback !== undefined) return fallback;
        throw new Error(`missing file: ${filePath}`);
    }
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function writeText(filePath: string, text: string): Promise<void> {
    await ensureDir(filePath);
    await writeFile(filePath, text, 'utf8');
}

/** 相对项目根目录打印，日志更易读 */
export function rel(absPath: string): string {
    const r = resolve(absPath).replace(/\\/g, '/');
    const root = ROOT.replace(/\\/g, '/');
    return r.startsWith(root) ? r.slice(root.length + 1) : r;
}

export function log(...args: unknown[]): void {
    console.log(...args);
}

export function step(title: string): void {
    console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`);
}

/** 把源站绝对图片 URL 转成站内相对路径，去掉 origin。 */
export function toSitePath(url: string): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) return url;
        return decodeURIComponent(u.pathname);
    } catch {
        return url;
    }
}

/**
 * 源站 uploads 路径 → 新站图片存放路径。
 * /wp-content/uploads/2026/06/foo.webp → /images/2026/06/foo.webp
 * 保留年月目录，避免同名覆盖，也让 _redirects 能机械映射。
 */
export function uploadPathToLocalImagePath(sourcePath: string): string {
    const m = sourcePath.match(/^\/wp-content\/uploads\/(.+)$/);
    if (!m) return join('/images', `misc/${posix.basename(sourcePath)}`);
    // 去掉 WP 生成的尺寸后缀（-300x200），只保留原图名
    const withoutSize = m[1].replace(/-\d+x\d+(\.\w+)$/, '$1');
    return join('/images', withoutSize);
}

/** 文件名安全化，用于 Markdown slug */
export function safeName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[^\w.\-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

export function extOf(urlOrPath: string): string {
    const clean = urlOrPath.split('?')[0].split('#')[0];
    return extname(clean).toLowerCase();
}

/** tsx 以独立脚本运行时的入口判断 */
export function isDirectRun(importMetaUrl: string): boolean {
    return process.argv[1] !== undefined && importMetaUrl === pathToFileURL(process.argv[1]).href;
}

export { join };
