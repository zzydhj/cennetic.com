/**
 * 发布前预检。
 *
 * 为什么必须有：快照对每一行内容都跑 assertSlug / assertDateText，任何一行不合规就
 * 整个中断 —— 一条填错的文章会拖住全站所有内容的上线，而后台当时显示的仍是「发布已触发」，
 * 运营只会以为"点了没反应"。真正的原因藏在构建流水线的日志里，对使用者等于不可见。
 *
 * 这里把同样的判据提前到点按钮这一刻跑，用中文列出问题行，直接拦住。
 * 注意要连草稿一起查：草稿同样会写进快照，同样能打断发布。
 */
import { supabase } from './supabase';
import { SLUG_RE } from './validate';

/** 与快照 assertDateText 对齐：只收裸 ISO 串，带 +00 / Z / 毫秒的都是脏值 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/;

type Row = Record<string, unknown>;
const txt = (v: unknown): string => String(v ?? '').trim();

/** 逐行检查一张表，返回「内容名：问题」形式的中文描述 */
async function scan(
    table: string,
    label: string,
    cols: string,
    rowCheck: (r: Row) => string[],
): Promise<string[]> {
    const { data, error } = await supabase.from(table).select(cols).limit(3000);
    if (error) return [`${label}：预检读不到数据，为稳妥起见先不发布（请把这条转给开发）。`];
    const msgs: string[] = [];
    for (const r of ((data ?? []) as unknown as Row[])) {
        const who = txt(r.title) || txt(r.name) || txt(r.slug) || '（未命名）';
        for (const m of rowCheck(r)) msgs.push(`${label}「${who}」：${m}`);
        if (msgs.length >= 12) break;
    }
    return msgs;
}

export async function precheckPublish(): Promise<string[]> {
    const slugProblem = (r: Row): string | null => {
        const s = txt(r.slug);
        if (!s) return '网址标识是空的，必须补上（留空会让整站发布失败）。';
        if (!SLUG_RE.test(s)) return `网址标识「${s}」不合规：只能用英文小写、数字和连字符。`;
        return null;
    };

    const [arts, prods, bcats, pcats, auths] = await Promise.all([
        scan('articles', '文章', 'slug,title,heading,description,date,lastmod,modified,status', (r) => {
            const out: string[] = [];
            const s = slugProblem(r);
            if (s) out.push(s);
            if (!txt(r.title)) out.push('SEO 标题是空的。');
            if (!txt(r.heading)) out.push('页面 H1 是空的。');
            const d = txt(r.description);
            if (d.length < 30 || d.length > 255) out.push(`摘要需要 30–255 字（当前 ${d.length} 字）。`);
            for (const [k, name] of [['date', '发布日期'], ['lastmod', '最后修改'], ['modified', '修改日期']] as const) {
                const v = txt(r[k]);
                if (v && !DATE_RE.test(v)) out.push(`${name}「${v}」不是标准日期，请写成 2026-10-30 这种形式。`);
            }
            return out;
        }),
        scan('products', '产品', 'slug,name,canonical', (r) => {
            const out: string[] = [];
            const s = slugProblem(r);
            if (s) out.push(s);
            if (!txt(r.name)) out.push('产品名称是空的。');
            if (!txt(r.canonical)) out.push('规范地址是空的（一般填 /product/网址标识/）。');
            return out;
        }),
        scan('blog_categories', '博客分类', 'slug,name', slugProblem1),
        scan('product_categories', '产品分类', 'slug,name', slugProblem1),
        scan('authors', '作者', 'slug,name', slugProblem1),
    ]);

    return [...arts, ...prods, ...bcats, ...pcats, ...auths];
}

/** 分类与作者只有 slug + name 两个必填，复用一份 */
function slugProblem1(r: Row): string[] {
    const out: string[] = [];
    const s = txt(r.slug);
    if (!s) out.push('网址标识是空的，必须补上（留空会让整站发布失败）。');
    else if (!SLUG_RE.test(s)) out.push(`网址标识「${s}」不合规：只能用英文小写、数字和连字符。`);
    if (!txt(r.name)) out.push('名称是空的。');
    return out;
}
