/** Pages Function：按 key 删除 R2 对象（要求已登录）。 */
import { json, requireUser, type FnCtx } from '../../_lib/auth';

export const onRequestDelete = async (ctx: FnCtx): Promise<Response> => {
    const denied = await requireUser(ctx);
    if (denied) return denied;
    if (!ctx.env.MEDIA) return json({ error: 'R2 绑定 MEDIA 未注入本部署（加绑定后需重新构建一次）' }, 500);

    const { key } = (await ctx.request.json()) as { key?: string };
    if (!key || typeof key !== 'string') return json({ error: 'no key' }, 400);

    try {
        await ctx.env.MEDIA.delete(key);
        return json({ ok: true });
    } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
};
