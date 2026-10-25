import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sanitizeHtml } from '../lib/sanitize';
import type { Field, Resource } from '../lib/resources';
import { Button, Card, Input, Select, Textarea } from '../components/ui';

type Row = Record<string, unknown>;

function renderCell(v: unknown): string {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? '是' : '否';
    return String(v);
}

function previewHref(resource: Resource, row: Row): string {
    const origin = window.location.origin;
    const canon = row.canonical;
    if (typeof canon === 'string' && canon) return origin + canon;
    const slug = String(row[resource.idField] ?? '');
    return origin + (resource.key === 'products' ? `/product/${slug}/` : `/${slug}/`);
}

export default function ResourceList({ resource }: { resource: Resource }) {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [draft, setDraft] = useState<Row | null>(null);
    const [saving, setSaving] = useState(false);

    const quickFields = useMemo(() => resource.fields.filter((f) => f.quick), [resource]);

    useEffect(() => {
        setLoading(true);
        supabase
            .from(resource.table)
            .select('*')
            .order(resource.orderBy, { ascending: resource.ascending ?? true })
            .then(({ data, error }) => {
                if (error) console.error(error.message);
                setRows((data as Row[]) ?? []);
                setLoading(false);
            });
    }, [resource]);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter((r) => String(r[resource.titleField] ?? '').toLowerCase().includes(s));
    }, [rows, q, resource]);

    const openQuick = (row: Row): void => {
        const key = String(row[resource.idField]);
        if (expanded === key) {
            setExpanded(null);
            return;
        }
        setExpanded(key);
        setDraft({ ...row });
    };

    async function saveQuick(): Promise<void> {
        if (!draft) return;
        setSaving(true);
        const payload: Row = { [resource.idField]: draft[resource.idField] };
        for (const f of quickFields) {
            let v = draft[f.name];
            if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
            if (f.type === 'html' && typeof v === 'string') v = sanitizeHtml(v);
            payload[f.name] = v ?? null;
        }
        const { error } = await supabase.from(resource.table).upsert(payload, { onConflict: resource.idField });
        setSaving(false);
        if (error) {
            alert('保存失败：' + error.message);
            return;
        }
        setRows((rs) => rs.map((r) => (String(r[resource.idField]) === String(payload[resource.idField]) ? { ...r, ...payload } : r)));
        setExpanded(null);
    }

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{resource.label}</h2>
                <div className="flex items-center gap-2">
                    <Input placeholder="搜索…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
                    <Link to={`/${resource.key}/new`}>
                        <Button>新建</Button>
                    </Link>
                </div>
            </div>
            <Card className="overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                            {resource.listCols.map((c) => (
                                <th key={c.name} className="px-4 py-2 font-medium">
                                    {c.label}
                                </th>
                            ))}
                            <th className="px-4 py-2 text-right font-medium">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => {
                            const key = String(r[resource.idField]);
                            const isOpen = expanded === key;
                            return (
                                <Fragment key={key}>
                                    <tr className="border-t border-slate-100 hover:bg-slate-50">
                                        {resource.listCols.map((c) => (
                                            <td key={c.name} className="px-4 py-2">
                                                {renderCell(r[c.name])}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-3">
                                                <Link to={`/${resource.key}/${encodeURIComponent(key)}`} className="text-brand hover:underline">
                                                    编辑
                                                </Link>
                                                {resource.preview && (
                                                    <a href={previewHref(resource, r)} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">
                                                        预览
                                                    </a>
                                                )}
                                                {quickFields.length > 0 && (
                                                    <button onClick={() => openQuick(r)} className="text-slate-500 hover:underline">
                                                        快改
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {isOpen && draft && (
                                        <tr className="bg-slate-50/70">
                                            <td colSpan={resource.listCols.length + 1} className="px-4 py-3">
                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    {quickFields.map((f) => (
                                                        <div key={f.name} className={f.full ? 'md:col-span-2' : ''}>
                                                            <div className="mb-1 text-xs font-medium text-slate-500">{f.label}</div>
                                                            <QuickInput field={f} value={draft[f.name]} onChange={(v) => setDraft((d) => ({ ...(d ?? {}), [f.name]: v }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <Button onClick={saveQuick} disabled={saving}>
                                                        {saving ? '保存中…' : '保存快改'}
                                                    </Button>
                                                    <Button variant="ghost" onClick={() => setExpanded(null)}>
                                                        取消
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={resource.listCols.length + 1} className="px-4 py-8 text-center text-slate-400">
                                    暂无数据
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

function QuickInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
    if (field.type === 'select') {
        return (
            <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                {(field.options ?? []).map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </Select>
        );
    }
    if (field.type === 'html' || field.type === 'textarea') {
        return <Textarea rows={2} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    }
    if (field.type === 'number') {
        return <Input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
    }
    return <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}
