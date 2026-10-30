/**
 * Pages Function：前台询盘表单 → 服务端校验 → 写入 Supabase 的 inquiries 表。
 * 后台「询盘」页登录即可看到，数据全程不经任何第三方。
 *
 * 为什么走函数而不是让浏览器直连 PostgREST：
 *   一是能把校验做在服务端（前端的 required 和 maxlength 挡不住改过请求的人），
 *   二是给蜜罐字段一个真正能丢弃垃圾的地方，三是表结构不出现在访客可见的 JS 里。
 *   但**权限边界不依赖本函数**：库上给 anon 的 RLS 策略 with check 里带了同样的约束，
 *   绕过这里直打 REST 一样会被数据库拒掉（见 supabase/schema.sql 的 public_drop_only）。
 *
 * 需要的 Pages 配置：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   —— 与 /api/publish 校验登录用的是同两个变量，已存在，无需新增任何 Secret。
 *   这里刻意只用 anon key：能写这张表的只有 RLS 允许的那一条 insert，
 *   把 service key 放进来只会扩大泄露面。
 */
import { json, type FnCtx } from '../_lib/auth';

/** 与库上 with check 完全同口径；不一致会让访客收到 400 而不知为何 */
const LIMITS = { name: 120, email: 254, phone: 60, country: 80, message: 4000, page: 300, product: 200 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** 同 IP 每分钟条数：只是降噪，不是安全边界（Workers 多实例各算各的，挡不住分布式刷） */
const RATE_PER_MIN = 5;

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
    return recent.length > RATE_PER_MIN;
}

/** 只留纯文本：去掉标签与控制字符，但保留换行（留言里的分段对客户有用） */
function cleanText(s: string, max: number): string {
    return s
        .replace(/<[^>]*>/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, max);
}

/**
 * 同时吃 JSON 与表单编码，并记住是哪种：
 * 表单编码意味着浏览器没跑 JS（原生 POST），此时必须回 302 而不是 JSON 页面。
 */
async function readFields(request: Request): Promise<{ fields: Record<string, string>; html: boolean } | null> {
    const ct = (request.headers.get('content-type') ?? '').toLowerCase();
    try {
        if (ct.includes('application/json')) {
            const body = (await request.json()) as Record<string, unknown>;
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(body)) out[k] = typeof v === 'string' ? v : String(v ?? '');
            return { fields: out, html: false };
        }
        if (ct.includes('form')) {
            const fd = await request.formData();
            const out: Record<string, string> = {};
            for (const [k, v] of fd.entries()) out[k] = typeof v === 'string' ? v : '';
            return { fields: out, html: true };
        }
    } catch {
        return null;
    }
    return null;
}

/**
 * 联系页回执锚点：静态页读不到查询串，但 CSS `:target` 能按锚点显示对应回执块，
 * 所以无 JS 的原生提交也能拿到明确结果，不靠客户端脚本。
 */
const CONTACT_BACK = '/contact-us/';
const NOTE = { sent: 'iq-sent', failed: 'iq-failed', invalid: 'iq-invalid', rate: 'iq-rate' } as const;
type Note = keyof typeof NOTE;

/** 只给无 JS 的原生提交用（303 回联系页并带上回执锚点）；AJAX 分支在调用处直接回 JSON */
const back = (status: Note): Response =>
    new Response(null, { status: 303, headers: { location: `${CONTACT_BACK}#${NOTE[status]}` } });

export const onRequestPost = async (ctx: FnCtx): Promise<Response> => {
    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = ctx.env;
    if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
        return json({ ok: false, error: 'Inquiries are not configured on this deployment.' }, 500);
    }

    const parsed = await readFields(ctx.request);
    if (!parsed) return json({ ok: false, error: 'Unsupported request body.' }, 400);
    const { fields: raw, html } = parsed;

    /* 蜜罐：真人看不见也 tab 不到，机器人几乎都会填。
     * 这里返回成功而不是 403 —— 让脚本以为打法有效，减少它换姿势重试的动机。 */
    if ((raw.bot_field ?? '').trim() !== '') {
        return html ? back('sent') : json({ ok: true, received: true });
    }

    const ip = ctx.request.headers.get('cf-connecting-ip') ?? 'unknown';
    if (rateLimited(ip)) {
        if (html) return back('rate');
        return json({ ok: false, error: 'Too many inquiries from this connection. Please try again in a minute.' }, 429);
    }

    const name = cleanText(raw.name ?? '', LIMITS.name);
    const email = cleanText(raw.email ?? '', LIMITS.email);
    const message = cleanText(raw.message ?? '', LIMITS.message);
    const phone = cleanText(raw.phone ?? '', LIMITS.phone);
    const country = cleanText(raw.country ?? '', LIMITS.country);
    const product = cleanText(raw.product ?? '', LIMITS.product);
    /* 只收站内相对路径，绝不拿访客给的绝对 URL 做跳转或入库 */
    const page = /^\/[^\s]*$/.test((raw.page ?? '').trim()) ? cleanText(raw.page, LIMITS.page) : '';

    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!EMAIL_RE.test(email)) missing.push('email');
    if (message.length < 5) missing.push('message');
    if (missing.length > 0) {
        if (html) return back('invalid');
        return json({ ok: false, error: `Please fill in a valid ${missing.join(', ')}.`, fields: missing }, 422);
    }

    const res = await fetch(`${VITE_SUPABASE_URL}/rest/v1/inquiries`, {
        method: 'POST',
        // anon key + apikey：role=anon，能过的那条策略就是库上唯一的 for insert to anon
        headers: {
            apikey: VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            prefer: 'return=minimal',
        },
        body: JSON.stringify({ name, email, phone, country, message, page, product, state: 'new', note: '' }),
        signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
        // 库端拒绝的具体原因（多半是 RLS 或长度）只写日志，回给访客一句不泄露内部结构的话
        console.error('inquiry rejected by database', res.status, (await res.text()).slice(0, 300));
        if (html) return back('failed');
        return json({ ok: false, error: 'We could not record your inquiry just now. Please try again, or use WhatsApp below.' }, 502);
    }

    if (html) return back('sent');
    return json({ ok: true, received: true });
};
