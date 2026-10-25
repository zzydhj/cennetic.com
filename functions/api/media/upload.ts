/**
 * Pages Function：接收图片文件 → 用 R2 绑定写入桶 → 返回公开 URL。
 * 部署需在 Pages 项目配 R2 绑定（变量名 MEDIA → 桶 cennetic-com）与
 * 环境变量 SUPABASE_URL / SUPABASE_ANON_KEY（用于校验调用者是已登录用户）。
 * 密钥/凭据都不进前端：浏览器只把文件 POST 到这里。
 */
interface R2ObjectLike {
    put: (key: string, data: ArrayBuffer, opts: unknown) => Promise<unknown>;
    delete: (key: string) => Promise<unknown>;
}
interface FnCtx {
    request: Request;
    env: { MEDIA: R2ObjectLike; R2_PUBLIC_BASE?: string; VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}

const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** 校验请求携带的 Supabase 用户 JWT；无/无效则返回 401 */
async function requireUser(ctx: FnCtx): Promise<Response | null> {
    const { request, env } = ctx;
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return json({ error: 'unauthorized' }, 401);
    const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return r.ok ? null : json({ error: 'unauthorized' }, 401);
}

function makeKey(name: string): string {
    const safe = (name || 'image').toLowerCase().replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8);
    return `uploads/${y}/${m}/${rand}-${safe}`;
}

export const onRequestPost = async (ctx: FnCtx): Promise<Response> => {
    const denied = await requireUser(ctx);
    if (denied) return denied;

    const form = await ctx.request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);

    const buf = await file.arrayBuffer();
    const key = makeKey(file.name);
    const contentType = file.type || 'application/octet-stream';
    await ctx.env.MEDIA.put(key, buf, { httpMetadata: { contentType } });

    const base = (ctx.env.R2_PUBLIC_BASE || 'https://media.cennetic.com').replace(/\/+$/, '');
    return json({ key, url: `${base}/${key}`, bytes: buf.byteLength, contentType });
};
