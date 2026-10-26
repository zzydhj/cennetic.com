/**
 * FAQ 问答编辑器：把 jsonb 的 [{q,a}] 变成逐条输入框，运营永远不接触 JSON 原文。
 * 输出始终是数组（save 直接写 jsonb 列）；问或答没填完的条目由 save 统一过滤，不进库。
 */
import { Icon } from './Icon';
import { Button, Input, Textarea } from './ui';

interface Item {
    q: string;
    a: string;
}

/** 兼容两种来路：jsonb 解析后的数组、历史遗留的 JSON 文本；其余形态一律当坏数据报错，不静默清空 */
function normalize(value: unknown): { items: Item[] | null; error?: string } {
    if (value == null || value === '') return { items: [] };
    let raw: unknown = value;
    if (typeof value === 'string') {
        const t = value.trim();
        if (!t) return { items: [] };
        try {
            raw = JSON.parse(t);
        } catch {
            return { items: null, error: '现有 FAQ 数据不是合法 JSON，为避免改坏请联系开发处理。' };
        }
    }
    if (!Array.isArray(raw)) return { items: null, error: '现有 FAQ 数据不是数组形态，为避免改坏请联系开发处理。' };
    const items: Item[] = [];
    for (const x of raw) {
        const o = x as Record<string, unknown> | null;
        if (typeof o !== 'object' || o === null || typeof o.q !== 'string' || typeof o.a !== 'string') {
            return { items: null, error: '现有 FAQ 数据里有问答不完整（缺问或缺答），为避免改坏请联系开发处理。' };
        }
        items.push({ q: o.q, a: o.a });
    }
    return { items };
}

export function FaqField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }): JSX.Element {
    const { items, error } = normalize(value);

    if (error) {
        return (
            <div className="flex items-start gap-2.5 rounded-lg bg-accent-soft px-3.5 py-2.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/20">
                <Icon name="alert" className="mt-px h-4 w-4 shrink-0" />
                <span>{error}</span>
            </div>
        );
    }

    const list = items ?? [];
    const edit = (i: number, patch: Partial<Item>): void => onChange(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    const remove = (i: number): void => onChange(list.filter((_, k) => k !== i));

    return (
        <div className="space-y-2.5">
            {list.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-[11px] text-slate-400">
                    还没有问答。添加后可能以可展开下拉出现在 Google 搜索结果下方，页面末尾也会渲染问答区。
                </p>
            )}
            {list.map((it, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200/90 bg-white p-3 shadow-inner">
                    <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-100">
                            Q{i + 1}
                        </span>
                        <Input value={it.q} placeholder="问题，例如：整机保修多久？" onChange={(e) => edit(i, { q: e.target.value })} />
                        <button
                            type="button"
                            onClick={() => remove(i)}
                            aria-label={`删除第 ${i + 1} 条问答`}
                            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-accent-soft hover:text-accent"
                        >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <Textarea rows={2} value={it.a} placeholder="答案…" onChange={(e) => edit(i, { a: e.target.value })} />
                </div>
            ))}
            <div className="flex items-center gap-2">
                <Button variant="secondary" icon="plus" onClick={() => onChange([...list, { q: '', a: '' }])}>
                    加一条问答
                </Button>
                <span className="text-[11px] text-slate-400">共 {list.length} 条 · 问与答都没填完的不会保存</span>
            </div>
        </div>
    );
}
