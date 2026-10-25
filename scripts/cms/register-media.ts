/**
 * 把「站点里已经存在的图片」如实登记进 media_assets，让后台媒体库看得见资产。
 *
 * 两个来源，都按真实值登记（路径 / 文件名 / 宽高 / 体积 / MIME）：
 *   1) 仓库 public/images/**  —— 迁移期直接落盘的静态资源，由 Pages 同源直出，key 形如 images/2026/06/x.webp
 *   2) R2 桶里的对象          —— 后台上传的图片，key 形如 uploads/2026/10/x.jpg，走 media.cennetic.com
 *
 * 用法：
 *   npx tsx scripts/cms/register-media.ts              登记（幂等，可反复跑）
 *   npx tsx scripts/cms/register-media.ts --dry-run    只报告，不写库
 *   npx tsx scripts/cms/register-media.ts --all        连 -100x100 这类派生尺寸一起登记（默认跳过）
 *
 * 注意：本脚本只写 media_assets，不动任何文件、不改内容里的图片 URL，
 *      因此前台渲染零影响；要撤销就按 key 前缀删表里的行。
 */
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import sharp from 'sharp';
import { ROOT, loadEnvFile, requireEnv } from './lib/env.ts';
import { createRestClient } from './lib/rest.ts';

/** 派生缩略图（WordPress 的 -WxH 命名）：默认不入库，一张原图占一行才清爽 */
const DERIVED = /-\d+x\d+\.(webp|jpe?g|png|avif|gif)$/i;
const RASTER = /\.(webp|jpe?g|png|avif|gif|tiff?)$/i;
const MIME: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
};

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ALL = args.includes('--all');

interface Asset {
    key: string;
    public_url: string;
    alt: string;
    width: number | null;
    height: number | null;
    bytes: number;
    mime: string;
}

/** 文件名 → 可读 alt：去扩展名、分隔符转空格（登记后再在后台人工润色） */
function altOf(name: string): string {
    return name
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();
}

async function dimsOf(buf: Buffer, file: string): Promise<{ width: number | null; height: number | null }> {
    if (!RASTER.test(file)) return { width: null, height: null };
    try {
        const md = await sharp(buf).metadata();
        return { width: md.width ?? null, height: md.height ?? null };
    } catch {
        return { width: null, height: null };
    }
}

/* ── 来源 1：仓库 public/images ─────────────────────────────────────────── */

async function fromRepo(): Promise<Asset[]> {
    const base = join(ROOT, 'public', 'images');
    if (!existsSync(base)) {
        console.log('· public/images 不存在，跳过仓库来源');
        return [];
    }
    const files: string[] = [];
    (function walk(dir: string): void {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) walk(p);
            else files.push(p);
        }
    })(base);

    const picked = files.filter((p) => (ALL ? true : !DERIVED.test(p)));
    const skipped = files.length - picked.length;
    const out: Asset[] = [];
    for (const p of picked) {
        const rel = '/' + p.slice(ROOT.length + 1).split(sep).join('/'); // /public/images/...
        const url = rel.replace(/^\/public/, ''); // /images/...
        const key = url.slice(1); // images/...
        const buf = readFileSync(p);
        const { width, height } = await dimsOf(buf, p);
        out.push({
            key,
            public_url: url,
            alt: altOf(p.split(sep).pop() ?? ''),
            width,
            height,
            bytes: buf.byteLength,
            mime: MIME[p.slice(p.lastIndexOf('.'))?.toLowerCase()] ?? 'application/octet-stream',
        });
    }
    console.log(`· 仓库来源：登记 ${out.length} 个文件${ALL ? '' : `（跳过派生尺寸 ${skipped} 个）`}`);
    return out;
}

/* ── 来源 2：R2 桶（可选，缺 R2_* 变量就跳过） ──────────────────────────── */

interface R2Cfg {
    host: string;
    bucket: string;
    access: string;
    secret: string;
    publicBase: string;
}

function r2Config(): R2Cfg | null {
    loadEnvFile();
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET;
    const access = process.env.R2_ACCESS_KEY_ID;
    const secret = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !access || !secret) {
        console.log('· 未配置 R2_* 环境变量，跳过桶内对象（只登记仓库来源）');
        return null;
    }
    return {
        host: new URL(endpoint).host,
        bucket,
        access,
        secret,
        publicBase: (process.env.R2_PUBLIC_BASE ?? `https://media.example.com`).replace(/\/+$/, ''),
    };
}

const hmac = (key: Buffer | string, s: string): Buffer => createHmac('sha256', key).update(s, 'utf8').digest();

/** 只读的 SigV4 签名（ListObjectsV2 / GetObject），不落任何写操作 */
async function r2Fetch(cfg: R2Cfg, pathName: string, query: string): Promise<Response> {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update('').digest('hex');
    const canonicalHeaders = `host:${cfg.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const creq = ['GET', pathName, query, canonicalHeaders, 'host;x-amz-content-sha256;x-amz-date', payloadHash].join('\n');
    const scope = `${dateStamp}/auto/s3/aws4_request`;
    const sts = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(creq).digest('hex')].join('\n');
    const signing = hmac(hmac(hmac(hmac('AWS4' + cfg.secret, dateStamp), 'auto'), 's3'), 'aws4_request');
    const signature = hmac(signing, sts).toString('hex');
    return fetch(`https://${cfg.host}${pathName}${query ? `?${query}` : ''}`, {
        headers: {
            Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.access}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash,
        },
    });
}

