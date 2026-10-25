/**
 * 后台的「读数」层：内容计数、最近改动、最后一次改动时间。
 * 这些查询侧栏、顶栏通知、仪表盘都要用，所以做模块级缓存 —— 一次登录只打一轮。
 * 表名/标题列全部从 resources.ts 反推，将来加一类内容不用改这里。
 */
import { supabase } from './supabase';
import { NAV, type Resource } from './resources';

export interface ResourceCount {
    total: number;
    /** 没有 status 列的类型恒为 0 */
    draft: number;
}

export interface FeedItem {
    key: string;
    resource: Resource;
    id: string;
    title: string;
    status: string | null;
    updatedAt: string | null;
}

let countCache: Record<string, ResourceCount> | null = null;
let feedCache: FeedItem[] | null = null;
let mediaCache: { items: number; bytes: number } | null = null;
let trendCache: TrendRow[] | null = null;

/** 强制重取（发布完或保存完可以调一下，读数才不会被缓存冻住） */
export function invalidateReadouts(): void {
    countCache = null;
    feedCache = null;
    mediaCache = null;
    trendCache = null;
}

const hasStatus = (r: Resource): boolean => r.fields.some((f) => f.name === 'status');

export async function fetchCounts(): Promise<Record<string, ResourceCount>> {
    if (countCache) return countCache;
    const entries = await Promise.all(
        NAV.map(async (r): Promise<[string, ResourceCount]> => {
            const base = supabase.from(r.table).select('*', { count: 'exact', head: true });
            const { count: total } = await base;
            let draft = 0;
            if (hasStatus(r)) {
                const { count } = await supabase
                    .from(r.table)
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'draft');
                draft = count ?? 0;
            }
            return [r.key, { total: total ?? 0, draft }];
        }),
    );
    countCache = Object.fromEntries(entries);
    return countCache;
}

/** 各内容表最近 3 条 → 合并成一条时间线（顶栏通知与仪表盘「最近改动」共用） */
export async function fetchFeed(limit = 12): Promise<FeedItem[]> {
    if (feedCache) return feedCache.slice(0, limit);
    const groups = await Promise.all(
        NAV.map(async (r): Promise<FeedItem[]> => {
            const { data } = await supabase
                .from(r.table)
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(3);
            return ((data as Array<Record<string, unknown>>) ?? []).map((row) => ({
                key: `${r.key}:${String(row[r.idField])}`,
                resource: r,
                id: String(row[r.idField] ?? ''),
                title: String(row[r.titleField] ?? row[r.idField] ?? '(未命名)'),
                status: typeof row.status === 'string' ? row.status : null,
                updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
            }));
        }),
    );
    feedCache = groups
        .flat()
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(0, 24);
    return feedCache.slice(0, limit);
}

/** 媒体库体量：张数与总字节 */
export async function fetchMediaStats(): Promise<{ items: number; bytes: number }> {
    if (mediaCache) return mediaCache;
    const { data, count } = await supabase.from('media_assets').select('bytes', { count: 'exact' });
    const bytes = (data ?? []).reduce((a, r) => a + (Number((r as { bytes?: number }).bytes) || 0), 0);
    mediaCache = { items: count ?? 0, bytes };
    return mediaCache;
}

/** 全站最后一次内容改动时间（发布状态判断的基准） */
export async function fetchLatestChange(): Promise<string | null> {
    const feeds = await fetchFeed(24);
    return feeds[0]?.updatedAt ?? null;
}

export interface TrendRow {
    /** 内容类型 label，供图例与分组 */
    kind: string;
    updatedAt: string | null;
    /** 只有 articles / pages 有 date（前台发布日期）；其余为 null */
    publishDate: string | null;
}

/**
 * 趋势图的数据底：每张表只取 updated_at（和存在时的 date）。
 * 两张图共用一份：「内容改动」按 updated_at 分月，「发布产出」按 date 分月。
 */
export async function fetchTrendRows(): Promise<TrendRow[]> {
    if (trendCache) return trendCache;
    const groups = await Promise.all(
        NAV.map(async (r): Promise<TrendRow[]> => {
            const hasDate = r.fields.some((f) => f.name === 'date');
            const cols = hasDate ? 'updated_at,date' : 'updated_at';
            const { data } = await supabase.from(r.table).select(cols);
            return ((data as unknown as Array<Record<string, unknown>>) ?? []).map((row) => ({
                kind: r.label,
                updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
                publishDate: hasDate && typeof row.date === 'string' ? row.date : null,
            }));
        }),
    );
    trendCache = groups.flat();
    return trendCache;
}
