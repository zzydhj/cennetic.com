import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Resource } from '../lib/resources';
import { Button, Card, Input } from '../components/ui';

type Row = Record<string, unknown>;

function renderCell(v: unknown): string {
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? '是' : '否';
    return String(v);
}

export default function ResourceList({ resource }: { resource: Resource }) {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');

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
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={String(r[resource.idField])} className="border-t border-slate-100 hover:bg-slate-50">
                                {resource.listCols.map((c) => (
                                    <td key={c.name} className="px-4 py-2">
                                        {renderCell(r[c.name])}
                                    </td>
                                ))}
                                <td className="px-4 py-2 text-right">
                                    <Link
                                        to={`/${resource.key}/${encodeURIComponent(String(r[resource.idField]))}`}
                                        className="text-brand hover:underline"
                                    >
                                        编辑
                                    </Link>
                                </td>
                            </tr>
                        ))}
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
