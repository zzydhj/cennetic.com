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

/**
 * 对象键：uploads/年/月/<内容标识>-<描述>-<时分秒>.<扩展名>
 *
 * 旧规则是 `uploads/2026/10/gs9alg-6.webp` 这种「6 位随机 + 原文件名」：防重名有效，
 * 但文件名完全看不出归属，桶里攒多了就是一堆哑巴对象。现在把「在为哪条内容上传」
 * 一并编进键名（由后台通过 scope 字段送上来），例如
 *     uploads/2026/10/v-856-vertical-machining-center-spindle-143205.webp
 *
 * 用时分秒而不是随机串做去重：同样能避开同名覆盖，但人眼能读、也按时间自然排序。
 * 清洗后只剩非 ASCII（比如整段中文描述）会退化为空，这时宁可用 img 占位，
 * 也不能让中文进键名 —— 那会重新造出这次刚清理掉的编码 URL。
 */
function slug(s: string, max: number): string {
    return (s || '')
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, '')            // 去掉原扩展名，末尾统一由调用方接上
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max);
}

function makeKey(scope: string, original: string): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const hms = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const ext = (original.match(/\.[a-z0-9]+$/i)?.[0] ?? '.webp').toLowerCase();
    const parts = [slug(scope, 60), slug(original, 40)].filter(Boolean);
    return `uploads/${y}/${m}/${(parts.join('-') || 'img')}-${hms}${ext}`;
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
        /* scope 由后台告知「这条图是给哪篇内容用的」；缺省时只靠原文件名与时间，不会报错 */
        const scope = String(form.get('scope') ?? '');
        const key = makeKey(scope, file.name);
        const contentType = file.type || 'application/octet-stream';
        await ctx.env.MEDIA.put(key, buf, { httpMetadata: { contentType } });

        const base = (ctx.env.R2_PUBLIC_BASE || 'https://media.cennetic.com').replace(/\/+$/, '');
        return json({ key, url: `${base}/${key}`, bytes: buf.byteLength, contentType });
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
};
