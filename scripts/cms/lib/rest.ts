/**
 * PostgREST 最小客户端：seed（写）与 snapshot（读）共用一套传输实现。
 * 用 service/secret key 绕过 RLS；不引 SDK，保持脚本零额外依赖。
 */
export interface RestClient {
    /** 读取整表/过滤结果；query 直接是 PostgREST 查询串（如 select=*&status=eq.published） */
    list<T = Record<string, unknown>>(table: string, query?: string): Promise<T[]>;
    /** 按 onConflict 冲突键 upsert；空数组直接跳过 */
    upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void>;
    /** 各表行数，供快照前后自检 */
    count(table: string): Promise<number>;
}

export function createRestClient(baseUrl: string, key: string): RestClient {
    // 注意：不要把 Accept 放进公共头——写 'json' 会被 PostgREST 拒成 406，各接口自己给完整类型
    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
    };

    async function list<T>(table: string, query = 'select=*'): Promise<T[]> {
        const res = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
            headers: { ...headers, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`${table} 读取失败 HTTP ${res.status}: ${await res.text()}`);
        return (await res.json()) as T[];
    }

    return {
        list,

        async upsert(table, rows, onConflict) {
            if (rows.length === 0) {
                console.log(`  · ${table}: 0 行，跳过`);
                return;
            }
            const res = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
                method: 'POST',
                headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify(rows),
            });
            if (!res.ok) throw new Error(`${table} upsert 失败 HTTP ${res.status}: ${await res.text()}`);
            console.log(`  ✓ ${table}: ${rows.length} 行`);
        },

        async count(table) {
            const res = await fetch(`${baseUrl}/rest/v1/${table}?select=*`, {
                headers: { ...headers, Accept: 'application/json', Range: '0-0', Prefer: 'count=exact' },
            });
            if (!res.ok) throw new Error(`${table} 计数失败 HTTP ${res.status}: ${await res.text()}`);
            return Number((res.headers.get('content-range') ?? '').split('/')[1] ?? 0);
        },
    };
}
