import { supabase } from './supabase';

export interface UploadedMedia {
    key: string;
    url: string;
    bytes: number;
    contentType: string;
    width: number;
    height: number;
    /** 是否已登记进 media_assets（失败不阻断上传，但媒体库会缺这一张） */
    registered: boolean;
}

/** 超过任一阈值就压缩：最长边压到 1600px、重编码为 WebP(q≈0.82) */
const MAX_DIM = 1600;
const MAX_BYTES = 400 * 1024;
const QUALITY = 0.82;

async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 大图/超尺寸则压缩；SVG 或解码失败则原样返回 */
async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        return { blob: file, width: 0, height: 0 };
    }
    let bmp: ImageBitmap;
    try {
        bmp = await createImageBitmap(file);
    } catch {
        return { blob: file, width: 0, height: 0 };
    }
    const w0 = bmp.width;
    const h0 = bmp.height;
    const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
    const needResize = scale < 1;
    const needEncode = file.size > MAX_BYTES;
    if (!needResize && !needEncode) {
        bmp.close?.();
        return { blob: file, width: w0, height: h0 };
    }
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bmp.close?.();
        return { blob: file, width: w0, height: h0 };
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', QUALITY));
    return blob ? { blob, width: w, height: h } : { blob: file, width: w0, height: h0 };
}

/**
 * 压缩后上传到对象存储（经 Pages Function），并登记进媒体库，返回公开 URL 与最终宽高。
 * scope 是「这条图给哪篇内容用」（一般传那条内容的网址标识），服务端会把它编进文件名；
 * 不传则只靠原文件名加时间，不会报错。
 */
export async function uploadImage(file: File, scope = ''): Promise<UploadedMedia> {
    const { blob, width, height } = await compressImage(file);
    const name = blob === file ? file.name : `${(file.name.replace(/\.[^.]+$/, '') || 'image').replace(/[^\w.\-]+/g, '-')}.webp`;
    const fd = new FormData();
    fd.append('file', new File([blob], name, { type: blob.type || 'image/webp' }));
    if (scope) fd.append('scope', scope);

    const res = await fetch('/api/media/upload', { method: 'POST', headers: await authHeaders(), body: fd });
    if (!res.ok) {
        let detail = '';
        try {
            detail = ((await res.json()) as { error?: string }).error ?? '';
        } catch {
            /* 非 JSON 响应 */
        }
        throw new Error(detail ? `上传失败：${detail}` : `上传失败（${res.status}）`);
    }
    const j = (await res.json()) as Omit<UploadedMedia, 'width' | 'height' | 'registered'>;

    // 图已经落桶，登记只是「让媒体库看得见」；这步失败不回滚上传，只如实回报
    const { error } = await supabase.from('media_assets').insert({
        key: j.key,
        public_url: j.url,
        alt: file.name.replace(/\.[^.]+$/, ''),
        width,
        height,
        bytes: j.bytes,
        mime: j.contentType,
    });
    if (error) console.warn('媒体库登记失败：', error.message);
    return { ...j, width, height, registered: !error };
}

/** 删 R2 对象。失败必须抛：否则库里删了、桶里还留着一个能访问的孤儿文件 */
export async function deleteMedia(key: string): Promise<void> {
    const res = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ key }),
    });
    if (!res.ok) {
        let detail = '';
        try {
            detail = ((await res.json()) as { error?: string }).error ?? '';
        } catch {
            /* 非 JSON 响应：本地 vite 没有这个接口时会回到 HTML */
        }
        throw new Error(
            detail || `云端文件删除失败（${res.status}）；本地开发环境没有这个接口，此类操作要到线上后台做`,
        );
    }
}
