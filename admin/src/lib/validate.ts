/**
 * 保存前的本地校验。
 *
 * 为什么必须做在前端 —— 2026-10-30 交付前排查出的四个真实问题：
 *  1) slug 留空能写进库（`''` 不是 null，unique 只拦重复），但快照的 assertSlug 会抛错，
 *     于是「一条没填地址的文章」能让整站发布静默停摆：运营在后台看到的仍是「发布已触发」。
 *  2) 保存走 upsert(onConflict: slug)。新建时若撞上已有地址，会直接覆盖那条内容，
 *     而提示语还写着「已新建」—— 这是数据丢失。
 *  3) title / heading / date 是 not null，description 还有 30–255 的 check。只靠数据库兜，
 *     运营会收到 Postgres 英文原文（含 articles_description_check 这类约束名），
 *     既看不懂，又把内部结构暴露到了界面上。
 *  4) slug 里出现中文或空格，前台 URL 会变成 %E4%B8%AD… 这种编码串；快照不拦、构建也不报错。
 *
 * 判据与 supabase/schema.sql 的约束、scripts/cms/snapshot.ts 的守卫保持一致；
 * 三处任一改动都要同步，否则前端放行、后端拒绝，又回到看不懂的失败。
 */
import type { Resource } from './resources';

/** 与快照 assertSlug 对齐，并额外要求纯小写 kebab：前台地址要能看、能口述、能分享 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$/;
export const SLUG_EXAMPLE = 'cnc-lathe-buying-guide';

export interface Issue {
    label: string;
    msg: string;
}

const isEmpty = (v: unknown): boolean =>
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (Array.isArray(v) && v.length === 0);

/**
 * 日期类字段按字段名判定，不按 type —— 它们在库里是 text（存裸 ISO 串，避免时区漂移），
 * 表单 type 也声明为 text，FieldType 里根本没有 date 这个取值。
 */
const DATE_FIELDS = new Set(['date', 'lastmod', 'modified']);

/** 返回全部问题（不只报第一个）：让运营一次改完，而不是保存失败五次才知道有五处 */
export function validateRow(resource: Resource, form: Record<string, unknown>): Issue[] {
    const issues: Issue[] = [];

    for (const f of resource.fields) {
        const v = form[f.name];
        const isId = !resource.singleton && f.name === resource.idField;

        /* 地址字段单独判定：留空与格式不对要分开说，且不能与 required 重复报两条 */
        if (isId) {
            const s = String(v ?? '').trim();
            if (!s) {
                issues.push({
                    label: f.label,
                    msg: `必须填写。只能用小写字母、数字和连字符，例如 ${SLUG_EXAMPLE}。留空会让整站发布失败。`,
                });
            } else if (!SLUG_RE.test(s)) {
                issues.push({
                    label: f.label,
                    msg: `「${s}」不合规则：不能有空格、中文、大写或斜杠，前后也不能是连字符。`,
                });
            }
            continue;
        }

        if (f.required && isEmpty(v)) {
            issues.push({ label: f.label, msg: '这是必填项，前台生成页面要用它。' });
            continue;
        }
        if (isEmpty(v) || typeof v !== 'string') continue;

        const len = v.trim().length;
        if (f.minLen != null && len < f.minLen) {
            issues.push({ label: f.label, msg: `太短了（当前 ${len} 字，至少 ${f.minLen} 字）。这一项会用作搜索结果和分享卡里的摘要。` });
        }
        if (f.maxLen != null && len > f.maxLen) {
            issues.push({ label: f.label, msg: `太长了（当前 ${len} 字，最多 ${f.maxLen} 字），超出的部分会被搜索引擎截断。` });
        }
        if (DATE_FIELDS.has(f.name) && v.trim() && !/^\d{4}-\d{2}-\d{2}/.test(v.trim())) {
            issues.push({ label: f.label, msg: `日期要写成 2026-10-30 这种形式（当前「${v.trim()}」）。` });
        }
    }
    return issues;
}

/**
 * 把 PostgREST 的英文错误翻成人话。
 * 前端已经拦过一轮，这里只兜并发写入、绕过界面直连接口等情况；
 * 原则是：宁可说得笼统，也不把表名、列名、约束名甩到界面上。
 */
export function explainDbError(err: { code?: string; message?: string }, resource: Resource): string {
    const m = err.message ?? '';

    /* 23505 unique_violation：地址撞车 */
    if (err.code === '23505' || /duplicate key/i.test(m)) {
        return `这个地址已经存在同名的${resource.singular}。请换一个，或回到列表编辑那一条。`;
    }
    /* 23502 not_null：必填列被绕过 */
    if (err.code === '23502' || /not-null constraint/i.test(m)) {
        const col = m.match(/column "([^"]+)"/)?.[1];
        const f = resource.fields.find((x) => x.name === col);
        return `「${f?.label ?? '某个必填项'}」没有填，它是前台生成页面必需的。`;
    }
    /* 23514 check：长度等取值范围 */
    if (err.code === '23514' || /check constraint/i.test(m)) {
        const col = m.match(/([a-z_]+?)_check/i)?.[1];
        const f = resource.fields.find((x) => x.name === col);
        return `「${f?.label ?? '某个字段'}」的内容不符合要求（多半是长度超出范围）。`;
    }
    return '保存失败。请把这条提示原样转给开发处理。';
}
