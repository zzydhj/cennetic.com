/** Pages Function：按 key 删除 R2 对象（同样要求已登录）。 */
interface R2ObjectLike {
    delete: (key: string) => Promise<unknown>;
}
interface FnCtx {
    request: Request;
    env: { MEDIA: R2ObjectLike; VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
}

const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function requireUser(ctx: FnCtx): Promise<Response | null> {
    const { request, env } = ctx;
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return json({ error: 'unauthorized' }, 401);
    const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return r.ok ? null : json({ error: 'unauthorized' }, 401);
}

export const onRequestDelete = async (ctx: FnCtx): Promise<Response> => {
    const denied = await requireUser(ctx);
    if (denied) return denied;
    const { key } = (await ctx.request.json()) as { key?: string };
    if (!key || typeof key !== 'string') return json({ error: 'no key' }, 400);
    await ctx.env.MEDIA.delete(key);
    return json({ ok: true });
};
