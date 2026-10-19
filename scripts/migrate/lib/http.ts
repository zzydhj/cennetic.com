/**
 * 带本地缓存、重试和限速的抓取层。
 * 目的：让整条迁移管道可反复幂等运行 —— 第二次跑几乎不联网。
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { CACHE_DIR } from './config.ts';
import { parseJsonLenient } from './json.ts';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 缓存有效期：24 小时。过期后重新抓取。 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 同一 URL 两次请求之间的最小间隔，避免打挂源站。 */
const MIN_INTERVAL_MS = 220;

let lastRequestAt = 0;

function cacheKey(url: string, kind: string): string {
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
    // kind 允许写成 'api:paged' 这种逻辑分组，但 ':' 在 Windows 路径里非法，转为目录分隔
    const safeKind = kind.replace(/:/g, '/');
    return join(CACHE_DIR, safeKind, `${hash}.json`);
}

async function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function throttle(): Promise<void> {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
}

async function readCache(key: string): Promise<string | null> {
    try {
        const info = await stat(key);
        if (Date.now() - info.mtimeMs > CACHE_TTL_MS) return null;
        return await readFile(key, 'utf8');
    } catch {
        return null;
    }
}

async function writeCache(key: string, value: string): Promise<void> {
    await mkdir(dirname(key), { recursive: true });
    await writeFile(key, value, 'utf8');
}

export interface FetchOptions {
    /** 缓存子目录，按用途隔离 */
    kind: string;
    /** 强制忽略缓存重新抓取 */
    refresh?: boolean;
    /** 404 不视为错误，返回 null */
    allow404?: boolean;
    retries?: number;
}

/** fetchJsonPaged 的返回结构 */
export interface PagedResult<T> {
    data: T;
    total: number;
    totalPages: number;
    /** JSON 之前被 Elementor 误输出的内容，无污染时为空串 */
    pollution: string;
}

/** 抓取纯文本 / HTML。 */
export async function fetchText(url: string, opts: FetchOptions): Promise<string | null> {
    const key = cacheKey(url, opts.kind);

    if (!opts.refresh) {
        const hit = await readCache(key);
        if (hit !== null) return hit === '' ? null : hit;
    }

    const retries = opts.retries ?? 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        await throttle();
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
                redirect: 'follow',
            });

            if (res.status === 404 && opts.allow404) {
                await writeCache(key, '');
                return null;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

            const body = await res.text();
            await writeCache(key, body);
            return body;
        } catch (err) {
            lastError = err;
            if (attempt < retries) await sleep(700 * attempt * attempt);
        }
    }

    throw new Error(`fetch failed after ${retries} attempts: ${url}\n  ${String(lastError)}`);
}

/** 抓取 JSON。 */
export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<T | null> {
    const text = await fetchText(url, opts);
    if (text === null) return null;
    try {
        return JSON.parse(text) as T;
    } catch (err) {
        throw new Error(`invalid JSON from ${url}: ${String(err)}`);
    }
}

/**
 * 抓取 JSON 并同时返回 WordPress 的 X-WP-Total / X-WP-TotalPages 响应头。
 * 整个响应包（含分页头与污染前缀）进缓存，所以重跑管道不再联网。
 */
export async function fetchJsonPaged<T>(
    url: string,
    opts: FetchOptions,
): Promise<PagedResult<T>> {
    const key = cacheKey(url, `${opts.kind}:paged`);

    if (!opts.refresh) {
        const hit = await readCache(key);
        if (hit !== null) return JSON.parse(hit) as PagedResult<T>;
    }

    await throttle();
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const body = await res.text();
    const parsed = parseJsonLenient<T>(body, url);

    const result: PagedResult<T> = {
        data: parsed.value,
        total: Number(res.headers.get('X-WP-Total') ?? 0),
        totalPages: Number(res.headers.get('X-WP-TotalPages') ?? 0),
        pollution: parsed.prefix,
    };

    await writeCache(key, JSON.stringify(result));
    return result;
}

/**
 * 下载二进制到指定文件。目标文件本身即缓存：已存在且非空则跳过。
 * 用于把源站图片拉进 media-staging/，不另设一层缓存副本。
 */
export async function downloadTo(
    url: string,
    dest: string,
    opts: { refresh?: boolean; headers?: Record<string, string> } = {},
): Promise<{ bytes: Buffer | null; status: number }> {
    if (!opts.refresh) {
        try {
            const info = await stat(dest);
            if (info.size > 0) return { bytes: await readFile(dest), status: 200 };
        } catch {
            /* 尚未下载 */
        }
    }

    await throttle();
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...opts.headers } });
    if (res.status === 404) return { bytes: null, status: 404 };
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return { bytes: buf, status: res.status };
}

/** 只探测状态码，用于分页边界探测与内链健康检查。 */
export async function headStatus(url: string): Promise<number> {
    await throttle();
    try {
        const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA }, redirect: 'manual' });
        return res.status;
    } catch {
        return 0;
    }
}
