import { supabase } from './supabase';

export interface PublishResult {
    ok: boolean;
    error?: string;
}

/**
 * 通知线上「内容变了，去跑快照发布」。
 * 真正干活的是服务端函数 /api/publish（它再触发构建流水线），
 * 这里只负责带上当前登录用户的令牌并给出可读结果。
 */
export async function triggerPublish(reason = 'admin'): Promise<PublishResult> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: '登录状态已失效，请重新登录' };

    const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
    });

    let payload: { ok?: boolean; error?: string } = {};
    try {
        payload = (await res.json()) as typeof payload;
    } catch {
        /* 非 JSON 响应，按状态码兜底 */
    }

    if (res.ok && payload.ok) return { ok: true };
    return { ok: false, error: payload.error ?? `发布触发失败（HTTP ${res.status}）` };
}
