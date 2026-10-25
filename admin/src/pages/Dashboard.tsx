import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NAV } from '../lib/resources';
import { Card } from '../components/ui';

export default function Dashboard() {
    const [counts, setCounts] = useState<Record<string, number | null>>({});

    useEffect(() => {
        NAV.forEach(async (r) => {
            const { count } = await supabase.from(r.table).select('*', { count: 'exact', head: true });
            setCounts((c) => ({ ...c, [r.key]: count }));
        });
    }, []);

    return (
        <div>
            <h2 className="mb-4 text-lg font-semibold">内容概览</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {NAV.map((r) => (
                    <Link key={r.key} to={`/${r.key}`}>
                        <Card className="p-4 transition hover:border-brand">
                            <div className="text-2xl font-bold text-brand">{counts[r.key] ?? '–'}</div>
                            <div className="text-sm text-slate-500">{r.label}</div>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
