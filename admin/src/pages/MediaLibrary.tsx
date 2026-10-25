import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadMedia, deleteMedia, imageDims } from '../lib/media';
import { Button, Card } from '../components/ui';

interface MediaRow {
    id: string;
    key: string;
    public_url: string;
    alt: string;
}

export default function MediaLibrary() {
    const [rows, setRows] = useState<MediaRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = (): void => {
        void supabase
            .from('media_assets')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => setRows((data as MediaRow[]) ?? []));
    };
    useEffect(load, []);

    async function handleFiles(files: FileList): Promise<void> {
        setBusy(true);
        setErr(null);
        try {
            for (const f of Array.from(files)) {
                if (!f.type.startsWith('image/')) continue;
                const { width, height } = await imageDims(f);
                const up = await uploadMedia(f);
                const { error } = await supabase
                    .from('media_assets')
                    .insert({ key: up.key, public_url: up.url, alt: f.name.replace(/\.[^.]+$/, ''), width, height, bytes: up.bytes, mime: up.contentType });
                if (error) throw new Error(error.message);
            }
            load();
        } catch (e) {
            setErr(e instanceof Error ? e.message : '上传失败');
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    async function copy(url: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            /* 忽略：部分浏览器需 https/用户手势 */
        }
    }

    async function del(row: MediaRow): Promise<void> {
        if (!confirm('删除该图片？前台引用处会失效。')) return;
        await deleteMedia(row.key);
        await supabase.from('media_assets').delete().eq('id', row.id);
        setRows((rs) => rs.filter((r) => r.id !== row.id));
    }

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">媒体库</h2>
                <div className="flex items-center gap-2">
                    <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
                    <Button onClick={() => inputRef.current?.click()} disabled={busy}>
                        {busy ? '上传中…' : '上传图片'}
                    </Button>
                </div>
            </div>
            {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
            <p className="mb-4 text-sm text-slate-500">上传后点“复制链接”，写 Blog/产品时把链接粘贴到正文即可。</p>
            {rows.length === 0 ? (
                <p className="text-slate-400">还没有图片。</p>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {rows.map((r) => (
                        <Card key={r.id} className="overflow-hidden">
                            <img src={r.public_url} alt={r.alt} className="h-32 w-full object-cover" />
                            <div className="p-2 text-xs">
                                <div className="truncate text-slate-500" title={r.public_url}>
                                    {r.public_url}
                                </div>
                                <div className="mt-2 flex gap-3">
                                    <button className="text-brand hover:underline" onClick={() => void copy(r.public_url)}>
                                        复制链接
                                    </button>
                                    <button className="text-red-500 hover:underline" onClick={() => void del(r)}>
                                        删除
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
