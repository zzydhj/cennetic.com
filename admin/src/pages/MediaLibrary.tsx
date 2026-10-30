/**
 * 媒体库：站点图片资产的浏览与录入。
 * 两个来源共存，语义不同，删除时必须分开处理：
 *   · uploads/…  后台上传进 R2 的，删记录同时删桶内对象
 *   · images/…   仓库 public/images 里的静态资源（由 register-media 脚本登记），
 *                文件受 git 管，这里只能「从媒体库移除」，不能删文件
 * 上传链路复用 lib/media（浏览器侧压缩 → POST /api/media/upload → 自动登记）。
 * 注意：本地 vite 不带 Pages Function，上传只在部署环境可用。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { friendlyDbMessage } from '../lib/validate';
import { deleteMedia, uploadImage } from '../lib/media';
import { invalidateReadouts } from '../lib/readouts';
import { buildReferenceIndex, sourceOf, type RefIndex } from '../lib/references';
import { ago, bytes, date, num } from '../lib/format';
import { cx } from '../lib/cx';
import { Icon } from '../components/Icon';
import {
    Badge,
    Button,
    Card,
    EmptyState,
    IconButton,
    PageHeader,
    SegmentedControl,
    Skeleton,
    Tooltip,
} from '../components/ui';
import { ConfirmDialog } from '../components/Overlay';
import { MiniStat } from '../components/Stats';
import { useToast } from '../components/Toast';

interface MediaRow {
    id: string;
    key: string;
    public_url: string;
    alt: string;
    width: number | null;
    height: number | null;
    bytes: number | null;
    mime: string | null;
    created_at: string | null;
}

type View = 'grid' | 'list';
type Filter = 'all' | 'repo' | 'r2' | 'used' | 'free';

export default function MediaLibrary() {
    const toast = useToast();
    const [rows, setRows] = useState<MediaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [drag, setDrag] = useState(false);
    const [q, setQ] = useState('');
    const [view, setView] = useState<View>('grid');
    const [filter, setFilter] = useState<Filter>('all');
    const [limit, setLimit] = useState(60);
    const [refs, setRefs] = useState<RefIndex | null>(null);
    const [checking, setChecking] = useState(false);
    const [askDel, setAskDel] = useState<MediaRow | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = (): void => {
        setLoading(true);
        supabase
            .from('media_assets')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) toast.fail('读取媒体库失败', friendlyDbMessage(error));
                setRows((data as MediaRow[]) ?? []);
                setLoading(false);
            });
    };
    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    const total = useMemo(() => rows.reduce((a, r) => a + (r.bytes ?? 0), 0), [rows]);
    const repoCount = useMemo(() => rows.filter((r) => sourceOf(r.key) === 'repo').length, [rows]);
    const usedCount = useMemo(() => (refs ? rows.filter((r) => (refs.get(r.key) ?? []).length > 0).length : 0), [refs, rows]);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        let out = rows;
        if (s) out = out.filter((r) => `${r.alt} ${r.key}`.toLowerCase().includes(s));
        if (filter !== 'all') {
            out = out.filter((r) => {
                const used = (refs?.get(r.key) ?? []).length > 0;
                if (filter === 'used') return used;
                if (filter === 'free') return !used;
                return sourceOf(r.key) === filter;
            });
        }
        return out;
    }, [rows, q, filter, refs]);

    /* 347+ 张一次全渲染会卡，分批放出来 */
    const visible = useMemo(() => list.slice(0, limit), [list, limit]);
    useEffect(() => setLimit(60), [q, filter, view]);

    /** 引用气泡：检测过才点名使用者，没检测就如实说没检测 */
    const refTip = (key: string): string => {
        if (!refs) return '尚未检测引用。点右上「检查引用」会读一遍全部正文，算出这张图被哪些内容用到。';
        const users = refs.get(key) ?? [];
        if (users.length === 0) return '没有内容引用这张图，移除它不会影响前台。';
        return `被 ${users.length} 处内容使用：${users.slice(0, 5).join('、')}${users.length > 5 ? ' 等' : ''}`;
    };

    /** 按需算引用：要读全部正文，不能跟着页面加载白跑 */
    async function checkRefs(): Promise<void> {
        setChecking(true);
        try {
            const idx = await buildReferenceIndex();
            setRefs(idx);
            const hit = rows.filter((r) => (idx.get(r.key) ?? []).length > 0).length;
            toast.ok('引用检测完成', `${hit} 张正在被内容使用，${rows.length - hit} 张暂无引用`);
        } catch (e) {
            toast.fail('检测失败', e instanceof Error ? e.message : '未知错误');
        } finally {
            setChecking(false);
        }
    }

    async function handleFiles(files: FileList): Promise<void> {
        setBusy(true);
        let ok = 0;
        let unregistered = 0;
        try {
            for (const f of Array.from(files)) {
                if (!f.type.startsWith('image/')) continue;
                const up = await uploadImage(f); // 上传与登记已在 lib/media 里一次做完
                ok += 1;
                if (!up.registered) unregistered += 1;
            }
            invalidateReadouts();
            load();
            toast.ok(ok > 0 ? `已上传 ${ok} 张` : '没有可上传的图片', ok > 0 ? (unregistered > 0 ? `其中 ${unregistered} 张没能登记进列表，刷新后仍在桶里` : '可直接复制链接写进正文') : '只接受图片文件');
        } catch (e) {
            toast.fail('上传失败', e instanceof Error ? e.message : '未知错误');
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    }

    async function copy(row: MediaRow): Promise<void> {
        try {
            await navigator.clipboard.writeText(row.public_url);
            toast.ok('已复制链接', row.key);
        } catch {
            toast.fail('复制失败', '浏览器未授权剪贴板，可长按选中地址手动复制');
        }
    }

    /** R2 对象：先删文件再删记录（文件删不掉就保留记录，不留孤儿）；仓库静态资源：只从媒体库移除，文件仍受 git 管 */
    async function del(target: MediaRow): Promise<void> {
        setAskDel(null);
        const isR2 = sourceOf(target.key) === 'r2';
        if (isR2) {
            try {
                await deleteMedia(target.key);
            } catch (e) {
                toast.fail('未删除', e instanceof Error ? e.message : '云端文件没删掉，记录已保留');
                return;
            }
        }
        const { error } = await supabase.from('media_assets').delete().eq('id', target.id);
        if (error) {
            toast.fail('删除失败', friendlyDbMessage(error));
            return;
        }
        invalidateReadouts();
        setRows((rs) => rs.filter((r) => r.id !== target.id));
        toast.ok(isR2 ? '已删除图片' : '已从媒体库移除', isR2 ? `${target.key} · 引用它的内容会变成破图` : '文件仍在站内目录里，要彻底删除请联系开发');
    }

    return (
        <div>
            <PageHeader
                kicker="资产中心"
                title="媒体库"
                desc="所有正文与产品图集都从这里取链接；超过 400KB 或长边 1600px 会自动转 WebP。"
                meta={
                    <>
                        <Badge tone="blue" icon="image">
                            {num(rows.length)} 张
                        </Badge>
                        <Badge tone="slate" icon="download">
                            合计 {bytes(total)}
                        </Badge>
                        <Badge tone="slate" icon="folder">
                            站内静态 {num(repoCount)} 张
                        </Badge>
                        <Badge tone="gold" icon="database">
                            后台上传 {num(rows.length - repoCount)} 张
                        </Badge>
                        <Tooltip text="引用＝这张图被多少条内容（文章/页面/产品/站点配置）的正文或字段用到。点右上「检查引用」现算，不会自动跑。">
                            <Badge tone={refs ? (usedCount > 0 ? 'green' : 'amber') : 'slate'} icon="link">
                                {refs ? `${num(usedCount)} 张在用` : '未检测引用'}
                            </Badge>
                        </Tooltip>
                    </>
                }
                actions={
                    <>
                        <IconButton icon="refresh" label="重新读取" onClick={load} />
                        <Button variant="secondary" icon="search" loading={checking} onClick={() => void checkRefs()}>
                            {refs ? '重新检查引用' : '检查引用'}
                        </Button>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            hidden
                            onChange={(e) => e.target.files && void handleFiles(e.target.files)}
                        />
                        <Button icon="upload" loading={busy} onClick={() => inputRef.current?.click()}>
                            {busy ? '上传中' : '上传图片'}
                        </Button>
                    </>
                }
            />

            {/* 拖拽区 */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
                }}
                className={cx(
                    'mb-5 flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-5 transition-all duration-300 ease-expo',
                    drag
                        ? 'border-brand-400 bg-brand-50/70 shadow-glow'
                        : 'border-slate-200 bg-white/70 hover:border-brand-200 hover:bg-white',
                )}
            >
                <span
                    className={cx(
                        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                        drag ? 'bg-brand-700 text-white shadow-glow' : 'bg-[linear-gradient(160deg,#eff4fb,#dbe6f5)] text-brand-600 ring-1 ring-inset ring-brand-100',
                    )}
                >
                    <Icon name={drag ? 'download' : 'upload'} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800">{drag ? '松手即可上传' : '把图片拖到这里，或点右侧「上传图片」'}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                        支持多选；大图自动压缩为 WebP（长边 1600px）。上传后可直接复制链接粘进正文，或在编辑页用「插图」按钮挑选。
                    </p>
                </div>
                {busy && <Badge tone="blue" dot>处理中</Badge>}
            </div>

            <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
                <span className="relative block w-full sm:w-72">
                    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="按说明或文件名筛选…"
                        className="focus-ring h-[38px] w-full rounded-lg border border-slate-200/90 bg-white pl-9 pr-3 text-sm shadow-inner transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400"
                    />
                </span>
                <SegmentedControl<Filter>
                    value={filter}
                    onChange={setFilter}
                    size="sm"
                    options={[
                        { value: 'all', label: '全部', count: rows.length },
                        { value: 'repo', label: '站内', count: repoCount },
                        { value: 'r2', label: '上传', count: rows.length - repoCount },
                        { value: 'used', label: '在用', count: refs ? usedCount : undefined },
                        { value: 'free', label: '未引用', count: refs ? rows.length - usedCount : undefined },
                    ]}
                />
                <SegmentedControl<View>
                    value={view}
                    onChange={setView}
                    options={[
                        { value: 'grid', label: '网格', icon: 'grid' },
                        { value: 'list', label: '列表', icon: 'list' },
                    ]}
                />
                <span className="ml-auto text-[11px] text-slate-400">
                    显示 {Math.min(limit, list.length)} / {list.length} 张
                </span>
            </Card>

            {loading ? (
                <Card className="p-5">
                    <Skeleton rows={6} />
                </Card>
            ) : list.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="image"
                        title={q ? '没有匹配的图片' : '媒体库还是空的'}
                        desc={q ? '换个关键词试试，或清空筛选看全部。' : '把产品图、车间照、文章配图拖进上面的虚线区就能入库。'}
                        action={
                            q ? (
                                <Button variant="secondary" icon="close" onClick={() => setQ('')}>
                                    清空筛选
                                </Button>
                            ) : (
                                <Button icon="upload" onClick={() => inputRef.current?.click()}>
                                    上传第一张
                                </Button>
                            )
                        }
                    />
                </Card>
            ) : view === 'grid' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {visible.map((r) => {
                        const users = refs?.get(r.key) ?? [];
                        const isR2 = sourceOf(r.key) === 'r2';
                        /* 视频文件用 <img> 一定会裂图，给个明确的占位块 */
                        const isVideo = (r.mime ?? '').startsWith('video/');
                        return (
                            <Card key={r.id} hover className="group overflow-hidden">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => window.open(r.public_url, '_blank', 'noopener')}
                                        className="block h-32 w-full bg-slate-100"
                                        aria-label={`打开 ${r.alt || r.key}`}
                                    >
                                        {isVideo ? (
                                            <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[linear-gradient(150deg,#0d1830,#1c3055)] text-slate-300">
                                                <Icon name="play" className="h-6 w-6" />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider">视频</span>
                                            </span>
                                        ) : (
                                            <img
                                                src={r.public_url}
                                                alt={r.alt}
                                                loading="lazy"
                                                className="h-full w-full object-cover transition-transform duration-500 ease-expo group-hover:scale-[1.05]"
                                            />
                                        )}
                                        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,22,0)_50%,rgba(6,11,22,.6)_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                        <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-600 opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                                            {r.mime?.replace('image/', '') ?? 'webp'}
                                        </span>
                                    </button>
                                    {/* 来源常显：它决定「删除」是删桶里的对象还是只从库里移除 */}
                                    <span
                                        className={cx(
                                            'absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white backdrop-blur',
                                            isR2 ? 'bg-gold-600/80' : 'bg-ink-900/55',
                                        )}
                                    >
                                        {isR2 ? '后台上传' : '站内静态'}
                                    </span>
                                    {refs && (
                                        <span className="absolute right-2 top-2">
                                            <Tooltip text={refTip(r.key)} width={240}>
                                                <span
                                                    className={cx(
                                                        'cursor-help rounded-full px-1.5 py-0.5 text-[9px] font-semibold backdrop-blur',
                                                        users.length > 0 ? 'bg-emerald-300/90 text-emerald-900' : 'bg-white/80 text-slate-500',
                                                    )}
                                                >
                                                    {users.length > 0 ? `${users.length} 处引用` : '未引用'}
                                                </span>
                                            </Tooltip>
                                        </span>
                                    )}
                                </div>
                                <div className="p-2.5">
                                    <p className="truncate text-[11px] font-medium text-slate-700" title={r.alt || r.key}>
                                        {r.alt || r.key}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1.5 text-[10px] tabular-nums text-slate-400">
                                        {r.width && r.height ? `${r.width}×${r.height}` : '尺寸未知'}
                                        <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                        {bytes(r.bytes)}
                                        <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                                        {ago(r.created_at)}
                                    </p>
                                    <div className="mt-2 flex items-center gap-0.5">
                                        <IconButton icon="copy" label="复制链接" onClick={() => void copy(r)} />
                                        <IconButton icon="external" label="新窗口打开" onClick={() => window.open(r.public_url, '_blank', 'noopener')} />
                                        <IconButton icon="trash" label={isR2 ? '删除图片' : '从媒体库移除'} tone="danger" className="ml-auto" onClick={() => setAskDel(r)} />
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#fbfcfe,#f5f7fb)]">
                                <tr>
                                    <th className="th w-20">预览</th>
                                    <th className="th">说明 / 文件名</th>
                                    <th className="th">尺寸</th>
                                    <th className="th">体积</th>
                                    <th className="th">来源</th>
                                    <th className="th">引用</th>
                                    <th className="th">入库时间</th>
                                    <th className="th text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((r) => {
                                    const users = refs?.get(r.key) ?? [];
                                    const isR2 = sourceOf(r.key) === 'r2';
                                    return (
                                        <tr key={r.id} className="row-hot border-t border-slate-100">
                                            <td className="td">
                                                {(r.mime ?? '').startsWith('video/') ? (
                                                    <span className="flex h-10 w-14 items-center justify-center rounded-md bg-ink-900 text-slate-300 ring-1 ring-inset ring-slate-200">
                                                        <Icon name="play" className="h-4 w-4" />
                                                    </span>
                                                ) : (
                                                    <img src={r.public_url} alt={r.alt} loading="lazy" className="h-10 w-14 rounded-md bg-slate-100 object-cover ring-1 ring-inset ring-slate-200" />
                                                )}
                                            </td>
                                            <td className="td">
                                                <p className="max-w-[22rem] truncate font-medium text-slate-700">{r.alt || '（无说明）'}</p>
                                                <p className="mt-0.5 max-w-[22rem] truncate font-mono text-[11px] text-slate-400">{r.key}</p>
                                            </td>
                                            <td className="td whitespace-nowrap tabular-nums text-slate-500">
                                                {r.width && r.height ? `${r.width}×${r.height}` : '—'}
                                            </td>
                                            <td className="td whitespace-nowrap tabular-nums text-slate-500">{bytes(r.bytes)}</td>
                                            <td className="td whitespace-nowrap">
                                                <Badge tone={isR2 ? 'gold' : 'slate'} icon={isR2 ? 'database' : 'folder'}>
                                                    {isR2 ? '上传' : '站内'}
                                                </Badge>
                                                <p className="mt-1 text-[10px] text-slate-400">{r.mime?.replace('image/', '') ?? '—'}</p>
                                            </td>
                                            <td className="td whitespace-nowrap">
                                                {refs ? (
                                                    <Tooltip text={refTip(r.key)} width={240}>
                                                        <Badge tone={users.length > 0 ? 'green' : 'slate'} icon="link">
                                                            {users.length > 0 ? `${users.length} 处` : '未引用'}
                                                        </Badge>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip text={refTip(r.key)}>
                                                        <span className="cursor-help text-[11px] text-slate-300">未检测</span>
                                                    </Tooltip>
                                                )}
                                            </td>
                                            <td className="td whitespace-nowrap text-[11px] tabular-nums text-slate-400">
                                                {date(r.created_at)} · {ago(r.created_at)}
                                            </td>
                                            <td className="td">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    <IconButton icon="copy" label="复制链接" onClick={() => void copy(r)} />
                                                    <IconButton icon="external" label="新窗口打开" onClick={() => window.open(r.public_url, '_blank', 'noopener')} />
                                                    <IconButton icon="trash" label={isR2 ? '删除图片' : '从媒体库移除'} tone="danger" onClick={() => setAskDel(r)} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-[linear-gradient(180deg,#fcfdff,#f7f9fc)] px-4 py-3">
                        <MiniStat icon="image" label="总计" value={`${num(rows.length)} 张`} tone="brand" />
                        <MiniStat icon="download" label="体积" value={bytes(total)} tone="gold" />
                        <MiniStat icon="gauge" label="平均" value={rows.length > 0 ? bytes(Math.round(total / rows.length)) : '—'} tone="green" />
                    </div>
                </Card>
            )}

            {/* 分批渲染：347 张一次挂完会卡，滚到下面再放 */}
            {!loading && list.length > visible.length && (
                <div className="mt-5 flex items-center justify-center gap-3">
                    <Button variant="secondary" iconRight="chevronDown" onClick={() => setLimit((n) => n + 120)}>
                        再加载 120 张
                    </Button>
                    <span className="text-[11px] text-slate-400">还有 {num(list.length - visible.length)} 张没显示</span>
                </div>
            )}

            <ConfirmDialog
                open={!!askDel}
                onClose={() => setAskDel(null)}
                onConfirm={() => askDel && void del(askDel)}
                title={askDel && sourceOf(askDel.key) === 'r2' ? '删除这张上传的图片？' : '从媒体库移除这张图？'}
                desc={
                    askDel && sourceOf(askDel.key) === 'r2'
                        ? `会同时删掉云端文件和这条记录（${askDel.key}）。前台引用它的地方会变成破图，建议先点「检查引用」。`
                        : `这张图是站内静态资源（${askDel?.key ?? ''}），随站点代码一起发布：这里只会把它从媒体库列表移除，文件本身还在，前台照常显示。`
                }
                confirmLabel={askDel && sourceOf(askDel.key) === 'r2' ? '删除图片' : '仅从库移除'}
            />
        </div>
    );
}
