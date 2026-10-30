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
        /*
         * 给前端的错误文案一律不提厂商名与变量名（这段文字会直接弹进后台 toast），
         * 完整原因只进服务端日志（Cloudflare Pages → 函数日志，只有项目成员能看到）。
         */
        console.error('publish not configured', { GH_OWNER: !!GH_OWNER, GH_REPO: !!GH_REPO, GH_WORKFLOW: !!GH_WORKFLOW, GH_API_TOKEN: !!GH_API_TOKEN });
        return json({ error: '发布流水线尚未配置完成，请联系运维。' }, 500);
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
                // GitHub REST 强制要求 User-Agent，缺了就一律 403；Workers 的 fetch 不会自动带
                'User-Agent': 'cennetic-admin-publish',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ ref: 'main', inputs: { reason } }),
        });

        if (res.status === 204) {
            /* 不返回 runUrl：那是代码托管站的仓库地址，会经前端 JSON 响应暴露仓库名与账号名。
             * 要看运行进度请走服务端日志，或由运维直接给链接。 */
            return json({ ok: true });
        }
        const detail = (await res.text()).slice(0, 300);
        console.error('publish dispatch rejected', res.status, detail);
        let hint: string;
        if (/user-agent/i.test(detail)) hint = '发布请求缺少必要的标识头，请联系运维。';
        else if (res.status === 401 || res.status === 403) hint = '发布凭据无效、已过期或权限不足，请联系运维。';
        else if (res.status === 404) hint = '发布目标配置不正确（仓库或流水线名），请联系运维。';
        else hint = '发布系统拒绝了本次触发，请联系运维。';
        /* 只回状态码，不把第三方的原始响应体透给浏览器（里面常有域名、仓库名、内部字段） */
        return json({ error: `${hint}（HTTP ${res.status}）` }, 502);
    } catch (e) {
        console.error('publish dispatch threw', e instanceof Error ? e.message : String(e));
        return json({ error: '无法连接发布服务，请稍后重试或联系运维。' }, 500);
    }
};
