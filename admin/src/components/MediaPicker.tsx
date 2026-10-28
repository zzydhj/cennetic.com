/**
 * 媒体选择器：从 media_assets 里挑一张图，回传给调用方（正文插图、字段替换都用它）。
 * 与上传解耦——上传仍走 ImageField/MediaLibrary，这里只负责「选」。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ago, bytes } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from './Icon';
import { Button, EmptyState, IconInput, Skeleton } from './ui';
import { Modal } from './Overlay';

export interface MediaPick {
    src: string;
    alt: string;
    width?: number;
    height?: number;
}

interface MediaRow {
    id: string;
    key: string;
    public_url: string;
    alt: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
    created_at: string | null;
}

export function MediaPicker({
    open,
    onClose,
    onPick,
    title = '从媒体库插入',
}: {
    open: boolean;
    onClose: () => void;
    onPick: (pick: MediaPick) => void;
    title?: string;
}): JSX.Element {
    const [rows, setRows] = useState<MediaRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        supabase
            .from('media_assets')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                setRows((data as MediaRow[]) ?? []);
                setLoading(false);
            });
    }, [open]);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? rows.filter((r) => `${r.alt} ${r.key}`.toLowerCase().includes(s)) : rows;
    }, [rows, q]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            desc="点一张图即插入到正文末尾；需要新图请先去媒体库上传。"
            icon="image"
            size="lg"
            footer={
                <>
                    <span className="mr-auto text-[11px] text-slate-400">共 {rows.length} 张 · 显示 {list.length} 张</span>
                    <Button variant="ghost" onClick={onClose}>
                        关闭
                    </Button>
                </>
            }
        >
            <IconInput icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="按说明或文件名筛选…" className="mb-4" />
            {loading ? (
                <Skeleton rows={4} />
            ) : list.length === 0 ? (
                <EmptyState
                    icon="image"
                    title={q ? '没有匹配的图片' : '媒体库还是空的'}
                    desc={q ? '换个关键词试试。' : '去媒体库上传后回来这里挑选。'}
                    action={
                        !q ? (
                            // 路由内跳转：写成 /admin/media 这种绝对路径会整页刷新去请求
                            // 一个没有对应文件的地址，线上直接 404（后台深链接都靠 hash）。
                            <Link to="/media" onClick={onClose}>
                                <Button variant="secondary" icon="upload">
                                    去媒体库上传
                                </Button>
                            </Link>
                        ) : undefined
                    }
                />
            ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {list.map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                                onPick({ src: r.public_url, alt: r.alt, width: r.width ?? undefined, height: r.height ?? undefined });
                                onClose();
                            }}
                            className={cx(
                                'focus-ring group overflow-hidden rounded-xl border border-slate-200/80 bg-white text-left shadow-card transition-all duration-300 ease-expo',
                                'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift',
                            )}
                        >
                            <span className="relative block h-24 w-full overflow-hidden bg-slate-100">
                                <img
                                    src={r.public_url}
                                    alt={r.alt}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-500 ease-expo group-hover:scale-[1.04]"
                                />
                                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,22,0)_55%,rgba(6,11,22,.55)_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <Icon name="plus" className="h-2.5 w-2.5" />
                                    插入
                                </span>
                            </span>
                            <span className="block px-2.5 py-2">
                                <span className="block truncate text-[11px] font-medium text-slate-700">{r.alt || r.key}</span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] tabular-nums text-slate-400">
                                    {r.width && r.height ? `${r.width}×${r.height}` : '尺寸未知'}
                                    <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                    {bytes(r.bytes)}
                                    <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                    {ago(r.created_at)}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}
