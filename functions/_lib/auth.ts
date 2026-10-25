/**
 * Pages Functions 共用件（目录名以 _ 开头，Cloudflare Pages 不把它当路由）。
 * 三个接口（媒体上传/删除、发布触发）都要求「后台已登录用户」，
 * 校验方式统一：拿请求里的 Supabase access_token 去 /auth/v1/user 换用户信息。
 */
export interface FnEnv {
    /** R2 绑定：变量名 MEDIA → 桶 cennetic-com（Pages 设置里配） */
    MEDIA?: { put: (key: string, data: ArrayBuffer, opts: unknown) => Promise<unknown>; delete: (key: string) => Promise<unknown> };
    R2_PUBLIC_BASE?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    GH_API_TOKEN?: string;
    GH_OWNER?: string;
    GH_REPO?: string;
    GH_WORKFLOW?: string;
}

export interface FnCtx {
    request: Request;
    env: FnEnv;
}

export const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/**
 * 校验调用者是已登录的后台用户。
 * 通过返回 null；否则返回可直接回给客户端的 401/500 响应。
 */
export async function requireUser(ctx: FnCtx): Promise<Response | null> {
    const { request, env } = ctx;
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
        return json({ error: '服务端缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' }, 500);
    }
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: '未登录：请求缺少 Authorization 头' }, 401);

    const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return r.ok ? null : json({ error: '登录状态无效，请重新登录后台' }, 401);
}