async function fromR2(): Promise<Asset[]> {
    const cfg = r2Config();
    if (!cfg) return [];
    const { res, text } = await (async () => {
        const r = await r2Fetch(cfg, `/${cfg.bucket}/`, 'list-type=2&max-keys=1000');
        return { res: r, text: await r.text() };
    })();
    if (!res.ok) {
        console.log(`· R2 列举失败（HTTP ${res.status}），跳过桶内对象`);
        return [];
    }
    const keys = [...text.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    const sizes = [...text.matchAll(/<Size>(\d+)<\/Size>/g)].map((m) => Number(m[1]));
    const picked = keys.map((k, i) => ({ k, size: sizes[i] ?? 0 })).filter((x) => (ALL ? true : !DERIVED.test(x.k)));
    const out: Asset[] = [];
    for (const { k, size } of picked) {
        let width: number | null = null;
        let height: number | null = null;
        // 读宽高需要把对象拉下来；只对小文件做，大文件留空由后台上传时补
        if (RASTER.test(k) && size > 0 && size < 8 * 1024 * 1024) {
            const one = await r2Fetch(cfg, `/${cfg.bucket}/${encodeURI(k)}`, '');
            if (one.ok) ({ width, height } = await dimsOf(Buffer.from(await one.arrayBuffer()), k));
        }
        out.push({
            key: k,
            public_url: `${cfg.publicBase}/${encodeURI(k)}`,
            alt: altOf(k.split('/').pop() ?? ''),
            width,
            height,
            bytes: size,
            mime: MIME[k.slice(k.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream',
        });
    }
    console.log(`· R2 来源：登记 ${out.length} 个对象（桶内共 ${keys.length} 个）`);
    return out;
}

/* ── 主流程 ─────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
    loadEnvFile();
    const url = requireEnv('SUPABASE_URL');
    const key = requireEnv('SUPABASE_SECRET_KEY');
    const rest = createRestClient(url, key);

    const assets = [...(await fromRepo()), ...(await fromR2())];
    if (assets.length === 0) throw new Error('一个资产都没找到，检查 public/images 与 R2 配置');

    // 同名 key 只保留一条（仓库与桶理论上不重叠，这里只是防御）
    const uniq = new Map<string, Asset>();
    assets.forEach((a) => uniq.set(a.key, a));
    const rows = [...uniq.values()].sort((a, b) => a.key.localeCompare(b.key));

    const existing = await rest.list<{ key: string }>('media_assets', 'select=key');
    const known = new Set(existing.map((r) => r.key));
    const fresh = rows.filter((r) => !known.has(r.key));

    const bytes = rows.reduce((a, r) => a + r.bytes, 0);
    const noDims = rows.filter((r) => r.width == null).length;
    console.log(
        `\n汇总：待写 ${rows.length} 条（其中新增 ${fresh.length}、刷新 ${rows.length - fresh.length}）` +
        ` · 合计 ${(bytes / 1024 / 1024).toFixed(1)} MB · 无宽高读数 ${noDims} 条`,
    );
    if (DRY) {
        console.log('\n[dry-run] 前 8 条预览：');
        rows.slice(0, 8).forEach((r) => console.log(`  ${r.width ?? '?'}x${r.height ?? '?'}  ${(r.bytes / 1024).toFixed(0).padStart(5)}KB  ${r.public_url}`));
        return;
    }

    // 分批 upsert：一次塞太多会被 PostgREST 的请求体上限挡下
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK) as unknown as Record<string, unknown>[];
        await putWithRetry(rest, 'media_assets', batch, 'key', Math.floor(i / CHUNK) + 1);
        console.log(`  已写入 ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
    }
    console.log(`\n✓ 登记完成，现在共 ${(await rest.count('media_assets'))} 条媒体记录`);
}

/**
 * 网络抖动的退避重试：只重试「fetch failed」这类拿不到响应的错误，
 * HTTP 4xx/5xx 由 rest 抛错、直接停（那是数据或权限问题，重试无意义）。
 */
async function putWithRetry(
    rest: ReturnType<typeof createRestClient>,
    table: string,
    rows: Record<string, unknown>[],
    onConflict: string,
    no: number,
): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            await rest.upsert(table, rows, onConflict);
            return;
        } catch (e) {
            const msg = e instanceof Error ? `${e.message} ${describeCause(e)}` : String(e);
            if (attempt >= 4 || !/fetch failed|ECONN|ETIMEDOUT|socket/i.test(msg)) throw e;
            const wait = attempt * 800;
            console.log(`  ! 第 ${no} 批第 ${attempt} 次失败（${msg}），${wait}ms 后重试`);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
}

/** undici 的 fetch failed 会把真实原因藏在 cause 里，不挖出来就没法定位 */
function describeCause(e: unknown): string {
    const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
    if (!cause) return '';
    return `[${cause.code ?? cause.message ?? 'cause'}]`;
}

main().catch((e: unknown) => {
    console.error('✗ 登记失败：', e instanceof Error ? `${e.message} ${describeCause(e)}` : e);
    process.exit(1);
});
