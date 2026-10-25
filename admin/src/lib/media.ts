import { supabase } from './supabase';

export interface UploadedMedia {
    key: string;
    url: string;
    bytes: number;
    contentType: string;
}

async function authHeaders(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 上传单个图片到 R2（经 Pages Function），返回公开 URL 等元数据 */
export async function uploadMedia(file: File): Promise<UploadedMedia> {
    const fd = new FormData();
    fd.append('file', file);
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
    return (await res.json()) as UploadedMedia;
}

export async function deleteMedia(key: string): Promise<void> {
    await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ key }),
    });
}

/** 读取图片文件的真实宽高（失败返回 0，不阻断上传） */
export async function imageDims(file: File): Promise<{ width: number; height: number }> {
    try {
        const bmp = await createImageBitmap(file);
        const d = { width: bmp.width, height: bmp.height };
        bmp.close?.();
        return d;
    } catch {
        return { width: 0, height: 0 };
    }
}
