/**
 * Pages Function：接收图片文件 → 用 R2 绑定写入桶 → 返回公开 URL。
 * 浏览器端已按需压缩（见 admin/src/lib/media.ts），这里只做鉴权与落库桶。
 * 部署需在 Pages 项目配 R2 绑定（变量名 MEDIA → 桶 cennetic-com）与
 * 环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（校验调用者是已登录用户）。
 * 密钥/凭据都不进前端：浏览器只把文件 POST 到这里。
 */
import { json, requireUser, type FnCtx } from '../../_lib/auth';

/** 服务端硬闸：单文件最大 8MB（前端已压缩，此处防绕过接口） */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** uploads/年/月/随机-安全文件名 */
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
    if (!ctx.env.MEDIA) {
        console.error('media binding MEDIA missing');
        return json({ error: '图片存储未就绪，请联系运维（新增绑定后需重新部署一次）。' }, 500);
    }

    try {
        const form = await ctx.request.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);
        if (!file.type.startsWith('image/')) return json({ error: '只能上传图片文件' }, 400);
        if (file.size > MAX_UPLOAD_BYTES) return json({ error: `文件过大（${Math.round(file.size / 1024 / 1024)}MB，上限 8MB）` }, 413);

        const buf = await file.arrayBuffer();
        const key = makeKey(file.name);
        const contentType = file.type || 'application/octet-stream';
        await ctx.env.MEDIA.put(key, buf, { httpMetadata: { contentType } });

        const base = (ctx.env.R2_PUBLIC_BASE || 'https://media.cennetic.com').replace(/\/+$/, '');
        return json({ key, url: `${base}/${key}`, bytes: buf.byteLength, contentType });
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
};
