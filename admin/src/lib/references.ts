/**
 * 引用索引：算出「某张图被哪些内容用着」。
 * 只在媒体库点「检查引用」时按需跑一次（要读全部正文，不该在页面加载时白占流量）。
 * 匹配口径与前台一致：站内相对路径 /images/... 与 R2 绝对地址 https://media.cennetic.com/...
 */
import { supabase } from './supabase';
import { NAV } from './resources';

/** key → 使用者清单（「文章 · 标题」这种可读形态） */
export type RefIndex = Map<string, string[]>;

/** 图片/视频地址的候选 token：绝对 URL 或站内 /images/ 路径 */
const TOKEN = /(?:https?:\/\/[^\s"'()<>\\]+|\/images\/[^\s"'()<>\\]+)/g;

/** R2 公网域名 → key 的前缀映射；不匹配的就当站内相对路径处理 */
function keyOf(token: string): string | null {
    const raw = token.replace(/[.,;]$/, '');
    if (raw.startsWith('/images/')) return raw.slice(1);
    try {
        if (/^https?:\/\//.test(raw)) {
            const u = new URL(raw);
            if (u.hostname.startsWith('media.')) return u.pathname.replace(/^\/+/, '');
            return null; // 外链（第三方图床）不计入本站资产
        }
    } catch {
        return null;
    }
    return null;
}

export async function buildReferenceIndex(): Promise<RefIndex> {
    const index: RefIndex = new Map();
    const add = (key: string | null, who: string): void => {
        if (!key) return;
        const cur = index.get(key);
        if (cur) {
            if (!cur.includes(who)) cur.push(who);
        } else {
            index.set(key, [who]);
        }
    };

    // 内容表：标题列名不同，但都是「整行序列化后扫 token」
    const tables = [...NAV.map((r) => ({ table: r.table, label: r.label, titleField: r.titleField })), { table: 'site_settings', label: '站点设置', titleField: 'id' }];

    for (const t of tables) {
        const { data } = await supabase.from(t.table).select('*');
        const rows = (data as unknown as Array<Record<string, unknown>>) ?? [];
        for (const row of rows) {
            const who = `${t.label} · ${String(row[t.titleField] ?? row.slug ?? t.label)}`;
            const hay = JSON.stringify(row);
            for (const m of hay.matchAll(TOKEN)) add(keyOf(m[0]), who);
        }
    }
    return index;
}

/** key 属于哪个来源：uploads/ 前缀是后台上传进 R2 的，其余是仓库里的静态资源 */
export function sourceOf(key: string): 'r2' | 'repo' {
    return key.startsWith('uploads/') ? 'r2' : 'repo';
}
