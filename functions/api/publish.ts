/**
 * Pages Function：后台点「发布」→ 触发 GitHub Action 跑「快照 + 回归闸 + 提交 main」。
 *
 * 本函数不写文件也不碰 git：它只按下按钮。真正的内容落盘在 Action 里做，
 * 因为那里有完整构建环境，能在提交前跑 build + verify:parity 把坏快照挡在 main 外。
 *
 * 需要 Pages 配置（Settings → Environment variables / Secrets，Production）：
 *   GH_OWNER / GH_REPO / GH_WORKFLOW  明文变量
 *   GH_API_TOKEN                      **用 Secret 类型**：fine-grained PAT，
 *                                     只授予目标仓库的 Actions: write
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  已存在，用于校验登录
 */
import { json, requireUser, type FnCtx } from '../_lib/auth';

export const onRequestPost = async (ctx: FnCtx): Promise<Response> => {
    const denied = await requireUser(ctx);
    if (denied) return denied;

    const { GH_OWNER, GH_REPO, GH_WORKFLOW, GH_API_TOKEN } = ctx.env;
    if (!GH_OWNER || !GH_REPO || !GH_WORKFLOW || !GH_API_TOKEN) {
        return json({ error: '发布未配置：Pages 里缺 GH_OWNER / GH_REPO / GH_WORKFLOW / GH_API_TOKEN' }, 500);
    }

    let reason = 'admin';
    try {
        const body = (await ctx.request.json()) as { reason?: unknown };
        if (typeof body?.reason === 'string' && body.reason.trim()) reason = body.reason.trim().slice(0, 60);
    } catch {
        /* 允许空 body，用默认原因 */
    }

    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${GH_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ ref: 'main', inputs: { reason } }),
        });

        if (res.status === 204) {
            return json({ ok: true, runUrl: `https://github.com/${GH_OWNER}/${GH_REPO}/actions/workflows/${GH_WORKFLOW}` });
        }
        const detail = (await res.text()).slice(0, 300);
        const hint =
            res.status === 401 || res.status === 403
                ? 'GH_API_TOKEN 无效或没有 Actions: write 权限'
                : res.status === 404
                  ? '仓库或 workflow 文件名不对（GH_OWNER/GH_REPO/GH_WORKFLOW）；私有仓库需 token 有读仓库权限'
                  : 'GitHub 拒绝了触发请求';
        return json({ error: `${hint}（HTTP ${res.status}）：${detail}` }, 502);
    } catch (e) {
        return json({ error: `触发失败：${e instanceof Error ? e.message : String(e)}` }, 500);
    }
};
