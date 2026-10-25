import { supabase } from './supabase';

export interface UploadedMedia {
    key: string;
    url: string;
    bytes: number;
    contentType: string;
    width: number;
    height: number;
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

/** 压缩后上传到 R2（经 Pages Function），返回公开 URL 与最终宽高 */
export async function uploadImage(file: File): Promise<UploadedMedia> {
    const { blob, width, height } = await compressImage(file);
    const name = blob === file ? file.name : `${(file.name.replace(/\.[^.]+$/, '') || 'image').replace(/[^\w.\-]+/g, '-')}.webp`;
    const fd = new FormData();
    fd.append('file', new File([blob], name, { type: blob.type || 'image/webp' }));

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
    const j = (await res.json()) as Omit<UploadedMedia, 'width' | 'height'>;
    return { ...j, width, height };
}

export async function deleteMedia(key: string): Promise<void> {
    await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ key }),
    });
}
