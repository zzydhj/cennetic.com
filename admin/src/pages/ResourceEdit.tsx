import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizeHtml } from '../lib/sanitize';
import type { Field, Resource } from '../lib/resources';
import { Button, Card, Input, Label, Select, Textarea } from '../components/ui';

type Row = Record<string, unknown>;
interface RefOpt {
    value: string;
    label: string;
}

function defaults(resource: Resource): Row {
    const r: Row = {};
    for (const f of resource.fields) {
        if (f.type === 'boolean') r[f.name] = false;
        else if (f.type === 'tags') r[f.name] = [];
        else if (f.type === 'json') r[f.name] = f.name === 'data' ? '{}' : '[]';
        else if (f.type === 'ref' && f.multiple) r[f.name] = [];
        else if (f.type === 'select') r[f.name] = f.options?.[0] ?? '';
        else r[f.name] = '';
    }
    return r;
}

export default function ResourceEdit({ resource }: { resource: Resource }) {
    const params = useParams();
    const nav = useNavigate();
    const id = resource.singleton ? undefined : params.id;
    const isNew = !resource.singleton && !id;

    const [form, setForm] = useState<Row>({});
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refs, setRefs] = useState<Record<string, RefOpt[]>>({});

    const refFields = useMemo(() => resource.fields.filter((f) => f.type === 'ref'), [resource]);

    useEffect(() => {
        refFields.forEach(async (f) => {
            const { data } = await supabase.from(f.refTable!).select(`${f.refValue},${f.refLabel}`);
            const opts = ((data as unknown as Row[]) ?? []).map((r) => ({
                value: String(r[f.refValue!]),
                label: String(r[f.refLabel!] ?? r[f.refValue!]),
            }));
            setRefs((prev) => ({ ...prev, [f.name]: opts }));
        });
    }, [refFields]);

    useEffect(() => {
        if (isNew) {
            setForm(defaults(resource));
            setLoading(false);
            return;
        }
        setLoading(true);
        const query = resource.singleton
            ? supabase.from(resource.table).select('*').limit(1)
            : supabase.from(resource.table).select('*').eq(resource.idField, decodeURIComponent(id!)).limit(1);
        query.then(({ data, error: e }) => {
            if (e) setError(e.message);
            const row = (data as Row[])?.[0];
            setForm(row ? { ...row } : defaults(resource));
            setLoading(false);
        });
    }, [resource, id, isNew]);

    const setVal = (name: string, v: unknown): void => setForm((f) => ({ ...f, [name]: v }));

    async function save(): Promise<void> {
        setSaving(true);
        setError(null);
        const payload: Row = {};
        for (const f of resource.fields) {
            let v = form[f.name];
            if (f.type === 'json' && typeof v === 'string') {
                const trimmed = v.trim();
                if (trimmed) {
                    try {
                        JSON.parse(trimmed);
                    } catch {
                        setSaving(false);
                        setError(`「${f.label}」不是合法 JSON`);
                        return;
                    }
                }
                // data 列是 text（存 site.json 原文）；其余 json 列存解析后的对象/数组
                v = f.name === 'data' ? trimmed : trimmed ? JSON.parse(trimmed) : [];
            }
            if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
            if (f.type === 'html' && typeof v === 'string') v = sanitizeHtml(v);
            payload[f.name] = v ?? null;
        }
        if (resource.singleton) payload.id = true;
        const { error: e } = await supabase.from(resource.table).upsert(payload, { onConflict: resource.idField });
        setSaving(false);
        if (e) {
            setError(e.message);
            return;
        }
        nav(`/${resource.key}`);
    }

    async function remove(): Promise<void> {
        if (resource.singleton || !id) return;
        if (!confirm('确定删除这条记录？此操作不可撤销。')) return;
        const { error: e } = await supabase.from(resource.table).delete().eq(resource.idField, decodeURIComponent(id));
        if (e) setError(e.message);
        else nav(`/${resource.key}`);
    }

    if (loading) return <div className="text-slate-400">加载中…</div>;

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to={`/${resource.key}`} className="text-sm text-slate-500 hover:underline">
                        ← 返回{resource.label}
                    </Link>
                    <h2 className="text-lg font-semibold">
                        {isNew ? `新建${resource.singular}` : `编辑${resource.singular}`}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {!resource.singleton && !isNew && (
                        <Button variant="danger" onClick={remove}>
                            删除
                        </Button>
                    )}
                    <Button onClick={save} disabled={saving}>
                        {saving ? '保存中…' : '保存'}
                    </Button>
                </div>
            </div>
            {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Card className="p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {resource.fields.map((f) => (
                        <div key={f.name} className={f.full ? 'md:col-span-2' : ''}>
                            <FieldInput field={f} value={form[f.name]} options={refs[f.name] ?? []} onChange={(v) => setVal(f.name, v)} />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function FieldInput({
    field,
    value,
    options,
    onChange,
}: {
    field: Field;
    value: unknown;
    options: RefOpt[];
    onChange: (v: unknown) => void;
}) {
    const label = (
        <Label>
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
            {field.hint && <span className="ml-2 text-xs font-normal text-slate-400">{field.hint}</span>}
            {field.help && (
                <span className="group relative ml-1.5 inline-flex align-middle">
                    <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-white">
                        ?
                    </span>
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-64 -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block">
                        {field.help}
                    </span>
                </span>
            )}
        </Label>
    );

    switch (field.type) {
        case 'boolean':
            return (
                <label className="flex items-center gap-2 pt-6">
                    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
                    <span className="text-sm">{field.label}</span>
                </label>
            );
        case 'select':
            return (
                <div>
                    {label}
                    <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                        {(field.options ?? []).map((o) => (
                            <option key={o} value={o}>
                                {o}
                            </option>
                        ))}
                    </Select>
                </div>
            );
        case 'ref':
            if (field.multiple) {
                const arr = Array.isArray(value) ? (value as string[]) : [];
                return (
                    <div>
                        {label}
                        <div className="max-h-40 overflow-auto rounded-md border border-slate-300 p-2">
                            {options.map((o) => (
                                <label key={o.value} className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={arr.includes(o.value)}
                                        onChange={(e) =>
                                            onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))
                                        }
                                    />
                                    {o.label}
                                </label>
                            ))}
                        </div>
                    </div>
                );
            }
            return (
                <div>
                    {label}
                    <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                        <option value="">（无）</option>
                        {options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Select>
                </div>
            );
        case 'tags': {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            return (
                <div>
                    {label}
                    <Textarea
                        rows={3}
                        mono
                        value={arr.join('\n')}
                        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                    />
                </div>
            );
        }
        case 'json': {
            const text = typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2);
            return (
                <div>
                    {label}
                    <Textarea rows={10} mono value={text} onChange={(e) => onChange(e.target.value)} />
                </div>
            );
        }
        case 'html':
            return (
                <div>
                    {label}
                    <Textarea rows={16} mono value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
                    {field.sample && (
                        <details className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                            <summary className="cursor-pointer select-none font-medium text-slate-600">
                                查看 / 插入 HTML 示例模板（不知道怎么写就点这个）
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-600">
                                {field.sample}
                            </pre>
                            <button
                                type="button"
                                className="mt-2 rounded bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark"
                                onClick={() => {
                                    if (String(value ?? '').trim() && !confirm('上方已有内容，插入模板会覆盖，继续？')) return;
                                    onChange(field.sample);
                                }}
                            >
                                插入模板到上方编辑框
                            </button>
                        </details>
                    )}
                </div>
            );
        case 'textarea':
            return (
                <div>
                    {label}
                    <Textarea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
                </div>
            );
        case 'number':
            return (
                <div>
                    {label}
                    <Input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />
                </div>
            );
        default:
            return (
                <div>
                    {label}
                    <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
                </div>
            );
    }
}
